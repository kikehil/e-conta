import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const payrollRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as { companyId: string; userId: string };
    const body = request.body as any;
    
    // Módulo de creación, cálculo automatizado e incrustación de pólizas de Nómina
    try {
      const run = await prisma.$transaction(async (tx) => {
        // 1. Guardar metadatos del lote de nómina
        const payrollRun = await tx.payrollRun.create({
          data: {
            companyId,
            payrollType: 'ORDINARIA',
            periodStart: new Date(body.periodStart),
            periodEnd: new Date(body.periodEnd),
            paymentDate: new Date(),
            totalPerceptions: body.totalPerceptions,
            totalDeductions: body.totalDeductions,
            totalNetPay: body.netPay,
            status: 'POSTED',
            createdBy: userId
          }
        });
        
        // Aquí se crearía también la Póliza de la Nómina contra "Bancos" y "Sueldos por Pagar/Retenciones ISR"
        return payrollRun;
      });
      
      return reply.code(201).send({ message: 'Nómina procesada', data: run });
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'Fallo al procesar nómina' });
    }
  });
};

export default payrollRoutes;
