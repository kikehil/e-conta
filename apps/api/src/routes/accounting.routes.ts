import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const accountingRoutes: FastifyPluginAsync = async (fastify, opts) => {

  // ── GET /api/accounting/financial-statements ───────────────────
  fastify.get('/financial-statements', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, tenantId } = request.user as any;

    const company = await prisma.company.findFirst({ where: { tenantId } });
    const companyName = company?.razonSocial || company?.nombreComercial || 'Mi Empresa';

    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const lines = await prisma.journalLine.findMany({
      where: { companyId },
      select: { accountId: true, debit: true, credit: true },
    });

    const balances = new Map<string, Decimal>();
    for (const line of lines) {
      const current = balances.get(line.accountId) || new Decimal(0);
      balances.set(line.accountId, current.plus(new Decimal(line.debit.toString())).minus(new Decimal(line.credit.toString())));
    }

    const groups: Record<string, { name: string; val: number; code: string }[]> = {
      ACTIVO: [], PASIVO: [], CAPITAL: [], INGRESO: [], COSTO: [], GASTO: []
    };

    for (const acc of accounts) {
      const balance = balances.get(acc.id) || new Decimal(0);
      if (balance.isZero() && !acc.allowsEntries) continue;
      if (acc.allowsEntries && !balance.isZero()) {
        const displayBalance = acc.nature === 'ACREEDORA' ? balance.neg() : balance;
        if (groups[acc.accountType]) {
          groups[acc.accountType].push({ code: acc.code, name: acc.name, val: displayBalance.abs().toNumber() });
        }
      }
    }

    const sum = (items: { val: number }[]) => items.reduce((s, i) => s + i.val, 0);

    return {
      status: 'success',
      data: {
        companyName,
        balance: {
          activos: { title: 'Activo', items: groups.ACTIVO, total: sum(groups.ACTIVO) },
          pasivos: { title: 'Pasivo', items: groups.PASIVO, total: sum(groups.PASIVO) },
          capital: { title: 'Capital Contable', items: groups.CAPITAL, total: sum(groups.CAPITAL) },
        },
        incomeStatement: {
          ingresos: { title: 'Ingresos', items: groups.INGRESO, total: sum(groups.INGRESO) },
          costos: { title: 'Costos y Gastos', items: [...groups.COSTO, ...groups.GASTO], total: sum(groups.COSTO) + sum(groups.GASTO) },
          utilidad: sum(groups.INGRESO) - sum(groups.COSTO) - sum(groups.GASTO),
        },
      },
    };
  });

  // ── GET /api/accounting/trial-balance — Balanza de comprobación
  fastify.get('/trial-balance', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { year, month } = request.query as any;

    const whereLines: any = { companyId };
    if (year && month) {
      const period = await prisma.period.findFirst({
        where: { companyId, year: Number(year), month: Number(month) },
      });
      if (period) {
        whereLines.entry = { periodId: period.id };
      }
    }

    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true, allowsEntries: true },
      orderBy: { code: 'asc' },
    });

    const lines = await prisma.journalLine.findMany({
      where: whereLines,
      select: { accountId: true, debit: true, credit: true },
    });

    const totals = new Map<string, { debit: Decimal; credit: Decimal }>();
    for (const line of lines) {
      const current = totals.get(line.accountId) || { debit: new Decimal(0), credit: new Decimal(0) };
      totals.set(line.accountId, {
        debit: current.debit.plus(new Decimal(line.debit.toString())),
        credit: current.credit.plus(new Decimal(line.credit.toString())),
      });
    }

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    const rows = accounts
      .map((acc) => {
        const t = totals.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };
        if (t.debit.isZero() && t.credit.isZero()) return null;

        const balance = t.debit.minus(t.credit);
        const debitBalance = balance.isPositive() ? balance : new Decimal(0);
        const creditBalance = balance.isNegative() ? balance.abs() : new Decimal(0);

        totalDebits = totalDebits.plus(t.debit);
        totalCredits = totalCredits.plus(t.credit);

        return {
          code: acc.code,
          name: acc.name,
          type: acc.accountType,
          nature: acc.nature,
          totalDebit: t.debit.toNumber(),
          totalCredit: t.credit.toNumber(),
          debitBalance: debitBalance.toNumber(),
          creditBalance: creditBalance.toNumber(),
        };
      })
      .filter(Boolean);

    return {
      data: {
        period: year && month ? `${year}-${String(month).padStart(2, '0')}` : 'Acumulado',
        rows,
        totals: {
          totalDebits: totalDebits.toNumber(),
          totalCredits: totalCredits.toNumber(),
          balanced: totalDebits.minus(totalCredits).abs().lessThan(0.01),
        },
      },
    };
  });

  // ── GET /api/accounting/periods — Lista períodos fiscales ──────
  fastify.get('/periods', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;

    const periods = await prisma.period.findMany({
      where: { companyId },
      include: {
        fiscalYear: { select: { year: true, status: true } },
        _count: { select: { journalEntries: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 36, // 3 años
    });

    return { data: periods };
  });

  // ── POST /api/accounting/periods/:id/close — Cerrar período ───
  fastify.post('/periods/:id/close', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const period = await prisma.period.findFirst({ where: { id, companyId } });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });
    if (period.status !== 'OPEN') return reply.code(400).send({ error: 'El período ya está cerrado o bloqueado' });

    // Verificar que no haya pólizas en borrador
    const drafts = await prisma.journalEntry.count({
      where: { companyId, periodId: id, status: 'DRAFT' },
    });
    if (drafts > 0) {
      return reply.code(400).send({ error: `Hay ${drafts} pólizas en borrador. Publícalas antes de cerrar.` });
    }

    await prisma.period.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    return { message: `Período ${period.month}/${period.year} cerrado exitosamente` };
  });

  // ── GET /api/accounting/sat-xml/:year/:month/balanza ──────────
  // Genera XML de Balanza de Comprobación para contabilidad electrónica SAT (Art. 28 CFF)
  fastify.get('/sat-xml/:year/:month/balanza', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' });

    const period = await prisma.period.findFirst({
      where: { companyId, year: Number(year), month: Number(month) },
    });
    if (!period) return reply.code(404).send({ error: 'Período no encontrado' });

    // Obtener todos los movimientos del período
    const entries = await prisma.journalEntry.findMany({
      where: { companyId, periodId: period.id, status: 'POSTED' },
      include: { lines: { include: { account: true } } },
    });

    // Acumular saldos iniciales y movimientos por cuenta
    const accountData = new Map<string, {
      code: string; name: string;
      initDebit: Decimal; initCredit: Decimal;
      periodDebit: Decimal; periodCredit: Decimal;
    }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const acc = line.account;
        if (!accountData.has(acc.id)) {
          accountData.set(acc.id, {
            code: acc.satGroupCode || acc.code,
            name: acc.name,
            initDebit: new Decimal(0), initCredit: new Decimal(0),
            periodDebit: new Decimal(0), periodCredit: new Decimal(0),
          });
        }
        const d = accountData.get(acc.id)!;
        d.periodDebit = d.periodDebit.plus(new Decimal(line.debit.toString()));
        d.periodCredit = d.periodCredit.plus(new Decimal(line.credit.toString()));
      }
    }

    // Construir XML Balanza de Comprobación (schema SAT)
    const mesStr = String(month).padStart(2, '0');
    const cuentasXml = Array.from(accountData.values())
      .filter(d => !d.periodDebit.isZero() || !d.periodCredit.isZero())
      .map(d => {
        const saldoInicial = d.initDebit.minus(d.initCredit);
        const saldoFinal = saldoInicial.plus(d.periodDebit).minus(d.periodCredit);
        return `    <BCE:Cuentas NumCta="${d.code}" Debe="${d.periodDebit.toFixed(2)}" Haber="${d.periodCredit.toFixed(2)}" SaldoIni="${saldoInicial.toFixed(2)}" SaldoFin="${saldoFinal.toFixed(2)}" />`;
      }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BCE:Balanza xmlns:BCE="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion/BalanzaComprobacion_1_3.xsd"
  Version="1.3" RFC="${company.rfc}" Anio="${year}" Mes="${mesStr}" TipoEnvio="N">
${cuentasXml}
</BCE:Balanza>`;

    const filename = `${company.rfc}${year}${mesStr}BN.xml`;
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(xml);
  });

  // ── GET /api/accounting/sat-xml/:year/:month/catalog ──────────
  // Genera XML del Catálogo de Cuentas para SAT
  fastify.get('/sat-xml/:year/:month/catalog', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { year, month } = request.params as { year: string; month: string };
    const { companyId } = request.user as any;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' });

    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const SAT_NATURE_MAP: Record<string, string> = {
      ACTIVO: 'A', PASIVO: 'P', CAPITAL: 'PC',
      INGRESO: 'I', COSTO: 'E', GASTO: 'E', ORDEN: 'OA',
    };

    const cuentasXml = accounts.map(acc => {
      const nat = SAT_NATURE_MAP[acc.accountType] || 'A';
      const subCuenta = acc.parentId ? ' SubCtaDe="' + acc.parentId + '"' : '';
      return `    <catalogocuentas:Ctas CodAgrup="${acc.satGroupCode || acc.code}" NumCta="${acc.code}" Desc="${acc.name.replace(/"/g, '&quot;')}" Nivel="${acc.level}" Natur="${nat}"${subCuenta} />`;
    }).join('\n');

    const mesStr = String(month).padStart(2, '0');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogocuentas:Catalogo xmlns:catalogocuentas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas/CatalogoCuentas_1_3.xsd"
  Version="1.3" RFC="${company.rfc}" Anio="${year}" Mes="${mesStr}" Sello="" NoCertificado="" Certificado="">
${cuentasXml}
</catalogocuentas:Catalogo>`;

    const filename = `${company.rfc}${year}${mesStr}CT.xml`;
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(xml);
  });
};

export default accountingRoutes;
