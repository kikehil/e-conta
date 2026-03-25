import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const catalogRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // --- CLIENTES (ThirdParties) ---
  
  fastify.get('/clients', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as { companyId: string };
    const clients = await prisma.thirdParty.findMany({
      where: { companyId, type: 'CUSTOMER' },
      orderBy: { businessName: 'asc' }
    });
    return { data: clients };
  });

  fastify.post('/clients', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as { companyId: string; userId: string };
    const body: any = request.body;
    const client = await prisma.thirdParty.create({
      data: {
        companyId,
        type: 'CUSTOMER',
        rfc: body.rfc,
        businessName: body.businessName,
        taxRegime: body.taxRegime,
        zipCode: body.zipCode,
        createdBy: userId
      }
    });
    return reply.code(201).send({ data: client });
  });

  // --- PRODUCTOS Y SERVICIOS ---

  fastify.get('/products', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as { companyId: string };
    const products = await prisma.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });
    return { data: products };
  });

  fastify.post('/products', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as { companyId: string; userId: string };
    const body: any = request.body;
    const product = await prisma.product.create({
      data: {
        companyId,
        type: body.type || 'SERVICE',
        code: body.code, // ClaveProdServ SAT (E.g. 84111506)
        name: body.name,
        description: body.description,
        unitCode: body.unitCode || 'E48', // ClaveUnidad SAT
        defaultPrice: body.defaultPrice,
        taxObject: body.taxObject || '02',
        createdBy: userId
      }
    });
    return reply.code(201).send({ data: product });
  });
};

export default catalogRoutes;
