import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { PacClient } from '@contasys/cfdi';
import { CfdiBuilder } from '@contasys/cfdi';
import { ensurePeriod } from '../services/accounting.service.js';

const prisma = new PrismaClient();

const pacClient = new PacClient({
  provider: (process.env.PAC_PROVIDER as any) || 'SANDBOX',
  user: process.env.PAC_USER || '',
  password: process.env.PAC_PASSWORD || '',
  environment: (process.env.PAC_ENVIRONMENT as any) || 'sandbox',
});

const paymentComplementRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/payment-complements ───────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;
    const { status } = request.query as any;

    const where: any = { companyId };
    if (status) where.status = status;

    const complements = await prisma.paymentComplement.findMany({
      where,
      include: {
        invoice: {
          select: {
            series: true, folio: true, satUuid: true,
            thirdParty: { select: { razonSocial: true, rfc: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { data: complements };
  });

  // ── GET /api/payment-complements/:id ───────────────────────────
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const comp = await prisma.paymentComplement.findFirst({
      where: { id, companyId },
      include: { invoice: { include: { thirdParty: true, lines: true } } },
    });

    if (!comp) return reply.code(404).send({ error: 'Complemento de pago no encontrado' });
    return { data: comp };
  });

  // ── POST /api/payment-complements — Crear REP ──────────────────
  // Body: { invoiceId, paymentDate, paymentForm, currency, amount, relatedCfdi[], bankAccountOrigin?, bankAccountDest? }
  // relatedCfdi: [{uuid, series, folio, currency, partialAmount, previousBalance, amountPaid, remainingBalance}]
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    if (!body.invoiceId || !body.paymentDate || !body.paymentForm || !body.amount) {
      return reply.code(400).send({ error: 'invoiceId, paymentDate, paymentForm y amount son obligatorios' });
    }

    // Buscar la factura origen (CFDI tipo P se asocia a ella o se crea nueva)
    const parentInvoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, companyId },
      include: { thirdParty: true },
    });
    if (!parentInvoice) return reply.code(404).send({ error: 'Factura origen no encontrada' });

    const amount = new Decimal(body.amount);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const comp = await tx.paymentComplement.create({
          data: {
            companyId,
            invoiceId: body.invoiceId,
            paymentDate: new Date(body.paymentDate),
            paymentForm: body.paymentForm,
            currency: body.currency || 'MXN',
            amount: amount.toDecimalPlaces(4).toNumber(),
            bankAccountOrigin: body.bankAccountOrigin || null,
            bankAccountDest: body.bankAccountDest || null,
            relatedCfdi: body.relatedCfdi || [],
            status: 'DRAFT',
            createdBy: userId,
          },
        });

        // Póliza contable: Cargo Clientes, Abono Bancos
        const periodId = await ensurePeriod(tx, companyId, new Date(body.paymentDate));
        const cuentaClientes = await tx.account.findFirst({
          where: { companyId, OR: [{ satGroupCode: '120.01' }, { code: '1050' }], isActive: true },
        });
        const cuentaBancos = await tx.account.findFirst({
          where: { companyId, OR: [{ satGroupCode: '110.02' }, { code: '1020' }], isActive: true },
        });

        if (cuentaClientes && cuentaBancos) {
          const entry = await tx.journalEntry.create({
            data: {
              companyId, periodId,
              entryDate: new Date(body.paymentDate),
              description: `Cobro factura ${parentInvoice.series || ''}${parentInvoice.folio} (REP)`,
              entryType: 'PAGO_COBRADO',
              sourceId: comp.id,
              sourceType: 'PAYMENT',
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
                accountId: cuentaBancos.id,
                debit: amount.toDecimalPlaces(4).toNumber(), credit: 0,
                description: 'Cobro recibido (REP)', lineNumber: 1,
                thirdPartyId: parentInvoice.thirdPartyId,
                currency: body.currency || 'MXN', exchangeRate: 1,
                amountMxn: amount.toDecimalPlaces(4).toNumber(),
              },
              {
                entryId: entry.id, companyId,
                accountId: cuentaClientes.id,
                debit: 0, credit: amount.toDecimalPlaces(4).toNumber(),
                description: 'Liquidación CxC (REP)', lineNumber: 2,
                thirdPartyId: parentInvoice.thirdPartyId,
                currency: body.currency || 'MXN', exchangeRate: 1,
                amountMxn: amount.toDecimalPlaces(4).toNumber(),
              },
            ],
          });

          await tx.paymentComplement.update({
            where: { id: comp.id },
            data: { journalEntryId: entry.id },
          });
        }

        // Marcar factura como pagada si el total cubre el saldo
        const prevInvoice = await tx.invoice.findUnique({ where: { id: body.invoiceId } });
        if (prevInvoice && amount.greaterThanOrEqualTo(new Decimal(prevInvoice.total.toString()).minus(0.01))) {
          await tx.invoice.update({ where: { id: body.invoiceId }, data: { status: 'PAID' } });
        }

        return comp;
      }, { timeout: 30000 });

      return reply.code(201).send({ message: 'Complemento de pago creado', data: result });
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/payment-complements/:id/stamp — Timbrar REP ─────
  fastify.post('/:id/stamp', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const comp = await prisma.paymentComplement.findFirst({
      where: { id, companyId },
      include: { invoice: { include: { thirdParty: true } } },
    });
    if (!comp) return reply.code(404).send({ error: 'Complemento no encontrado' });
    if (comp.status !== 'DRAFT') return reply.code(400).send({ error: `Estado actual: ${comp.status}` });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' });

    // Construir CFDI tipo P con Complemento de Pago 2.0
    const fecha = new Date().toISOString().substring(0, 19);
    const amount = new Decimal(comp.amount.toString());
    const relatedCfdi = Array.isArray(comp.relatedCfdi) ? comp.relatedCfdi as any[] : [];

    // Concepto obligatorio para CFDI tipo P
    const conceptoP = {
      claveProdServ: '84111506',
      cantidad: '1',
      claveUnidad: 'ACT',
      descripcion: 'Pago',
      valorUnitario: '0',
      importe: '0',
      objetoImp: '01', // No objeto de impuesto
    };

    const builder = new CfdiBuilder({
      folio: `REP-${id.substring(0, 8).toUpperCase()}`,
      fecha,
      noCertificado: company.settings && (company.settings as any).certificateNo
        ? (company.settings as any).certificateNo
        : '30001000000400002495',
      certificadoBase64: '',
      subTotal: '0',
      moneda: 'XXX', // Moneda sin valor para CFDI tipo P
      total: '0',
      tipoDeComprobante: 'P',
      exportacion: '01',
      lugarExpedicion: company.codigoPostal,
      emisor: {
        rfc: company.rfc,
        nombre: company.razonSocial,
        regimenFiscal: company.regimenFiscal,
      },
      receptor: {
        rfc: comp.invoice.thirdParty.rfc || 'XAXX010101000',
        nombre: comp.invoice.thirdParty.razonSocial,
        domicilioFiscalReceptor: comp.invoice.thirdParty.codigoPostal || '00000',
        regimenFiscalReceptor: comp.invoice.thirdParty.regimenFiscal || '616',
        usoCfdi: 'CP01', // Pagos (c_UsoCFDI)
      },
      conceptos: [conceptoP],
    });

    const xmlSinSello = builder.buildXml();

    try {
      const stampResult = await pacClient.stampXml(xmlSinSello);

      await prisma.paymentComplement.update({
        where: { id: comp.id },
        data: {
          status: 'STAMPED',
          satUuid: stampResult.uuid,
          xmlUrl: `mock://cfdi/pago/${stampResult.uuid}.xml`,
        },
      });

      return {
        message: 'Complemento de pago timbrado',
        data: { uuid: stampResult.uuid, fechaTimbrado: stampResult.fechaTimbrado },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: `Error al timbrar REP: ${err.message}` });
    }
  });
};

export default paymentComplementRoutes;
