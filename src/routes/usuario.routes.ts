import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UsuarioService } from '../services/usuario.service.js';
import { Role } from '../types/enums.js';
import { requireAdmin, requireManager } from '../middleware/auth.js';
import { logOperation } from '../middleware/logging.js';

const usuarioService = new UsuarioService();

export async function usuarioRoutes(fastify: FastifyInstance) {
  // Criar usuário - requer permissão de manager
  fastify.post('/', {
    preHandler: [requireManager],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as {
      nome: string;
      pin: string;
      cargo: Role;
    };

    const usuario = await usuarioService.criarUsuario(data);

    await logOperation(request, reply, 'CRIAR_USUARIO', {
      usuarioId: usuario.id,
      nome: usuario.nome,
    });

    return reply.status(201).send({
      success: true,
      data: usuario,
    });
  });

  // Listar usuários
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        ativo, 
        page = '1', 
        limit = '10', 
        busca,
        cargo
      } = request.query as { 
        ativo?: string; 
        page?: string; 
        limit?: string; 
        busca?: string;
        cargo?: string;
      };
      
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      const result = await usuarioService.listarUsuarios(
        ativo !== undefined ? ativo === 'true' : undefined,
        pageNum,
        limitNum,
        busca,
        cargo
      );

      return reply.send({
        success: true,
        ...result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Buscar usuário por ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const usuario = await usuarioService.buscarUsuario(parseInt(id));

      if (!usuario) {
        return reply.status(404).send({
          success: false,
          error: 'Usuário não encontrado',
        });
      }

      return reply.send({
        success: true,
        data: usuario,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Autenticar por PIN
  fastify.post('/auth', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { pin } = request.body as { pin: string };
      const usuario = await usuarioService.autenticarPorPin(pin);

      if (!usuario) {
        return reply.status(401).send({
          success: false,
          error: 'PIN inválido ou usuário inativo',
        });
      }

      // Gera token JWT
      const { generateToken } = await import('../lib/jwt.js');
      const token = generateToken({
        id: usuario.id,
        nome: usuario.nome,
        cargo: usuario.cargo,
      });

      return reply.send({
        success: true,
        data: {
          ...usuario,
          token, // Inclui o token na resposta
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Atualizar usuário - requer permissão de manager
  fastify.patch('/:id', {
    preHandler: [requireManager],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Partial<{
      nome: string;
      pin: string;
      cargo: Role;
      ativo: boolean;
    }>;

    const usuario = await usuarioService.atualizarUsuario(parseInt(id), data);

    await logOperation(request, reply, 'ATUALIZAR_USUARIO', {
      usuarioId: usuario.id,
    });

    return reply.send({
      success: true,
      data: usuario,
    });
  });

  // Desativar usuário - requer permissão de manager
  fastify.post('/:id/desativar', {
    preHandler: [requireManager],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const usuario = await usuarioService.desativarUsuario(parseInt(id));

    await logOperation(request, reply, 'DESATIVAR_USUARIO', {
      usuarioId: usuario.id,
    });

    return reply.send({
      success: true,
      data: usuario,
    });
  });
}
