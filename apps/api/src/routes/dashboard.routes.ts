import { FastifyPluginAsync } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, tenantId } = request.user as any;

    // Obtener info de la empresa
    const company = await prisma.company.findFirst({ where: { tenantId } });
    const companyName = company?.razonSocial || company?.nombreComercial || 'Mi Empresa';

    // Obtener totales de pólizas por tipo de cuenta
    const lines = await prisma.journalLine.findMany({
      where: { companyId },
      select: { accountId: true, debit: true, credit: true }
    });

    // Obtener cuentas para mapear tipos
    const accounts = await prisma.account.findMany({
      where: { companyId },
      select: { id: true, accountType: true, code: true, name: true }
    });

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Calcular totales por tipo
    let ingresos = 0, gastos = 0, ivaPagar = 0, isrProv = 0;
    for (const line of lines) {
      const acc = accountMap.get(line.accountId);
      if (!acc) continue;
      const net = Number(line.credit) - Number(line.debit);
      
      if (acc.accountType === 'REVENUE') ingresos += net;
      if (acc.accountType === 'EXPENSE') gastos += (Number(line.debit) - Number(line.credit));
      if (acc.code === '216.03') ivaPagar += net; // IVA por Pagar
      if (acc.code === '216.02') isrProv += net; // ISR por Pagar
    }

    // Últimas transacciones (pólizas recientes)
    const recentEntries = await prisma.journalEntry.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, entryDate: true, description: true, status: true, lines: { select: { debit: true } } }
    });

    const transactions = recentEntries.map(e => ({
      id: e.id,
      date: e.entryDate.toISOString().split('T')[0],
      desc: e.description,
      amount: e.lines.reduce((s, l) => s + Number(l.debit), 0),
      status: e.status
    }));

    return {
      status: 'success',
      data: {
        companyName,
        kpis: {
          ingresosFacturados: Math.round(ingresos * 100) / 100,
          gastosDeducibles: Math.round(gastos * 100) / 100,
          ivaPagarEst: Math.round(ivaPagar * 100) / 100,
          isrProvisional: Math.round(isrProv * 100) / 100
        },
        chartData: [], // Se poblará con datos mensuales cuando haya pólizas
        transactions
      }
    };
  });
};

export default dashboardRoutes;
