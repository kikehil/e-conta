import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { calculatePayrollSlip } from '@contasys/tax-calculator';
import { generatePayrollJournalEntry } from '../services/accounting.service.js';

const prisma = new PrismaClient();

// Días del período según tipo de nómina
const PERIOD_DAYS: Record<string, number> = {
  SEMANAL: 7,
  CATORCENAL: 14,
  QUINCENAL: 15,
  MENSUAL: 30,
  EXTRAORDINARIA: 0, // variable
  FINIQUITO: 0,
  LIQUIDACION: 0,
  PTU: 0,
  AGUINALDO: 0,
};

const PERIOD_TYPE_MAP: Record<string, 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL'> = {
  SEMANAL: 'SEMANAL',
  CATORCENAL: 'CATORCENAL',
  QUINCENAL: 'QUINCENAL',
  MENSUAL: 'MENSUAL',
};

const payrollRoutes: FastifyPluginAsync = async (fastify) => {

  // ================================================================
  // EMPLEADOS
  // ================================================================

  // ── GET /api/payroll/employees ─────────────────────────────────
  fastify.get('/employees', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;
    const { status } = request.query as any;

    const employees = await prisma.employee.findMany({
      where: { companyId, status: status || 'ACTIVE' },
      orderBy: { fullName: 'asc' },
    });

    return { data: employees };
  });

  // ── GET /api/payroll/employees/:id ────────────────────────────
  fastify.get('/employees/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        payrollSlips: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { payrollRun: { select: { payrollType: true, periodStart: true, periodEnd: true } } },
        },
      },
    });

    if (!employee) return reply.code(404).send({ error: 'Empleado no encontrado' });
    return { data: employee };
  });

  // ── POST /api/payroll/employees ───────────────────────────────
  fastify.post('/employees', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;

    const required = ['rfc', 'curp', 'fullName', 'hireDate', 'dailyWage', 'employmentType'];
    for (const field of required) {
      if (!body[field]) return reply.code(400).send({ error: `Campo obligatorio: ${field}` });
    }

    // Validar RFC (personas físicas: 13 chars)
    const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    if (!rfcRegex.test(body.rfc.toUpperCase())) {
      return reply.code(400).send({ error: 'RFC inválido. Formato: AAAA000000AAA' });
    }

    // Validar CURP (18 chars)
    const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/;
    if (!curpRegex.test(body.curp.toUpperCase())) {
      return reply.code(400).send({ error: 'CURP inválida' });
    }

    const dailyWage = new Decimal(body.dailyWage);
    const integrationFactor = new Decimal(body.integrationFactor || 1.0452);
    const sdi = dailyWage.mul(integrationFactor).toDecimalPlaces(4);

    try {
      const employee = await prisma.employee.create({
        data: {
          companyId,
          rfc: body.rfc.toUpperCase(),
          curp: body.curp.toUpperCase(),
          nss: body.nss || null,
          fullName: body.fullName,
          email: body.email || null,
          hireDate: new Date(body.hireDate),
          employmentType: body.employmentType,
          workShift: body.workShift || null,
          dailyWage: dailyWage.toDecimalPlaces(4).toNumber(),
          sdi: sdi.toNumber(),
          integrationFactor: integrationFactor.toDecimalPlaces(6).toNumber(),
          imssRiskClass: Number(body.imssRiskClass || 1),
          jobTitle: body.jobTitle || null,
          bankClabe: body.bankClabe || null,
          status: 'ACTIVE',
        },
      });

      return reply.code(201).send({ message: 'Empleado creado', data: employee });
    } catch (err: any) {
      if (err.code === 'P2002') return reply.code(400).send({ error: 'Ya existe un empleado con ese RFC en esta empresa' });
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── PUT /api/payroll/employees/:id ────────────────────────────
  fastify.put('/employees/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;
    const body = request.body as any;

    const employee = await prisma.employee.findFirst({ where: { id, companyId } });
    if (!employee) return reply.code(404).send({ error: 'Empleado no encontrado' });

    const dailyWage = body.dailyWage ? new Decimal(body.dailyWage) : new Decimal(employee.dailyWage.toString());
    const integrationFactor = body.integrationFactor ? new Decimal(body.integrationFactor) : new Decimal(employee.integrationFactor.toString());
    const sdi = dailyWage.mul(integrationFactor).toDecimalPlaces(4);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        fullName: body.fullName ?? employee.fullName,
        email: body.email ?? employee.email,
        jobTitle: body.jobTitle ?? employee.jobTitle,
        dailyWage: dailyWage.toDecimalPlaces(4).toNumber(),
        sdi: sdi.toNumber(),
        integrationFactor: integrationFactor.toDecimalPlaces(6).toNumber(),
        imssRiskClass: body.imssRiskClass != null ? Number(body.imssRiskClass) : employee.imssRiskClass,
        workShift: body.workShift ?? employee.workShift,
        bankClabe: body.bankClabe ?? employee.bankClabe,
        status: body.status ?? employee.status,
        terminationDate: body.terminationDate ? new Date(body.terminationDate) : employee.terminationDate,
      },
    });

    return { data: updated };
  });

  // ================================================================
  // CORRIDAS DE NÓMINA
  // ================================================================

  // ── GET /api/payroll/runs ─────────────────────────────────────
  fastify.get('/runs', { onRequest: [fastify.authenticate] }, async (request) => {
    const { companyId } = request.user as any;

    const runs = await prisma.payrollRun.findMany({
      where: { companyId },
      include: { _count: { select: { slips: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { data: runs };
  });

  // ── GET /api/payroll/runs/:id ─────────────────────────────────
  fastify.get('/runs/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: {
        slips: {
          include: { employee: { select: { fullName: true, rfc: true, jobTitle: true } } },
        },
      },
    });

    if (!run) return reply.code(404).send({ error: 'Corrida de nómina no encontrada' });
    return { data: run };
  });

  // ── POST /api/payroll/runs — Crear corrida ────────────────────
  fastify.post('/runs', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    const required = ['payrollType', 'periodStart', 'periodEnd', 'paymentDate'];
    for (const field of required) {
      if (!body[field]) return reply.code(400).send({ error: `Campo obligatorio: ${field}` });
    }

    const validTypes = ['SEMANAL', 'CATORCENAL', 'QUINCENAL', 'MENSUAL', 'EXTRAORDINARIA', 'FINIQUITO', 'LIQUIDACION', 'PTU', 'AGUINALDO'];
    if (!validTypes.includes(body.payrollType)) {
      return reply.code(400).send({ error: `payrollType inválido. Opciones: ${validTypes.join(', ')}` });
    }

    const run = await prisma.payrollRun.create({
      data: {
        companyId,
        payrollType: body.payrollType,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        paymentDate: new Date(body.paymentDate),
        status: 'DRAFT',
        createdBy: userId,
      },
    });

    return reply.code(201).send({ message: 'Corrida de nómina creada. Ejecuta /calculate para procesar.', data: run });
  });

  // ── POST /api/payroll/runs/:id/calculate — Calcular nómina ────
  fastify.post('/runs/:id/calculate', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, userId } = request.user as any;
    const body = request.body as any;
    // body.employeeIds?: string[] — si se omite, calcula todos los activos

    const run = await prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) return reply.code(404).send({ error: 'Corrida no encontrada' });
    if (!['DRAFT', 'CALCULATED'].includes(run.status)) {
      return reply.code(400).send({ error: `No se puede calcular en estado: ${run.status}` });
    }

    const employeeFilter: any = { companyId, status: 'ACTIVE' };
    if (body.employeeIds?.length) employeeFilter.id = { in: body.employeeIds };

    const employees = await prisma.employee.findMany({ where: employeeFilter });
    if (employees.length === 0) return reply.code(400).send({ error: 'No hay empleados activos' });

    const periodType = PERIOD_TYPE_MAP[run.payrollType] || 'QUINCENAL';
    const daysInPeriod = body.daysInPeriod ?? PERIOD_DAYS[run.payrollType] ?? 15;

    const slipsData: any[] = [];
    let runTotals = {
      totalPerceptions: new Decimal(0),
      totalDeductions: new Decimal(0),
      totalNetPay: new Decimal(0),
      totalIsrWithheld: new Decimal(0),
      totalImssEmployee: new Decimal(0),
      totalImssEmployer: new Decimal(0),
      totalInfonavit: new Decimal(0),
    };

    for (const emp of employees) {
      const dailyWage = new Decimal(emp.dailyWage.toString());
      const sdi = new Decimal(emp.sdi.toString());

      const calc = calculatePayrollSlip({
        employeeId: emp.id,
        fullName: emp.fullName,
        dailyWage,
        sdi,
        daysInPeriod,
        periodType,
        imssRiskClass: emp.imssRiskClass,
        horasExtraDobles: body.horasExtra?.[emp.id]
          ? new Decimal(body.horasExtra[emp.id])
          : new Decimal(0),
        primaVacacional: body.primaVacacional?.[emp.id]
          ? new Decimal(body.primaVacacional[emp.id])
          : new Decimal(0),
        otrasExentas: body.otrasExentas?.[emp.id]
          ? new Decimal(body.otrasExentas[emp.id])
          : new Decimal(0),
        otrasGravadas: body.otrasGravadas?.[emp.id]
          ? new Decimal(body.otrasGravadas[emp.id])
          : new Decimal(0),
      });

      slipsData.push({
        employeeId: emp.id,
        calc,
      });

      runTotals.totalPerceptions = runTotals.totalPerceptions.plus(calc.totalPerceptions);
      runTotals.totalDeductions = runTotals.totalDeductions.plus(calc.totalDeductions);
      runTotals.totalNetPay = runTotals.totalNetPay.plus(calc.netPay);
      runTotals.totalIsrWithheld = runTotals.totalIsrWithheld.plus(calc.isr.isrNet);
      runTotals.totalImssEmployee = runTotals.totalImssEmployee.plus(calc.imss.totalObrero);
      runTotals.totalImssEmployer = runTotals.totalImssEmployer.plus(calc.imss.totalPatron);
      runTotals.totalInfonavit = runTotals.totalInfonavit.plus(calc.imss.infonavit);
    }

    await prisma.$transaction(async (tx) => {
      // Eliminar slips anteriores si se recalcula
      await tx.payrollSlip.deleteMany({ where: { payrollRunId: id } });

      // Crear todos los slips
      for (const { employeeId, calc } of slipsData) {
        await tx.payrollSlip.create({
          data: {
            payrollRunId: id,
            companyId,
            employeeId,
            perceptions: calc.perceptions.map((p: any) => ({
              clave: p.clave,
              tipo: p.tipo,
              descripcion: p.descripcion,
              importeExento: p.importeExento.toNumber(),
              importeGravado: p.importeGravado.toNumber(),
            })),
            deductions: calc.deductions.map((d: any) => ({
              clave: d.clave,
              descripcion: d.descripcion,
              importe: d.importe.toNumber(),
            })),
            otherPayments: calc.otherPayments.map((o: any) => ({
              clave: o.clave,
              descripcion: o.descripcion,
              importe: o.importe.toNumber(),
            })),
            totalPerceptions: calc.totalPerceptions.toDecimalPlaces(4).toNumber(),
            totalDeductions: calc.totalDeductions.toDecimalPlaces(4).toNumber(),
            netPay: calc.netPay.toDecimalPlaces(4).toNumber(),
            isrBase: calc.totalPercepcionesGravadas.toDecimalPlaces(4).toNumber(),
            isrWithheld: calc.isr.isrBeforeSubsidy.toDecimalPlaces(4).toNumber(),
            subsidyForEmployment: calc.isr.employmentSubsidy.toDecimalPlaces(4).toNumber(),
            isrNet: calc.isr.isrNet.toDecimalPlaces(4).toNumber(),
            imssEmployee: calc.imss.totalObrero.toDecimalPlaces(4).toNumber(),
            imssEmployer: calc.imss.totalPatron.toDecimalPlaces(4).toNumber(),
            infonavit: calc.imss.infonavit.toDecimalPlaces(4).toNumber(),
            status: 'DRAFT',
          },
        });
      }

      // Actualizar totales de la corrida
      await tx.payrollRun.update({
        where: { id },
        data: {
          totalPerceptions: runTotals.totalPerceptions.toDecimalPlaces(4).toNumber(),
          totalDeductions: runTotals.totalDeductions.toDecimalPlaces(4).toNumber(),
          totalNetPay: runTotals.totalNetPay.toDecimalPlaces(4).toNumber(),
          totalIsrWithheld: runTotals.totalIsrWithheld.toDecimalPlaces(4).toNumber(),
          totalImssEmployee: runTotals.totalImssEmployee.toDecimalPlaces(4).toNumber(),
          totalImssEmployer: runTotals.totalImssEmployer.toDecimalPlaces(4).toNumber(),
          totalInfonavit: runTotals.totalInfonavit.toDecimalPlaces(4).toNumber(),
          status: 'CALCULATED',
        },
      });
    }, { timeout: 60000 });

    return {
      message: `Nómina calculada para ${slipsData.length} empleados`,
      data: {
        runId: id,
        employeesProcessed: slipsData.length,
        totals: {
          totalPerceptions: runTotals.totalPerceptions.toNumber(),
          totalDeductions: runTotals.totalDeductions.toNumber(),
          totalNetPay: runTotals.totalNetPay.toNumber(),
          totalIsrWithheld: runTotals.totalIsrWithheld.toNumber(),
          totalImssEmployee: runTotals.totalImssEmployee.toNumber(),
          totalImssEmployer: runTotals.totalImssEmployer.toNumber(),
          totalInfonavit: runTotals.totalInfonavit.toNumber(),
        },
      },
    };
  });

  // ── POST /api/payroll/runs/:id/approve — Aprobar nómina ───────
  fastify.post('/runs/:id/approve', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, userId } = request.user as any;

    const run = await prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) return reply.code(404).send({ error: 'Corrida no encontrada' });
    if (run.status !== 'CALCULATED') {
      return reply.code(400).send({ error: `Debes calcular la nómina primero. Estado actual: ${run.status}` });
    }

    await prisma.$transaction(async (tx) => {
      // Generar póliza contable de nómina
      const journalEntryId = await generatePayrollJournalEntry(tx, {
        id: run.id,
        companyId,
        periodStart: new Date(run.periodStart),
        totalPerceptions: run.totalPerceptions,
        totalIsrWithheld: run.totalIsrWithheld,
        totalImssEmployee: run.totalImssEmployee,
        totalImssEmployer: run.totalImssEmployer,
        totalInfonavit: run.totalInfonavit,
        totalNetPay: run.totalNetPay,
        createdBy: userId,
      });

      await tx.payrollRun.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          journalEntryId,
        },
      });

      // Marcar slips como aprobados
      await tx.payrollSlip.updateMany({
        where: { payrollRunId: id },
        data: { status: 'APPROVED' },
      });
    }, { timeout: 30000 });

    return { message: 'Nómina aprobada y póliza contable generada', data: { runId: id } };
  });

  // ── POST /api/payroll/runs/:id/stamp — Timbrar CFDI Nómina ────
  // (Placeholder — requiere complemento NóminaV1.2 en packages/cfdi)
  fastify.post('/runs/:id/stamp', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.user as any;

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { slips: { include: { employee: true } } },
    });
    if (!run) return reply.code(404).send({ error: 'Corrida no encontrada' });
    if (run.status !== 'APPROVED') {
      return reply.code(400).send({ error: 'La nómina debe estar aprobada antes de timbrar' });
    }

    // En producción: iterar slips, generar XML CFDI tipo N con Complemento NóminaV1.2
    // y llamar al PAC para cada empleado (o en lote si el PAC lo soporta)
    // Por ahora marcamos como STAMPED con UUID mock para demostración
    const stampedUuids: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const slip of run.slips) {
        const mockUuid = crypto.randomUUID();
        await tx.payrollSlip.update({
          where: { id: slip.id },
          data: {
            status: 'STAMPED',
            satUuid: mockUuid,
            xmlUrl: `mock://cfdi/nomina/${mockUuid}.xml`,
          },
        });
        stampedUuids.push({ employeeId: slip.employeeId, name: slip.employee.fullName, uuid: mockUuid });
      }

      await tx.payrollRun.update({ where: { id }, data: { status: 'STAMPED' } });
    }, { timeout: 60000 });

    return {
      message: `${stampedUuids.length} recibos de nómina timbrados`,
      data: { runId: id, slips: stampedUuids },
    };
  });
};

export default payrollRoutes;
