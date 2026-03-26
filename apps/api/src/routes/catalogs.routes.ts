import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const catalogRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // --- TERCEROS (Clientes / Proveedores) ---
  
  fastify.get('/third-parties', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { type } = request.query as any; // CUSTOMER, SUPPLIER, BOTH
    
    const where: any = { companyId };
    if (type) where.partyType = type;

    const parties = await prisma.thirdParty.findMany({
      where,
      orderBy: { razonSocial: 'asc' }
    });
    return { data: parties };
  });

  fastify.post('/third-parties', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;
    
    const party = await prisma.thirdParty.create({
      data: {
        companyId,
        rfc: body.rfc,
        razonSocial: body.razonSocial,
        regimenFiscal: body.regimenFiscal || null,
        usoCfdi: body.usoCfdi || 'G03',
        codigoPostal: body.codigoPostal || null,
        partyType: body.partyType || 'CUSTOMER', // CUSTOMER, SUPPLIER, BOTH
        isForeign: body.isForeign || false,
        email: body.email || null,
        phone: body.phone || null,
        creditLimit: body.creditLimit || null,
        creditDays: body.creditDays || 0,
        diotType: body.diotType || null,
      }
    });
    return reply.code(201).send({ data: party });
  });

  fastify.put('/third-parties/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    
    const party = await prisma.thirdParty.update({
      where: { id },
      data: {
        rfc: body.rfc,
        razonSocial: body.razonSocial,
        regimenFiscal: body.regimenFiscal,
        usoCfdi: body.usoCfdi,
        codigoPostal: body.codigoPostal,
        partyType: body.partyType,
        email: body.email,
        phone: body.phone,
      }
    });
    return { data: party };
  });
};

export default catalogRoutes;
