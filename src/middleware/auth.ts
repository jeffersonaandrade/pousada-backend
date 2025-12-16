import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';

// Interface para usuário autenticado
export interface AuthenticatedUser {
  id: number;
  nome: string;
  cargo: string;
}

// Extende o tipo do Fastify para incluir o usuário
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Middleware de autenticação usando JWT
 * Verifica o token JWT no header Authorization
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Token de autenticação não fornecido', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const payload = verifyToken(token);

    // Verifica se o usuário ainda existe e está ativo
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.userId, ativo: true },
    });

    if (!usuario) {
      throw new AppError('Usuário não encontrado ou inativo', 401, 'UNAUTHORIZED');
    }

    // Adiciona usuário ao request
    request.user = {
      id: usuario.id,
      nome: usuario.nome,
      cargo: usuario.cargo,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Token inválido ou expirado', 401, 'UNAUTHORIZED');
  }
}

/**
 * Middleware para verificar se o usuário tem permissão de admin/manager
 */
export async function requireManager(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);

  if (!request.user) {
    throw new AppError('Usuário não autenticado', 401, 'UNAUTHORIZED');
  }

  const allowedRoles = ['ADMIN', 'MANAGER'];
  if (!allowedRoles.includes(request.user.cargo)) {
    throw new AppError('Acesso negado. Permissão de gerente necessária', 403, 'FORBIDDEN');
  }
}

/**
 * Middleware para verificar se o usuário é admin
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);

  if (!request.user) {
    throw new AppError('Usuário não autenticado', 401, 'UNAUTHORIZED');
  }

  if (request.user.cargo !== 'ADMIN') {
    throw new AppError('Acesso negado. Permissão de administrador necessária', 403, 'FORBIDDEN');
  }
}

/**
 * Middleware de autenticação por PIN (para garçons)
 * Aceita PIN no header X-User-Pin
 */
export async function authenticateByPin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const pin = request.headers['x-user-pin'] as string;

  if (!pin) {
    throw new AppError('PIN não fornecido', 401, 'UNAUTHORIZED');
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { pin, ativo: true },
    });

    if (!usuario) {
      throw new AppError('PIN inválido ou usuário inativo', 401, 'UNAUTHORIZED');
    }

    // Adiciona usuário ao request
    request.user = {
      id: usuario.id,
      nome: usuario.nome,
      cargo: usuario.cargo,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Erro na autenticação por PIN', 401, 'UNAUTHORIZED');
  }
}

/**
 * Middleware de autenticação OPCIONAL (PIN ou JWT)
 * Aceita PIN no header X-User-Pin OU JWT no header Authorization
 * Se nenhum estiver presente, continua sem autenticação (para rotas públicas)
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Tenta autenticar por PIN primeiro
  const pin = request.headers['x-user-pin'] as string;
  if (pin) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { pin, ativo: true },
      });

      if (usuario) {
        request.user = {
          id: usuario.id,
          nome: usuario.nome,
          cargo: usuario.cargo,
        };
        return; // PIN válido, autenticado
      }
    } catch (error) {
      // PIN inválido, tenta JWT
    }
  }

  // Tenta autenticar por JWT
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyToken(token);
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.userId, ativo: true },
      });

      if (usuario) {
        request.user = {
          id: usuario.id,
          nome: usuario.nome,
          cargo: usuario.cargo,
        };
      }
    } catch (error) {
      // Token inválido, mas não lança erro (rota pública)
    }
  }
}

