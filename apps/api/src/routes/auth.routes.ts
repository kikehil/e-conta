import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === hash;
};

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // REGISTRO DE NUEVA EMPRESA (TENANT + COMPANY + ADMIN USER)
  fastify.post('/register', async (request, reply) => {
    const { companyName, rfc, userName, email, password } = request.body as any;

    try {
      // 1. Verificar si el correo ya existe
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return reply.code(400).send({ error: 'El correo ya está en uso' });

      // 2. Crear transacción atómica (Tenant + Company + User Admin)
      const result = await prisma.$transaction(async (tx: any) => {
        // Crear el Tenant (organización raíz)
        const tenant = await tx.tenant.create({
          data: {
            name: companyName,
            plan: 'starter',
            countryCode: 'MX',
          }
        });

        // Crear la Company (empresa fiscal)
        const company = await tx.company.create({
          data: {
            tenantId: tenant.id,
            rfc: rfc || 'XAXX010101000',
            razonSocial: companyName,
            nombreComercial: companyName,
            regimenFiscal: '601',
            codigoPostal: '00000',
          }
        });

        // Crear el usuario administrador
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            passwordHash: hashPassword(password),
            name: userName,
            role: 'ADMIN',
          }
        });

        return { tenant, company, user };
      });

      // 3. Generar token JWT multi-tenant
      const token = (fastify as any).jwt.sign({ 
        userId: result.user.id, 
        tenantId: result.tenant.id, 
        role: result.user.role 
      });

      return reply.code(201).send({
        token,
        user: { name: result.user.name, role: result.user.role, companyName: result.tenant.name }
      });
    } catch (error) {
       console.error('Registration error:', error);
       return reply.code(500).send({ error: 'Error al registrar el SaaS' });
    }
  });

  // LOGIN CLÁSICO
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    const token = (fastify as any).jwt.sign({ 
      userId: user.id, 
      tenantId: user.tenantId, 
      role: user.role 
    });

    return {
      token,
      user: { name: user.name, role: user.role, companyName: user.tenant?.name || 'Empresa' }
    };
  });
};

export default authRoutes;
