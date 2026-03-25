import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import invoiceRoutes from './routes/invoices.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import catalogRoutes from './routes/catalogs.routes.js';
import accountingRoutes from './routes/accounting.routes.js';

const buildApp = async () => {
  const app = Fastify({ logger: true });

  // 1. Módulo de Seguridad CORS
  await app.register(cors, {
    origin: '*', // En producción restringir a d:\WEB\e-conta\apps\web domain
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  });

  // 2. Módulo de Autenticación JWT (Multi-Tenant Decryption)
  await app.register(authPlugin);

  // 3. Health Check
  app.get('/', async (request, reply) => {
    return { status: 'Online', service: 'API Contasys - FastAPI Multi-Tenant Core' };
  });

  // 4. Registrar Rutas de Negocio
  app.register(invoiceRoutes, { prefix: '/api/invoices' });
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  app.register(payrollRoutes, { prefix: '/api/payroll' });
  app.register(catalogRoutes, { prefix: '/api/catalogs' });
  app.register(accountingRoutes, { prefix: '/api/accounting' });

  return app;
};

const start = async () => {
  const app = await buildApp();
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    app.log.info('🚀 Backend API SaaS ejecutándose y en escucha en http://0.0.0.0:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
