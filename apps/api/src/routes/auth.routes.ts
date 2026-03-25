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
  // REGISTRO DE NUEVA EMPRESA (TENANT CIUDADANO/ADMIN)
  fastify.post('/register', async (request, reply) => {
    const { companyName, rfc, userName, email, password } = request.body as any;

    try {
      // 1. Verificar si el correo ya existe
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return reply.code(400).send({ error: 'El correo ya está en uso' });

      // 2. Crear transacción atómica (Empresa + Dueño Administrador)
      const result = await prisma.$transaction(async (tx: any) => {
        const company = await tx.company.create({
          data: {
            name: companyName,
            rfc: rfc,
            taxRegime: '601', // Default, después se puede editar
            address: 'Configurar en perfil'
          }
        });

        const user = await tx.user.create({
          data: {
            email,
            passwordHash: hashPassword(password),
            name: userName,
            role: 'ADMIN',
            companyId: company.id
          }
        });

        return { company, user };
      });

      // 3. Generar token JWT hiper-seguro y multi-tenant
      const token = (fastify as any).jwt.sign({ 
        userId: result.user.id, 
        companyId: result.company.id, 
        role: result.user.role 
      });

      return reply.code(201).send({
        token,
        user: { name: result.user.name, role: result.user.role, companyName: result.company.name }
      });
    } catch (error) {
       console.error(error);
       return reply.code(500).send({ error: 'Error al registrar el SaaS' });
    }
  });

  // LOGIN CLÁSICO PARA CUALQUIER USUARIO (ADMIN/RRHH/CONTADOR)
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    const token = (fastify as any).jwt.sign({ 
      userId: user.id, 
      companyId: user.companyId, 
      role: user.role 
    });

    return {
      token,
      user: { name: user.name, role: user.role, companyName: user.company?.name || 'Empresa' }
    };
  });
};

export default authRoutes;
