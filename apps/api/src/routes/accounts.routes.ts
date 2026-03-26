import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const accountRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // GET /api/accounts — Listar catálogo de cuentas de la empresa
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const accounts = await prisma.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' }
    });
    return { data: accounts };
  });

  // POST /api/accounts — Crear cuenta contable
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const body = request.body as any;
    
    try {
      const account = await prisma.account.create({
        data: {
          companyId,
          parentId: body.parentId || null,
          code: body.code,
          name: body.name,
          accountType: body.accountType, // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
          nature: body.nature, // DEBIT or CREDIT
          level: body.level || 1,
          allowsEntries: body.allowsEntries !== false,
          satGroupCode: body.satGroupCode || null,
          currency: body.currency || 'MXN',
          isBankAccount: body.isBankAccount || false,
        }
      });
      return reply.code(201).send({ data: account });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: `La cuenta ${body.code} ya existe` });
      }
      throw error;
    }
  });

  // PUT /api/accounts/:id — Editar cuenta
  fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: body.name,
        accountType: body.accountType,
        nature: body.nature,
        allowsEntries: body.allowsEntries,
        satGroupCode: body.satGroupCode,
        isActive: body.isActive,
      }
    });
    return { data: account };
  });

  // DELETE /api/accounts/:id — Desactivar cuenta
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;
    const { id } = request.params as { id: string };
    
    await prisma.account.update({
      where: { id },
      data: { isActive: false }
    });
    return { message: 'Cuenta desactivada' };
  });

  // POST /api/accounts/seed-sat — Cargar catálogo SAT base
  fastify.post('/seed-sat', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { companyId } = request.user as any;

    // Verificar si ya tiene cuentas
    const existing = await prisma.account.count({ where: { companyId } });
    if (existing > 0) {
      return reply.code(400).send({ error: 'Ya existen cuentas. Elimina el catálogo primero.' });
    }

    // Catálogo SAT básico nivel 1-2 (NIF)
    const satAccounts = [
      // ACTIVO
      { code: '100', name: 'Activo', accountType: 'ASSET', nature: 'DEBIT', level: 1, satGroupCode: '100' },
      { code: '110', name: 'Activo Circulante', accountType: 'ASSET', nature: 'DEBIT', level: 2, satGroupCode: '110' },
      { code: '110.01', name: 'Caja', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '110.01', allowsEntries: true },
      { code: '110.02', name: 'Bancos', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '110.02', allowsEntries: true },
      { code: '110.03', name: 'Inversiones Temporales', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '110.03', allowsEntries: true },
      { code: '120', name: 'Cuentas por Cobrar', accountType: 'ASSET', nature: 'DEBIT', level: 2, satGroupCode: '120' },
      { code: '120.01', name: 'Clientes Nacionales', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '120.01', allowsEntries: true },
      { code: '120.02', name: 'Clientes Extranjeros', accountType: 'ASSET', nature: 'DEBIT', level: 2, satGroupCode: '120.02', allowsEntries: true },
      { code: '130', name: 'Inventarios', accountType: 'ASSET', nature: 'DEBIT', level: 2, satGroupCode: '130' },
      { code: '150', name: 'Activo Fijo', accountType: 'ASSET', nature: 'DEBIT', level: 2, satGroupCode: '150' },
      { code: '150.01', name: 'Terrenos', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '150.01', allowsEntries: true },
      { code: '150.02', name: 'Edificios', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '150.02', allowsEntries: true },
      { code: '150.03', name: 'Maquinaria y Equipo', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '150.03', allowsEntries: true },
      { code: '150.04', name: 'Equipo de Transporte', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '150.04', allowsEntries: true },
      { code: '150.05', name: 'Equipo de Cómputo', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '150.05', allowsEntries: true },
      { code: '160', name: 'Depreciación Acumulada', accountType: 'ASSET', nature: 'CREDIT', level: 2, satGroupCode: '160' },
      // PASIVO
      { code: '200', name: 'Pasivo', accountType: 'LIABILITY', nature: 'CREDIT', level: 1, satGroupCode: '200' },
      { code: '210', name: 'Pasivo a Corto Plazo', accountType: 'LIABILITY', nature: 'CREDIT', level: 2, satGroupCode: '210' },
      { code: '210.01', name: 'Proveedores Nacionales', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '210.01', allowsEntries: true },
      { code: '210.02', name: 'Proveedores Extranjeros', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '210.02', allowsEntries: true },
      { code: '216', name: 'Impuestos por Pagar', accountType: 'LIABILITY', nature: 'CREDIT', level: 2, satGroupCode: '216' },
      { code: '216.01', name: 'IVA Trasladado', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '216.01', allowsEntries: true },
      { code: '216.02', name: 'ISR por Pagar', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '216.02', allowsEntries: true },
      { code: '216.03', name: 'IVA por Pagar', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '216.03', allowsEntries: true },
      { code: '216.10', name: 'IVA Acreditable', accountType: 'ASSET', nature: 'DEBIT', level: 3, satGroupCode: '216.10', allowsEntries: true },
      { code: '220', name: 'Pasivo a Largo Plazo', accountType: 'LIABILITY', nature: 'CREDIT', level: 2, satGroupCode: '220' },
      { code: '220.01', name: 'Acreedores Diversos LP', accountType: 'LIABILITY', nature: 'CREDIT', level: 3, satGroupCode: '220.01', allowsEntries: true },
      // CAPITAL
      { code: '300', name: 'Capital Contable', accountType: 'EQUITY', nature: 'CREDIT', level: 1, satGroupCode: '300' },
      { code: '301', name: 'Capital Social', accountType: 'EQUITY', nature: 'CREDIT', level: 2, satGroupCode: '301', allowsEntries: true },
      { code: '304', name: 'Utilidades Acumuladas', accountType: 'EQUITY', nature: 'CREDIT', level: 2, satGroupCode: '304', allowsEntries: true },
      { code: '305', name: 'Resultado del Ejercicio', accountType: 'EQUITY', nature: 'CREDIT', level: 2, satGroupCode: '305', allowsEntries: true },
      // INGRESOS
      { code: '400', name: 'Ingresos', accountType: 'REVENUE', nature: 'CREDIT', level: 1, satGroupCode: '400' },
      { code: '401', name: 'Ingresos por Ventas', accountType: 'REVENUE', nature: 'CREDIT', level: 2, satGroupCode: '401', allowsEntries: true },
      { code: '402', name: 'Ingresos por Servicios', accountType: 'REVENUE', nature: 'CREDIT', level: 2, satGroupCode: '402', allowsEntries: true },
      { code: '403', name: 'Otros Ingresos', accountType: 'REVENUE', nature: 'CREDIT', level: 2, satGroupCode: '403', allowsEntries: true },
      // COSTOS
      { code: '500', name: 'Costos', accountType: 'EXPENSE', nature: 'DEBIT', level: 1, satGroupCode: '500' },
      { code: '501', name: 'Costo de Ventas', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '501', allowsEntries: true },
      // GASTOS
      { code: '600', name: 'Gastos', accountType: 'EXPENSE', nature: 'DEBIT', level: 1, satGroupCode: '600' },
      { code: '601', name: 'Gastos de Operación', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '601', allowsEntries: true },
      { code: '602', name: 'Gastos de Administración', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '602', allowsEntries: true },
      { code: '603', name: 'Gastos Financieros', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '603', allowsEntries: true },
      { code: '610', name: 'Sueldos y Salarios', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '610', allowsEntries: true },
      { code: '611', name: 'Cuotas IMSS Patronal', accountType: 'EXPENSE', nature: 'DEBIT', level: 2, satGroupCode: '611', allowsEntries: true },
    ];

    const created = await prisma.$transaction(
      satAccounts.map(acc => prisma.account.create({
        data: { companyId, ...acc, allowsEntries: acc.allowsEntries || false }
      })),
      { timeout: 30000 }
    );

    return reply.code(201).send({ 
      message: `Catálogo SAT cargado: ${created.length} cuentas creadas`,
      data: created 
    });
  });
};

export default accountRoutes;
