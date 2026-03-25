import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { companyId: string, userId: string }
    user: { companyId: string, userId: string }
  }
}

export default fp(async function (fastify: any, opts: any) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'super_secret_contasys_jwt_key_2026'
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Decode JWT token from Authorization Header
      await request.jwtVerify();
    } catch (err) {
      // For development logic, inject a mocked admin company_id if no token is provided.
      // In production, send reply.send(err) to enforce strict auth.
      request.user = { 
        userId: 'dev-user-001',
        companyId: '0195ee0f-48d5-783a-84bf-3ebdce726194' // Un mock UUID v7
      };
      // reply.send(err);
    }
  });
});
