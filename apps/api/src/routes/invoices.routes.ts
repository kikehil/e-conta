import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { generateInvoiceJournalEntry } from '../services/accounting.service.js';

const prisma = new PrismaClient();

const invoiceRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // GET /api/invoices
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as { companyId: string };
    
    // Obtenemos solo facturas del tenant validado con JWT
    const invoices = await prisma.invoice.findMany({
      where: { companyId },
      include: {
        lines: true
      },
      orderBy: { issuedAt: 'desc' },
      take: 50
    });
    
    return { data: invoices };
  });

  // POST /api/invoices
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId, userId } = request.user as { companyId: string; userId: string };
    const body = request.body as any; // Usar TypeProviders o JSON Schemas en iteraciones futuras

    try {
      // Inserción Atómica Multi-Tabla en Postgres (Factura + Conceptos)
      const newInvoice = await prisma.$transaction(async (tx) => {
        
        // 1. Crear el CFDI "Draft" en tabla Invoices
        const invoice = await tx.invoice.create({
          data: {
            companyId,
            documentType: body.documentType || 'INGRESO',
            type: body.type || 'CUSTOMER', // Factura de cliente
            status: 'DRAFT', // Pendiente de Timbrar
            issuerRfc: body.issuerRfc,
            issuerName: body.issuerName,
            receiverRfc: body.receiverRfc,
            receiverName: body.receiverName,
            subtotal: body.subtotal,
            totalIva: body.totalIva,
            total: body.total,
            currency: 'MXN',
            paymentMethod: body.paymentMethod || 'PUE',
            paymentForm: body.paymentForm || '03',
            cfdiUse: body.cfdiUse || 'G03',
            createdBy: userId || 'SYSTEM',
            // Agrega las lineas de la factura (Conceptos) como hijos amarrados por FK
            lines: {
              create: body.conceptos.map((c: any) => ({
                satProductCode: c.claveProdServ,
                satUnitCode: c.claveUnidad,
                description: c.descripcion,
                quantity: c.cantidad,
                unitPrice: c.valorUnitario,
                subtotal: c.importe,
                ivaRate: c.tasaIva,
                ivaAmount: c.ivaAmount || 0,
                total: c.importeTotal || 0,
                taxObject: c.objetoImp
              }))
            }
          },
          include: { lines: true } // Para regresarlo en la respuesta
        });

        // 2. GENERADOR DE PÓLIZAS AUTOMÁTICO - Contabilidad Electrónica NIF
        // El motor evalúa PUE/PPD y monta los UUIDs contables.
        await generateInvoiceJournalEntry(tx, invoice);

        return invoice;
      });

      return reply.code(201).send({ 
        message: 'CFDI Draft creado exitosamente localmente.', 
        data: newInvoice 
      });

    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Fallo al insertar la factura en la Base de Datos.' });
    }
  });
};

export default invoiceRoutes;
