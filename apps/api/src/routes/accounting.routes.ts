import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const accountingRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/financial-statements', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as { companyId: string };
    
    // MOCK: En producción haríamos query.aggregate sobre JournalLine basándonos en la jerarquía del Catálogo del SAT.
    // 100 ACTIVO, 200 PASIVO, 300 CAPITAL
    // 400 INGRESOS, 500 COSTOS, 600 GASTOS
    
    return {
      status: 'success',
      data: {
        balance: {
          activosCirculantes: 540000.50,
          activosFijos: 1200000.00,
          pasivosCortoPlazo: 215000.00,
          pasivosLargoPlazo: 400000.00,
          capitalSocial: 500000.00,
          utilidadesRetenidas: 625000.50
        },
        incomeStatement: {
          ingresosVentas: 380000.00,
          costoVentas: 120000.00,
          gastosOperacion: 85000.00,
          gastosFinancieros: 12000.00,
          utilidadNeta: 163000.00
        }
      }
    };
  });
};

export default accountingRoutes;
