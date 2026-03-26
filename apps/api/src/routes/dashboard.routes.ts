import { FastifyPluginAsync } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, tenantId } = request.user as any;

    // Obtener info de la empresa
    const company = await prisma.company.findFirst({ where: { tenantId } });
    const companyName = company?.razonSocial || company?.nombreComercial || 'Mi Empresa';

    // Año en curso para filtrar
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    // Obtener líneas de pólizas del año con fecha de la póliza
    const lines = await prisma.journalLine.findMany({
      where: { companyId },
      select: {
        accountId: true,
        debit: true,
        credit: true,
        entry: { select: { entryDate: true } }
      }
    });

    // Obtener cuentas para mapear tipos
    const accounts = await prisma.account.findMany({
      where: { companyId },
      select: { id: true, accountType: true, code: true, name: true }
    });

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Calcular totales globales y por mes
    let ingresos = 0, gastos = 0, ivaPagar = 0, isrProv = 0;
    const monthlyMap: Record<number, { ingresos: number; gastos: number }> = {};

    for (const line of lines) {
      const acc = accountMap.get(line.accountId);
      if (!acc) continue;

      const entryDate = line.entry?.entryDate;
      const isCurrentYear = entryDate && entryDate >= yearStart && entryDate <= yearEnd;
      const month = entryDate ? entryDate.getMonth() : -1; // 0-indexed

      if (acc.accountType === 'REVENUE') {
        const net = Number(line.credit) - Number(line.debit);
        ingresos += net;
        if (isCurrentYear && month >= 0) {
          if (!monthlyMap[month]) monthlyMap[month] = { ingresos: 0, gastos: 0 };
          monthlyMap[month].ingresos += net;
        }
      }
      if (acc.accountType === 'EXPENSE') {
        const net = Number(line.debit) - Number(line.credit);
        gastos += net;
        if (isCurrentYear && month >= 0) {
          if (!monthlyMap[month]) monthlyMap[month] = { ingresos: 0, gastos: 0 };
          monthlyMap[month].gastos += net;
        }
      }
      if (acc.code === '216.03') ivaPagar += Number(line.credit) - Number(line.debit);
      if (acc.code === '216.02') isrProv += Number(line.credit) - Number(line.debit);
    }

    // Construir chartData solo con meses que tienen movimientos
    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const chartData = Object.entries(monthlyMap)
      .map(([m, vals]) => ({
        month: MONTHS[Number(m)],
        ingresos: Math.round(vals.ingresos * 100) / 100,
        gastos: Math.round(vals.gastos * 100) / 100,
      }))
      .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

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
        chartData,
        transactions
      }
    };
  });
};

export default dashboardRoutes;
