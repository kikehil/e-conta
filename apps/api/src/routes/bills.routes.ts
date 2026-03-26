import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { generateBillJournalEntry, ensurePeriod } from '../services/accounting.service.js';

const prisma = new PrismaClient();

const billsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/bills ─────────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;
    const { status, from, to, thirdPartyId } = request.query as any;

    const where: any = { companyId };
    if (status) where.paymentStatus = status;
    if (thirdPartyId) where.thirdPartyId = thirdPartyId;
    if (from || to) {
      where.issueDate = {};
      if (from) where.issueDate.gte = new Date(from);
      if (to) where.issueDate.lte = new Date(to);
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        thirdParty: { select: { razonSocial: true, rfc: true, diotType: true } },
      },
      orderBy: { issueDate: 'desc' },
      take: 200,
    });

    return { data: bills };
  });

  // ── GET /api/bills/aging — CxP vencida ─────────────────────────
  fastify.get('/aging', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;
    const today = new Date();

    const pending = await prisma.bill.findMany({
      where: { companyId, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
      include: { thirdParty: { select: { razonSocial: true, rfc: true } } },
    });

    const buckets = {
      current: { count: 0, total: new Decimal(0) },
      days1_30: { count: 0, total: new Decimal(0) },
      days31_60: { count: 0, total: new Decimal(0) },
      days61_90: { count: 0, total: new Decimal(0) },
      over90: { count: 0, total: new Decimal(0) },
    };

    const items = pending.map((b) => {
      const balance = new Decimal(b.total.toString()).minus(new Decimal(b.amountPaid.toString()));
      const due = b.dueDate ? new Date(b.dueDate) : new Date(b.issueDate);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);

      if (daysOverdue <= 0) { buckets.current.count++; buckets.current.total = buckets.current.total.plus(balance); }
      else if (daysOverdue <= 30) { buckets.days1_30.count++; buckets.days1_30.total = buckets.days1_30.total.plus(balance); }
      else if (daysOverdue <= 60) { buckets.days31_60.count++; buckets.days31_60.total = buckets.days31_60.total.plus(balance); }
      else if (daysOverdue <= 90) { buckets.days61_90.count++; buckets.days61_90.total = buckets.days61_90.total.plus(balance); }
      else { buckets.over90.count++; buckets.over90.total = buckets.over90.total.plus(balance); }

      return {
        id: b.id,
        uuid: b.satUuid,
        proveedor: b.thirdParty.razonSocial,
        rfc: b.thirdParty.rfc,
        issueDate: b.issueDate,
        dueDate: b.dueDate,
        total: balance.toNumber(),
        daysOverdue,
      };
    });

    return {
      data: {
        items,
        summary: {
          current: { count: buckets.current.count, total: buckets.current.total.toNumber() },
          days1_30: { count: buckets.days1_30.count, total: buckets.days1_30.total.toNumber() },
          days31_60: { count: buckets.days31_60.count, total: buckets.days31_60.total.toNumber() },
          days61_90: { count: buckets.days61_90.count, total: buckets.days61_90.total.toNumber() },
          over90: { count: buckets.over90.count, total: buckets.over90.total.toNumber() },
          totalPending: items.reduce((s, i) => s + i.total, 0),
        },
      },
    };
  });

  // ── GET /api/bills/:id ─────────────────────────────────────────
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const bill = await prisma.bill.findFirst({
      where: { id, companyId },
      include: { thirdParty: true },
    });

    if (!bill) return reply.code(404).send({ error: 'Factura recibida no encontrada' });
    return { data: bill };
  });

  // ── POST /api/bills — Registrar factura recibida manualmente ───
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    if (!body.satUuid || !body.thirdPartyId || !body.total) {
      return reply.code(400).send({ error: 'satUuid, thirdPartyId y total son obligatorios' });
    }

    // Verificar que el proveedor existe
    const thirdParty = await prisma.thirdParty.findFirst({
      where: { id: body.thirdPartyId, companyId },
    });
    if (!thirdParty) return reply.code(404).send({ error: 'Proveedor no encontrado' });

    const total = new Decimal(body.total);
    const subtotal = new Decimal(body.subtotal || total.div(1.16).toDecimalPlaces(4));
    const taxesTransferred = new Decimal(body.taxesTransferred || total.minus(subtotal));
    const vatCreditable = new Decimal(body.vatCreditable ?? taxesTransferred);

    try {
      const bill = await prisma.$transaction(async (tx) => {
        const created = await tx.bill.create({
          data: {
            companyId,
            thirdPartyId: body.thirdPartyId,
            satUuid: body.satUuid.toUpperCase(),
            series: body.series || null,
            folio: body.folio || null,
            issueDate: new Date(body.issueDate || new Date()),
            currency: body.currency || 'MXN',
            exchangeRate: new Decimal(body.exchangeRate || 1).toNumber(),
            subtotal: subtotal.toDecimalPlaces(4).toNumber(),
            taxesTransferred: taxesTransferred.toDecimalPlaces(4).toNumber(),
            taxesWithheld: new Decimal(body.taxesWithheld || 0).toDecimalPlaces(4).toNumber(),
            total: total.toDecimalPlaces(4).toNumber(),
            vatCreditable: vatCreditable.toDecimalPlaces(4).toNumber(),
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            paymentStatus: 'PENDING',
            xmlData: body.xmlData || null,
          },
        });

        // Generar póliza contable automática
        const journalEntryId = await generateBillJournalEntry(tx, {
          id: created.id,
          companyId,
          thirdPartyId: created.thirdPartyId,
          issueDate: created.issueDate,
          subtotal: subtotal,
          taxesTransferred: taxesTransferred,
          taxesWithheld: new Decimal(body.taxesWithheld || 0),
          total: total,
          vatCreditable: vatCreditable,
          satUuid: created.satUuid,
          createdBy: userId,
        });

        await tx.bill.update({ where: { id: created.id }, data: { journalEntryId } });
        return { ...created, journalEntryId };
      }, { timeout: 30000 });

      return reply.code(201).send({ message: 'Factura recibida registrada', data: bill });
    } catch (err: any) {
      request.log.error(err);
      if (err.code === 'P2002') return reply.code(400).send({ error: 'Ya existe una factura con ese UUID del SAT' });
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/bills/:id/pay — Registrar pago de factura ────────
  fastify.post('/:id/pay', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    const bill = await prisma.bill.findFirst({ where: { id, companyId } });
    if (!bill) return reply.code(404).send({ error: 'Factura no encontrada' });
    if (bill.paymentStatus === 'PAID') return reply.code(400).send({ error: 'Factura ya pagada' });

    const paymentAmount = new Decimal(body.amount);
    const previousPaid = new Decimal(bill.amountPaid.toString());
    const totalBill = new Decimal(bill.total.toString());
    const newPaid = previousPaid.plus(paymentAmount);

    if (newPaid.greaterThan(totalBill.plus(0.01))) {
      return reply.code(400).send({ error: 'El pago excede el saldo de la factura' });
    }

    const newStatus = newPaid.greaterThanOrEqualTo(totalBill.minus(0.01)) ? 'PAID' : 'PARTIAL';

    await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: { amountPaid: newPaid.toDecimalPlaces(4).toNumber(), paymentStatus: newStatus },
      });

      // Póliza de pago: Cargo Proveedores, Abono Bancos
      const periodId = await ensurePeriod(tx, companyId, new Date());
      const cuentaProveedor = await tx.account.findFirst({
        where: { companyId, OR: [{ satGroupCode: '210.01' }, { code: '2100' }], isActive: true },
      });
      const cuentaBancos = await tx.account.findFirst({
        where: { companyId, OR: [{ satGroupCode: '110.02' }, { code: '1020' }], isActive: true },
      });

      if (cuentaProveedor && cuentaBancos) {
        const entry = await tx.journalEntry.create({
          data: {
            companyId, periodId,
            entryDate: new Date(),
            reference: bill.satUuid.substring(0, 8).toUpperCase(),
            description: `Pago factura proveedor ${bill.satUuid.substring(0, 8).toUpperCase()}`,
            entryType: 'PAGO_REALIZADO',
            sourceId: bill.id,
            sourceType: 'CFDI',
            status: 'POSTED',
            createdBy: userId,
            postedBy: userId,
            postedAt: new Date(),
          },
        });

        await tx.journalLine.createMany({
          data: [
            {
              entryId: entry.id, companyId,
              accountId: cuentaProveedor.id,
              debit: paymentAmount.toDecimalPlaces(4).toNumber(), credit: 0,
              description: 'Pago a proveedor', lineNumber: 1,
              currency: 'MXN', exchangeRate: 1,
              amountMxn: paymentAmount.toDecimalPlaces(4).toNumber(),
            },
            {
              entryId: entry.id, companyId,
              accountId: cuentaBancos.id,
              debit: 0, credit: paymentAmount.toDecimalPlaces(4).toNumber(),
              description: 'Salida de bancos', lineNumber: 2,
              currency: 'MXN', exchangeRate: 1,
              amountMxn: paymentAmount.toDecimalPlaces(4).toNumber(),
            },
          ],
        });
      }
    }, { timeout: 30000 });

    return { message: `Pago registrado. Estado: ${newStatus}`, data: { newPaid: newPaid.toNumber(), status: newStatus } };
  });

  // ── DELETE /api/bills/:id — Cancelar factura recibida ──────────
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const bill = await prisma.bill.findFirst({ where: { id, companyId } });
    if (!bill) return reply.code(404).send({ error: 'Factura no encontrada' });
    if (bill.paymentStatus === 'PAID') return reply.code(400).send({ error: 'No se puede cancelar una factura pagada' });

    await prisma.bill.update({ where: { id }, data: { paymentStatus: 'CANCELLED' } });
    return { message: 'Factura cancelada (cancelación lógica)' };
  });
};

export default billsRoutes;
