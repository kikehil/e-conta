import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import invoiceRoutes from './routes/invoices.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import catalogRoutes from './routes/catalogs.routes.js';
import accountingRoutes from './routes/accounting.routes.js';
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/accounts.routes.js';
import journalRoutes from './routes/journal.routes.js';
import billsRoutes from './routes/bills.routes.js';
import paymentComplementRoutes from './routes/payment-complements.routes.js';
import fixedAssetsRoutes from './routes/fixed-assets.routes.js';
import banksRoutes from './routes/banks.routes.js';
import taxesRoutes from './routes/taxes.routes.js';

const buildApp = async () => {
  const app = Fastify({ logger: true });

  // 1. CORS — En producción restringir al dominio del frontend
  await app.register(cors, {
    origin: process.env.WEB_BASE_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 2. Autenticación JWT (Multi-Tenant)
  await app.register(authPlugin);

  // 3. Health Check
  app.get('/', async () => ({
    status: 'OK',
    service: 'ContaSys API v1 — Sistema Contable SaaS México',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // 4. Rutas de negocio
  // Auth & Acceso
  app.register(authRoutes,   { prefix: '/api/auth' });

  // Contabilidad
  app.register(accountRoutes,    { prefix: '/api/accounts' });
  app.register(journalRoutes,    { prefix: '/api/journal' });
  app.register(accountingRoutes, { prefix: '/api/accounting' });

  // CFDI & Facturación
  app.register(invoiceRoutes,           { prefix: '/api/invoices' });
  app.register(billsRoutes,             { prefix: '/api/bills' });
  app.register(paymentComplementRoutes, { prefix: '/api/payment-complements' });

  // Nómina
  app.register(payrollRoutes, { prefix: '/api/payroll' });

  // Tesorería & Bancos
  app.register(banksRoutes, { prefix: '/api/banks' });

  // Activos Fijos
  app.register(fixedAssetsRoutes, { prefix: '/api/fixed-assets' });

  // Impuestos & DIOT
  app.register(taxesRoutes, { prefix: '/api/taxes' });

  // Catálogos & Dashboard
  app.register(catalogRoutes,   { prefix: '/api/catalogs' });
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });

  return app;
};

const start = async () => {
  const app = await buildApp();
  try {
    const port = Number(process.env.PORT) || 8080;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`🚀 ContaSys API ejecutándose en http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
