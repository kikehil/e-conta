import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as { companyId: string };
    
    // Aquí en producción hariamos:
    // const income = await prisma.journalLine.aggregate({ where: { accountCode: '401', type: 'CREDIT' }, _sum: { amount: true } });
    
    return {
      status: 'success',
      data: {
        kpis: {
          ingresosFacturados: 285000,
          gastosDeducibles: 165000,
          ivaPagarEst: 19200,
          isrProvisional: 14580
        },
        chartData: [
          { month: 'Ene', ingresos: 180000, gastos: 120000 },
          { month: 'Feb', ingresos: 210000, gastos: 145000 },
          { month: 'Mar', ingresos: 195000, gastos: 130000 },
          { month: 'Abr', ingresos: 240000, gastos: 155000 },
          { month: 'May', ingresos: 285000, gastos: 165000 },
        ],
        transactions: [
          { id: '1', date: '24 May', desc: 'Pago de ISR Provisional - Abril', amount: -45200.00, status: 'Pagado' },
          { id: '2', date: '23 May', desc: 'Factura F-4092 Comercializadora SA', amount: 125000.00, status: 'Timbrado' }
        ]
      }
    };
  });
};

export default dashboardRoutes;
