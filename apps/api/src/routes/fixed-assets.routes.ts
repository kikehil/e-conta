import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { ensurePeriod } from '../services/accounting.service.js';

const prisma = new PrismaClient();

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Calcula la depreciación mensual según el método NIF C-6 */
function calcMonthlyDepreciation(
  method: string,
  acquisitionCost: Decimal,
  residualValue: Decimal,
  usefulLifeMonths: number,
  monthsElapsed: number,
  netBookValue: Decimal
): Decimal {
  const depreciableBase = acquisitionCost.minus(residualValue);

  switch (method) {
    case 'LINEA_RECTA':
      return depreciableBase.div(usefulLifeMonths).toDecimalPlaces(4);

    case 'DOBLE_SALDO': {
      const rate = new Decimal(2).div(usefulLifeMonths);
      const dep = netBookValue.mul(rate).toDecimalPlaces(4);
      const minNetBook = residualValue;
      return netBookValue.minus(dep).lessThan(minNetBook)
        ? netBookValue.minus(minNetBook).toDecimalPlaces(4)
        : dep;
    }

    case 'SUM_DIGITOS': {
      // Suma de los dígitos: factor = (vida restante) / suma_total
      const totalSum = new Decimal((usefulLifeMonths * (usefulLifeMonths + 1)) / 2);
      const remainingLife = new Decimal(Math.max(0, usefulLifeMonths - monthsElapsed));
      const factor = remainingLife.div(totalSum);
      return depreciableBase.mul(factor).toDecimalPlaces(4);
    }

    default:
      return depreciableBase.div(usefulLifeMonths).toDecimalPlaces(4);
  }
}

const fixedAssetsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /api/fixed-assets ──────────────────────────────────────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;
    const { status } = request.query as any;

    const where: any = { companyId };
    if (status) where.status = status;

    const assets = await prisma.fixedAsset.findMany({
      where,
      include: {
        account: { select: { code: true, name: true } },
        depreciationSchedules: {
          orderBy: { period: { year: 'desc' } },
          take: 1,
          include: { period: { select: { year: true, month: true } } },
        },
      },
      orderBy: { acquisitionDate: 'desc' },
    });

    return { data: assets };
  });

  // ── GET /api/fixed-assets/:id ──────────────────────────────────
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const asset = await prisma.fixedAsset.findFirst({
      where: { id, companyId },
      include: {
        account: true,
        depreciationSchedules: {
          include: { period: true },
          orderBy: { period: { year: 'asc' } },
        },
      },
    });

    if (!asset) return reply.code(404).send({ error: 'Activo fijo no encontrado' });
    return { data: asset };
  });

  // ── POST /api/fixed-assets — Crear activo fijo ─────────────────
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;

    if (!body.name || !body.accountId || !body.acquisitionDate || !body.acquisitionCost || !body.usefulLifeMonths) {
      return reply.code(400).send({ error: 'name, accountId, acquisitionDate, acquisitionCost, usefulLifeMonths son obligatorios' });
    }

    const account = await prisma.account.findFirst({ where: { id: body.accountId, companyId } });
    if (!account) return reply.code(404).send({ error: 'Cuenta contable no encontrada' });

    const asset = await prisma.fixedAsset.create({
      data: {
        companyId,
        accountId: body.accountId,
        name: body.name,
        satAssetType: body.satAssetType || 'Maquinaria',
        acquisitionDate: new Date(body.acquisitionDate),
        acquisitionCost: new Decimal(body.acquisitionCost).toDecimalPlaces(4).toNumber(),
        residualValue: new Decimal(body.residualValue || 0).toDecimalPlaces(4).toNumber(),
        depreciationMethod: body.depreciationMethod || 'LINEA_RECTA',
        usefulLifeMonths: Number(body.usefulLifeMonths),
        satDepreciationRate: body.satDepreciationRate
          ? new Decimal(body.satDepreciationRate).toDecimalPlaces(4).toNumber()
          : null,
        notes: body.notes || null,
        status: 'ACTIVE',
      },
    });

    return reply.code(201).send({ message: 'Activo fijo creado', data: asset });
  });

  // ── PUT /api/fixed-assets/:id ──────────────────────────────────
  fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;
    const body = request.body as any;

    const asset = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!asset) return reply.code(404).send({ error: 'Activo fijo no encontrado' });

    const updated = await prisma.fixedAsset.update({
      where: { id },
      data: {
        name: body.name ?? asset.name,
        notes: body.notes ?? asset.notes,
        satAssetType: body.satAssetType ?? asset.satAssetType,
        satDepreciationRate: body.satDepreciationRate != null
          ? new Decimal(body.satDepreciationRate).toDecimalPlaces(4).toNumber()
          : asset.satDepreciationRate,
        status: body.status ?? asset.status,
        disposalDate: body.disposalDate ? new Date(body.disposalDate) : asset.disposalDate,
        disposalAmount: body.disposalAmount != null
          ? new Decimal(body.disposalAmount).toDecimalPlaces(4).toNumber()
          : asset.disposalAmount,
      },
    });

    return { data: updated };
  });

  // ── POST /api/fixed-assets/run-depreciation — Depreciación mensual
  fastify.post('/run-depreciation', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as any;
    const { year, month } = request.body as any;

    if (!year || !month) return reply.code(400).send({ error: 'year y month son obligatorios' });

    // Verificar período
    const period = await prisma.period.findFirst({ where: { companyId, year: Number(year), month: Number(month) } });
    if (!period) return reply.code(400).send({ error: 'Período no existe. Crea facturas primero para generar el período.' });
    if (period.status === 'CLOSED') return reply.code(400).send({ error: 'El período está cerrado' });

    // Verificar si ya se corrió depreciacón en este período
    const existing = await prisma.depreciationSchedule.findFirst({
      where: { companyId, periodId: period.id },
    });
    if (existing) return reply.code(409).send({ error: 'La depreciación para este período ya fue calculada' });

    // Activos activos con vida útil restante
    const activeAssets = await prisma.fixedAsset.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        depreciationSchedules: { orderBy: { period: { year: 'asc' } } },
      },
    });

    const results: any[] = [];
    let totalDepreciation = new Decimal(0);

    await prisma.$transaction(async (tx) => {
      // Buscar cuentas de depreciación
      const cuentaDepreciacion = await tx.account.findFirst({
        where: { companyId, OR: [{ satGroupCode: '160' }, { code: '6060' }], isActive: true },
      });
      const cuentaDepAcumulada = await tx.account.findFirst({
        where: { companyId, OR: [{ satGroupCode: '161' }, { code: '1660' }], isActive: true },
      });

      for (const asset of activeAssets) {
        const acquisitionCost = new Decimal(asset.acquisitionCost.toString());
        const residualValue = new Decimal(asset.residualValue.toString());
        const depreciableBase = acquisitionCost.minus(residualValue);

        // Calcular meses transcurridos desde adquisición hasta este período
        const acqDate = new Date(asset.acquisitionDate);
        const periodDate = new Date(year, month - 1, 1);
        const monthsElapsed = (periodDate.getFullYear() - acqDate.getFullYear()) * 12
          + periodDate.getMonth() - acqDate.getMonth();

        if (monthsElapsed < 0 || monthsElapsed >= asset.usefulLifeMonths) {
          // Aún no inicia o ya terminó su vida útil
          continue;
        }

        // Calcular depreciación acumulada hasta este período
        const accumulatedSoFar = asset.depreciationSchedules.reduce((sum, s) => {
          return sum.plus(new Decimal(s.accountingDepreciation.toString()));
        }, new Decimal(0));

        // Valor en libros antes de este período
        const netBookValueBefore = acquisitionCost.minus(accumulatedSoFar);
        if (netBookValueBefore.lessThanOrEqualTo(residualValue)) continue;

        // Calcular depreciación del mes
        const monthlyDep = calcMonthlyDepreciation(
          asset.depreciationMethod,
          acquisitionCost,
          residualValue,
          asset.usefulLifeMonths,
          monthsElapsed,
          netBookValueBefore
        );

        // No depreciar más allá del valor residual
        const actualDep = netBookValueBefore.minus(residualValue).lessThan(monthlyDep)
          ? netBookValueBefore.minus(residualValue)
          : monthlyDep;

        const newAccumulated = accumulatedSoFar.plus(actualDep);
        const newNetBookValue = acquisitionCost.minus(newAccumulated);

        // Depreciación fiscal (Art. 34 LISR) — si tiene tasa SAT definida
        const satRate = asset.satDepreciationRate
          ? new Decimal(asset.satDepreciationRate.toString())
          : null;
        const fiscalDep = satRate
          ? acquisitionCost.mul(satRate).div(12).toDecimalPlaces(4)
          : actualDep;

        // Crear registro de depreciación
        const schedule = await tx.depreciationSchedule.create({
          data: {
            fixedAssetId: asset.id,
            companyId,
            periodId: period.id,
            accountingDepreciation: actualDep.toDecimalPlaces(4).toNumber(),
            fiscalDepreciation: fiscalDep.toDecimalPlaces(4).toNumber(),
            accumulatedAccounting: newAccumulated.toDecimalPlaces(4).toNumber(),
            netBookValue: newNetBookValue.toDecimalPlaces(4).toNumber(),
          },
        });

        // Actualizar estado si ya está totalmente depreciado
        if (newNetBookValue.lessThanOrEqualTo(residualValue.plus(0.01))) {
          await tx.fixedAsset.update({
            where: { id: asset.id },
            data: { status: 'FULLY_DEPRECIATED' },
          });
        }

        totalDepreciation = totalDepreciation.plus(actualDep);
        results.push({ assetId: asset.id, name: asset.name, depreciation: actualDep.toNumber(), netBookValue: newNetBookValue.toNumber() });

        // Generar póliza de depreciación si existen las cuentas
        if (cuentaDepreciacion && cuentaDepAcumulada) {
          const entry = await tx.journalEntry.create({
            data: {
              companyId, periodId: period.id,
              entryDate: new Date(year, month - 1, 1),
              description: `Depreciación ${asset.name} ${month}/${year}`,
              entryType: 'DEPRECIACION',
              sourceId: asset.id,
              sourceType: 'FIXED_ASSET',
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
                accountId: cuentaDepreciacion.id,
                debit: actualDep.toDecimalPlaces(4).toNumber(), credit: 0,
                description: `Depreciación ${asset.name}`, lineNumber: 1,
                currency: 'MXN', exchangeRate: 1,
                amountMxn: actualDep.toDecimalPlaces(4).toNumber(),
              },
              {
                entryId: entry.id, companyId,
                accountId: cuentaDepAcumulada.id,
                debit: 0, credit: actualDep.toDecimalPlaces(4).toNumber(),
                description: `Dep. acumulada ${asset.name}`, lineNumber: 2,
                currency: 'MXN', exchangeRate: 1,
                amountMxn: actualDep.toDecimalPlaces(4).toNumber(),
              },
            ],
          });

          await tx.depreciationSchedule.update({
            where: { id: schedule.id },
            data: { journalEntryId: entry.id },
          });
        }
      }
    }, { timeout: 60000 });

    return {
      message: `Depreciación calculada para ${results.length} activos`,
      data: { period: `${year}-${String(month).padStart(2, '0')}`, totalDepreciation: totalDepreciation.toNumber(), assets: results },
    };
  });
};

export default fixedAssetsRoutes;
