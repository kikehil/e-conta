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

  // --- PRODUCTOS / SERVICIOS ---

  fastify.get('/products', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { q } = request.query as any;

    const where: any = { companyId, isActive: true };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { productServiceKey: { contains: q } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return { data: products };
  });

  fastify.post('/products', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;

    if (!body.name || !body.productServiceKey || !body.unitKey) {
      return reply.code(400).send({ error: 'Campos obligatorios: name, productServiceKey, unitKey' });
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        sku: body.sku || null,
        name: body.name,
        description: body.description || null,
        productServiceKey: body.productServiceKey,
        unitKey: body.unitKey,
        unitName: body.unitName || null,
        productType: body.productType || 'SERVICIO',
        unitCost: body.unitCost || 0,
        salePrice: body.salePrice || 0,
        vatRate: body.vatRate ?? 0.16,
        vatExempt: body.vatExempt || false,
        iepsRate: body.iepsRate || 0,
        trackInventory: body.trackInventory || false,
        costingMethod: body.costingMethod || 'PROMEDIO',
      }
    });
    return reply.code(201).send({ data: product });
  });

  fastify.put('/products/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        sku: body.sku,
        salePrice: body.salePrice,
        unitCost: body.unitCost,
        vatRate: body.vatRate,
        vatExempt: body.vatExempt,
        isActive: body.isActive,
        description: body.description,
      }
    });
    return { data: product };
  });
};

export default catalogRoutes;
