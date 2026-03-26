import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { ensurePeriod } from '../services/accounting.service.js';

const prisma = new PrismaClient();

const banksRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/banks ─────────────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;

    const accounts = await prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      include: {
        account: { select: { code: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { bankName: 'asc' },
    });

    return { data: accounts };
  });

  // ── POST /api/banks — Crear cuenta bancaria ────────────────────
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;

    if (!body.bankName || !body.accountId) {
      return reply.code(400).send({ error: 'bankName y accountId (cuenta contable) son obligatorios' });
    }

    // Validar CLABE si se proporciona (18 dígitos)
    if (body.clabe && !/^\d{18}$/.test(body.clabe)) {
      return reply.code(400).send({ error: 'La CLABE debe tener exactamente 18 dígitos' });
    }

    const account = await prisma.account.findFirst({ where: { id: body.accountId, companyId } });
    if (!account) return reply.code(404).send({ error: 'Cuenta contable no encontrada' });

    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId,
        accountId: body.accountId,
        bankName: body.bankName,
        clabe: body.clabe || null,
        accountNumber: body.accountNumber || null,
        currency: body.currency || 'MXN',
        currentBalance: new Decimal(body.initialBalance || 0).toDecimalPlaces(4).toNumber(),
        isActive: true,
      },
    });

    return reply.code(201).send({ message: 'Cuenta bancaria creada', data: bankAccount });
  });

  // ── GET /api/banks/:id/transactions ───────────────────────────
  fastify.get('/:id/transactions', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;
    const { status, from, to } = request.query as any;

    const account = await prisma.bankAccount.findFirst({ where: { id, companyId } });
    if (!account) return reply.code(404).send({ error: 'Cuenta bancaria no encontrada' });

    const where: any = { bankAccountId: id, companyId };
    if (status) where.reconciliationStatus = status;
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(from);
      if (to) where.transactionDate.lte = new Date(to);
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        journalLine: {
          include: { account: { select: { code: true, name: true } } },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: 200,
    });

    // Resumen del período
    const inflows = transactions.filter(t => new Decimal(t.amount.toString()).isPositive())
      .reduce((s, t) => s.plus(new Decimal(t.amount.toString())), new Decimal(0));
    const outflows = transactions.filter(t => new Decimal(t.amount.toString()).isNegative())
      .reduce((s, t) => s.plus(new Decimal(t.amount.toString()).abs()), new Decimal(0));

    return {
      data: {
        account: { id: account.id, bankName: account.bankName, currency: account.currency, currentBalance: account.currentBalance },
        transactions,
        summary: {
          count: transactions.length,
          inflows: inflows.toNumber(),
          outflows: outflows.toNumber(),
          pending: transactions.filter(t => t.reconciliationStatus === 'PENDING').length,
        },
      },
    };
  });

  // ── POST /api/banks/:id/transactions — Registrar movimiento ───
  fastify.post('/:id/transactions', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    if (!body.amount || !body.description || !body.transactionDate) {
      return reply.code(400).send({ error: 'amount, description y transactionDate son obligatorios' });
    }

    const bankAccount = await prisma.bankAccount.findFirst({ where: { id, companyId } });
    if (!bankAccount) return reply.code(404).send({ error: 'Cuenta bancaria no encontrada' });

    const amount = new Decimal(body.amount);
    const newBalance = new Decimal(bankAccount.currentBalance.toString()).plus(amount);

    const tx = await prisma.$transaction(async (prisma) => {
      const transaction = await prisma.bankTransaction.create({
        data: {
          bankAccountId: id,
          companyId,
          transactionDate: new Date(body.transactionDate),
          valueDate: body.valueDate ? new Date(body.valueDate) : null,
          description: body.description,
          reference: body.reference || null,
          amount: amount.toDecimalPlaces(4).toNumber(),
          balanceAfter: newBalance.toDecimalPlaces(4).toNumber(),
          reconciliationStatus: 'PENDING',
          source: 'MANUAL',
          externalId: body.externalId || null,
        },
      });

      // Actualizar saldo de la cuenta bancaria
      await prisma.bankAccount.update({
        where: { id },
        data: { currentBalance: newBalance.toDecimalPlaces(4).toNumber() },
      });

      // Si se indica cuenta contable, generar póliza automática
      if (body.accountId) {
        const periodId = await ensurePeriod(prisma as any, companyId, new Date(body.transactionDate));
        const contaAccount = await prisma.account.findFirst({ where: { id: body.accountId, companyId } });
        const cuentaBancos = await prisma.account.findFirst({
          where: { companyId, OR: [{ satGroupCode: '110.02' }, { code: '1020' }], isActive: true },
        });

        if (contaAccount && cuentaBancos) {
          const isDeposit = amount.isPositive();
          const absAmount = amount.abs();

          const entry = await prisma.journalEntry.create({
            data: {
              companyId, periodId,
              entryDate: new Date(body.transactionDate),
              description: body.description,
              entryType: 'MANUAL',
              sourceId: transaction.id,
              sourceType: 'PAYMENT',
              status: 'POSTED',
              createdBy: userId,
              postedBy: userId,
              postedAt: new Date(),
            },
          });

          await prisma.journalLine.createMany({
            data: [
              {
                entryId: entry.id, companyId,
                accountId: isDeposit ? cuentaBancos.id : contaAccount.id,
                debit: absAmount.toDecimalPlaces(4).toNumber(), credit: 0,
                description: body.description, lineNumber: 1,
                currency: 'MXN', exchangeRate: 1,
                amountMxn: absAmount.toDecimalPlaces(4).toNumber(),
              },
              {
                entryId: entry.id, companyId,
                accountId: isDeposit ? contaAccount.id : cuentaBancos.id,
                debit: 0, credit: absAmount.toDecimalPlaces(4).toNumber(),
                description: body.description, lineNumber: 2,
                currency: 'MXN', exchangeRate: 1,
                amountMxn: absAmount.toDecimalPlaces(4).toNumber(),
              },
            ],
          });

          // Obtener el journal line de bancos para conciliar
          const lines = await prisma.journalLine.findMany({ where: { entryId: entry.id } });
          const bankLine = lines.find(l => l.accountId === cuentaBancos.id);

          if (bankLine) {
            await prisma.bankTransaction.update({
              where: { id: transaction.id },
              data: { journalLineId: bankLine.id, reconciliationStatus: 'MATCHED' },
            });
          }
        }
      }

      return transaction;
    }, { timeout: 30000 });

    return reply.code(201).send({ message: 'Movimiento registrado', data: tx });
  });

  // ── PUT /api/banks/transactions/:txId/reconcile ────────────────
  fastify.put('/transactions/:txId/reconcile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { txId } = request.params as { txId: string };
    const { companyId } = request.user as any;
    const body = request.body as any;

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: txId, companyId },
    });
    if (!transaction) return reply.code(404).send({ error: 'Movimiento no encontrado' });

    const status = body.status as 'MATCHED' | 'MANUAL' | 'IGNORED';
    const validStatuses = ['MATCHED', 'MANUAL', 'IGNORED'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: `status debe ser: ${validStatuses.join(', ')}` });
    }

    const updated = await prisma.bankTransaction.update({
      where: { id: txId },
      data: {
        reconciliationStatus: status,
        journalLineId: body.journalLineId || transaction.journalLineId,
      },
    });

    return { message: 'Movimiento conciliado', data: updated };
  });

  // ── GET /api/banks/summary — Resumen de saldos bancarios ───────
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;

    const accounts = await prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      include: { account: { select: { code: true, name: true } } },
    });

    const totalBalance = accounts.reduce(
      (sum, a) => sum.plus(new Decimal(a.currentBalance.toString())), new Decimal(0)
    );

    const pendingCount = await prisma.bankTransaction.count({
      where: { companyId, reconciliationStatus: 'PENDING' },
    });

    return {
      data: {
        accounts: accounts.map(a => ({
          id: a.id,
          bankName: a.bankName,
          currency: a.currency,
          currentBalance: Number(a.currentBalance),
          accountCode: a.account.code,
          accountName: a.account.name,
        })),
        totalBalance: totalBalance.toNumber(),
        pendingReconciliation: pendingCount,
      },
    };
  });
};

export default banksRoutes;
