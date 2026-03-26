import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const taxesRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/taxes/:year/:month/vat-summary ────────────────────
  fastify.get('/:year/:month/vat-summary', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const period = await prisma.period.findFirst({
      where: { companyId, year: Number(year), month: Number(month) },
    });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });

    // IVA trasladado (cobrado a clientes): de facturas STAMPED/PAID en el período
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: {
          gte: new Date(Number(year), Number(month) - 1, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
        status: { in: ['STAMPED', 'SENT', 'PAID'] },
        invoiceType: 'I',
      },
    });

    const vatTransferred = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.taxesTransferred.toString())), new Decimal(0)
    );
    const vatWithheldFromClients = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.taxesWithheld.toString())), new Decimal(0)
    );

    // IVA acreditable (pagado a proveedores): de bills en el período
    const bills = await prisma.bill.findMany({
      where: {
        companyId,
        issueDate: {
          gte: new Date(Number(year), Number(month) - 1, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
        paymentStatus: { in: ['PAID', 'PARTIAL'] },
      },
    });

    const vatCreditable = bills.reduce(
      (s, b) => s.plus(new Decimal(b.vatCreditable.toString())), new Decimal(0)
    );

    // IVA a pagar = Trasladado - Acreditable
    const vatPayable = vatTransferred.minus(vatCreditable);
    const vatInFavor = vatPayable.isNegative() ? vatPayable.abs() : new Decimal(0);

    return {
      data: {
        period: `${year}-${String(month).padStart(2, '0')}`,
        vatTransferred: vatTransferred.toNumber(),
        vatCreditable: vatCreditable.toNumber(),
        vatWithheldFromClients: vatWithheldFromClients.toNumber(),
        vatPayable: vatPayable.isPositive() ? vatPayable.toNumber() : 0,
        vatInFavor: vatInFavor.toNumber(),
        invoicesCount: invoices.length,
        billsCount: bills.length,
        dueDate: `${year}-${String(month).padStart(2, '0')}-17`, // Art. 5-D LIVA: día 17
      },
    };
  });

  // ── GET /api/taxes/:year/:month/diot ──────────────────────────
  fastify.get('/:year/:month/diot', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const period = await prisma.period.findFirst({
      where: { companyId, year: Number(year), month: Number(month) },
    });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });

    const diotEntries = await prisma.diotEntry.findMany({
      where: { companyId, periodId: period.id },
      include: { thirdParty: { select: { razonSocial: true, rfc: true, diotType: true } } },
    });

    return { data: diotEntries };
  });

  // ── POST /api/taxes/:year/:month/diot/calculate ──────────────
  // Calcula DIOT automáticamente desde las facturas recibidas del período
  fastify.post('/:year/:month/diot/calculate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const period = await prisma.period.findFirst({
      where: { companyId, year: Number(year), month: Number(month) },
    });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });

    // Obtener facturas recibidas del período
    const bills = await prisma.bill.findMany({
      where: {
        companyId,
        issueDate: {
          gte: new Date(Number(year), Number(month) - 1, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
        paymentStatus: { in: ['PAID', 'PARTIAL'] },
      },
      include: {
        thirdParty: { select: { id: true, rfc: true, razonSocial: true, diotType: true, isForeign: true } },
      },
    });

    // Agrupar por proveedor
    const byProvider = new Map<string, {
      thirdPartyId: string;
      diotType: string;
      vat16: Decimal; vat8: Decimal; vat0: Decimal; vatExempt: Decimal;
      vatWithheld: Decimal; isrWithheld: Decimal; total: Decimal;
    }>();

    for (const bill of bills) {
      const tp = bill.thirdParty;
      const key = bill.thirdPartyId;

      if (!byProvider.has(key)) {
        byProvider.set(key, {
          thirdPartyId: key,
          diotType: tp.diotType || (tp.isForeign ? '05' : '04'),
          vat16: new Decimal(0), vat8: new Decimal(0), vat0: new Decimal(0),
          vatExempt: new Decimal(0), vatWithheld: new Decimal(0),
          isrWithheld: new Decimal(0), total: new Decimal(0),
        });
      }

      const entry = byProvider.get(key)!;
      const vatPaid = new Decimal(bill.vatCreditable.toString());
      const isrWithheld = new Decimal(bill.taxesWithheld.toString());

      // Determinar tasa de IVA (asumimos 16% para simplificar; en prod. revisar concepto a concepto)
      // Se podría mejorar parseando el xmlData del CFDI
      const subTotal = new Decimal(bill.subtotal.toString());
      const effectiveRate = subTotal.greaterThan(0) ? vatPaid.div(subTotal) : new Decimal(0);

      if (effectiveRate.greaterThanOrEqualTo(0.15)) {
        entry.vat16 = entry.vat16.plus(vatPaid);
      } else if (effectiveRate.greaterThanOrEqualTo(0.07)) {
        entry.vat8 = entry.vat8.plus(vatPaid);
      } else if (vatPaid.isZero() && !bill.taxesTransferred.equals(0)) {
        entry.vatExempt = entry.vatExempt.plus(subTotal);
      } else if (vatPaid.isZero()) {
        entry.vat0 = entry.vat0.plus(subTotal);
      } else {
        entry.vat16 = entry.vat16.plus(vatPaid); // default
      }

      entry.vatWithheld = entry.vatWithheld.plus(new Decimal(bill.taxesWithheld.toString()));
      entry.isrWithheld = entry.isrWithheld.plus(isrWithheld);
      entry.total = entry.total.plus(new Decimal(bill.total.toString()));
    }

    // Guardar/actualizar entradas DIOT
    const results: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const [thirdPartyId, data] of byProvider) {
        const upserted = await tx.diotEntry.upsert({
          where: { companyId_periodId_thirdPartyId: { companyId, periodId: period.id, thirdPartyId } },
          create: {
            companyId, periodId: period.id, thirdPartyId,
            diotType: data.diotType,
            vat16Paid: data.vat16.toDecimalPlaces(2).toNumber(),
            vat8Paid: data.vat8.toDecimalPlaces(2).toNumber(),
            vat0Paid: data.vat0.toDecimalPlaces(2).toNumber(),
            vatExemptPaid: data.vatExempt.toDecimalPlaces(2).toNumber(),
            vatWithheld: data.vatWithheld.toDecimalPlaces(2).toNumber(),
            isrWithheld: data.isrWithheld.toDecimalPlaces(2).toNumber(),
            totalPaid: data.total.toDecimalPlaces(2).toNumber(),
          },
          update: {
            diotType: data.diotType,
            vat16Paid: data.vat16.toDecimalPlaces(2).toNumber(),
            vat8Paid: data.vat8.toDecimalPlaces(2).toNumber(),
            vat0Paid: data.vat0.toDecimalPlaces(2).toNumber(),
            vatExemptPaid: data.vatExempt.toDecimalPlaces(2).toNumber(),
            vatWithheld: data.vatWithheld.toDecimalPlaces(2).toNumber(),
            isrWithheld: data.isrWithheld.toDecimalPlaces(2).toNumber(),
            totalPaid: data.total.toDecimalPlaces(2).toNumber(),
          },
        });
        results.push(upserted);
      }
    });

    return { message: `DIOT calculado para ${results.length} proveedores`, data: results };
  });

  // ── GET /api/taxes/:year/:month/diot/export — Archivo TXT SAT ─
  fastify.get('/:year/:month/diot/export', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const period = await prisma.period.findFirst({
      where: { companyId, year: Number(year), month: Number(month) },
    });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });

    const entries = await prisma.diotEntry.findMany({
      where: { companyId, periodId: period.id },
      include: { thirdParty: true },
    });

    if (entries.length === 0) {
      return reply.code(404).send({ error: 'No hay datos DIOT para este período. Ejecuta /calculate primero.' });
    }

    // Formato DIOT A-29 layout SAT (registro tipo 3)
    // Campos: Tipo_Tercero|Tipo_Operación|RFC|ID_Fiscal|Nombre|Pais|Nac_Ext|
    //         VDN16%|VDN8%|VDN0%|VDNExento|IVAPag16%|IVAPag8%|IVAPag0%|IVAPagExento|
    //         IVARetenido|ISRRetenido|Total
    const lines: string[] = [];

    for (const entry of entries) {
      const tp = entry.thirdParty;
      const rfc = tp.rfc || 'XEXX010101000';
      const name = tp.razonSocial.toUpperCase().replace(/[|]/g, ' ').substring(0, 150);
      const diotType = entry.diotType.substring(0, 2); // '04', '05', '15'
      const isNational = !tp.isForeign;

      // Base (valor sin IVA) — aproximado como total / (1 + tasa)
      const total = new Decimal(entry.totalPaid.toString());
      const vat16 = new Decimal(entry.vat16Paid.toString());
      const vat8 = new Decimal(entry.vat8Paid.toString());

      const base16 = vat16.greaterThan(0) ? vat16.div(0.16).toDecimalPlaces(2) : new Decimal(0);
      const base8 = vat8.greaterThan(0) ? vat8.div(0.08).toDecimalPlaces(2) : new Decimal(0);

      const fmt2 = (d: Decimal) => d.toFixed(2);
      const fmtI = (d: Decimal) => d.toFixed(0);

      // Layout: separado por |
      const line = [
        diotType,                              // Tipo de tercero
        '03',                                  // Tipo operación: 03=Otros
        isNational ? rfc : '',                 // RFC (solo nacionales)
        !isNational ? rfc : '',                // ID fiscal (extranjeros)
        name,                                  // Nombre/Razón Social
        tp.isForeign ? (tp.countryCode || 'USA') : '',  // País (solo ext.)
        isNational ? '02' : '03',              // Nac/Ext: 02=Nacional, 03=Extranjero
        fmt2(base16),                          // ValorActosNacionales16%
        fmt2(base8),                           // ValorActosNacionales8%
        '0.00',                                // ValorActosNacionales0%
        '0.00',                                // ValorActosExentos
        fmt2(vat16),                           // IVAPagado16%
        fmt2(vat8),                            // IVAPagado8%
        '0.00',                                // IVAPagado0%
        '0.00',                                // IVAPagadoExento
        fmt2(new Decimal(entry.vatWithheld.toString())),  // IVARetenido
        fmt2(new Decimal(entry.isrWithheld.toString())),  // ISRRetenido
      ].join('|');

      lines.push(line);
    }

    const content = lines.join('\n');
    const filename = `DIOT_${year}${String(month).padStart(2, '0')}.txt`;

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(content);
  });

  // ── GET /api/taxes/:year/:month/isr-provisional ───────────────
  fastify.get('/:year/:month/isr-provisional', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    // Ingresos acumulados del ejercicio hasta el período
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: {
          gte: new Date(Number(year), 0, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
        status: { in: ['STAMPED', 'SENT', 'PAID'] },
        invoiceType: 'I',
      },
      select: { subtotal: true },
    });

    const bills = await prisma.bill.findMany({
      where: {
        companyId,
        issueDate: {
          gte: new Date(Number(year), 0, 1),
          lt: new Date(Number(year), Number(month), 1),
        },
      },
      select: { subtotal: true },
    });

    const cumulativeIncome = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.subtotal.toString())), new Decimal(0)
    );
    const authorizedDeductions = bills.reduce(
      (s, b) => s.plus(new Decimal(b.subtotal.toString())), new Decimal(0)
    );

    const fiscalResult = cumulativeIncome.minus(authorizedDeductions);
    // Tasa Art. 9 LISR personas morales: 30%
    const provisionalTax = fiscalResult.isPositive()
      ? fiscalResult.mul(0.30).toDecimalPlaces(2)
      : new Decimal(0);

    return {
      data: {
        period: `${year}-${String(month).padStart(2, '0')}`,
        cumulativeIncome: cumulativeIncome.toNumber(),
        authorizedDeductions: authorizedDeductions.toNumber(),
        fiscalResult: fiscalResult.toNumber(),
        provisionalTax: provisionalTax.toNumber(),
        taxRate: 0.30,
        dueDate: `${year}-${String(month).padStart(2, '0')}-17`,
        note: 'Cálculo simplificado Art. 14 LISR. Consulte a su contador para pagos definitivos.',
      },
    };
  });
};

export default taxesRoutes;
