import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const journalRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // GET /api/journal — Listar pólizas del período
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { year, month } = request.query as any;

    const where: any = { companyId };
    if (year && month) {
      const periodStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const periodEnd = new Date(parseInt(year), parseInt(month), 0);
      where.entryDate = { gte: periodStart, lte: periodEnd };
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
      orderBy: { entryDate: 'desc' },
      take: 100
    });
    return { data: entries };
  });

  // GET /api/journal/:id — Detalle de póliza
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { orderBy: { lineNumber: 'asc' } } }
    });
    if (!entry) return reply.code(404).send({ error: 'Póliza no encontrada' });
    return { data: entry };
  });

  // POST /api/journal — Crear póliza con líneas
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as any;
    const body = request.body as any;

    // Validar cuadre: suma de débitos = suma de créditos
    const totalDebit = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = body.lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return reply.code(400).send({ 
        error: `La póliza no cuadra. Débitos: $${totalDebit.toFixed(2)}, Créditos: $${totalCredit.toFixed(2)}` 
      });
    }

    try {
      // Buscar o crear el período fiscal
      const entryDate = new Date(body.entryDate);
      const year = entryDate.getFullYear();
      const month = entryDate.getMonth() + 1;

      let fiscalYear = await prisma.fiscalYear.findFirst({ where: { companyId, year } });
      if (!fiscalYear) {
        fiscalYear = await prisma.fiscalYear.create({ data: { companyId, year, status: 'OPEN' } });
      }

      let period = await prisma.period.findFirst({ where: { companyId, year, month } });
      if (!period) {
        period = await prisma.period.create({
          data: { companyId, fiscalYearId: fiscalYear.id, year, month, status: 'OPEN' }
        });
      }

      const entry = await prisma.journalEntry.create({
        data: {
          companyId,
          periodId: period.id,
          entryDate: entryDate,
          reference: body.reference || null,
          description: body.description,
          entryType: body.entryType || 'DIARIO', // DIARIO, INGRESO, EGRESO, NOMINA
          status: 'DRAFT',
          createdBy: userId,
          lines: {
            create: body.lines.map((l: any, i: number) => ({
              companyId,
              accountId: l.accountId,
              debit: parseFloat(l.debit) || 0,
              credit: parseFloat(l.credit) || 0,
              description: l.description || '',
              lineNumber: i + 1,
              currency: l.currency || 'MXN',
              exchangeRate: l.exchangeRate || 1,
              amountMxn: parseFloat(l.debit) || parseFloat(l.credit) || 0,
            }))
          }
        },
        include: { lines: true }
      }, );

      return reply.code(201).send({ data: entry });
    } catch (error: any) {
      console.error('Journal entry error:', error);
      return reply.code(500).send({ error: 'Error al crear la póliza contable' });
    }
  });

  // PUT /api/journal/:id/post — Publicar/Aplicar póliza
  fastify.put('/:id/post', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as { id: string };
    
    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedBy: userId, postedAt: new Date() }
    });
    return { data: entry };
  });
};

export default journalRoutes;
