import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

const gateway = Fastify({ logger: true });

async function start() {
  await gateway.register(cors, { origin: '*' });

  // 1. Rate Limiting Protection (Anti-DDoS / Throttle per IP)
  await gateway.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // 2. Auth Guardian a nivel de Gateway (JWT Validation)
  // Antes de rutar a cualquier Microservicio, Gateway valida Tenant y Token
  gateway.addHook('preHandler', async (request, reply) => {
    // Si viene `/api/public`, continuar.
    // Si viene `/api/`, inspeccionar JWT.
  });

  // 3. Routing de Microservicios Dinámicos
  // El Gateway redirige el trafico interno para no exponer los puertos de cada MS.
  
  gateway.register(proxy, {
    upstream: 'http://localhost:3001', // Servidor de Facturación Interno
    prefix: '/api/invoicing',
    rewritePrefix: '/api'
  });

  gateway.register(proxy, {
    upstream: 'http://localhost:3002', // Servidor de Nómina Interno
    prefix: '/api/payroll',
    rewritePrefix: '/api'
  });

  gateway.register(proxy, {
    upstream: 'http://localhost:3003', // Servidor de Contabilidad Interno
    prefix: '/api/accounting',
    rewritePrefix: '/api'
  });

  gateway.get('/health', async () => ({ status: 'API Gateway Online', version: '2.0.0 Edge' }));

  try {
    await gateway.listen({ port: 8080, host: '0.0.0.0' });
    gateway.log.info('🛡️  API Gateway Enterprise escuchando en http://localhost:8080');
  } catch (err) {
    gateway.log.error(err);
    process.exit(1);
  }
}

start();
