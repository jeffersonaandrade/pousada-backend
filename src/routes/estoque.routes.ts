import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EstoqueService } from '../services/estoque.service.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError, BusinessError, ValidationError } from '../lib/errors.js';
import { parseId } from '../lib/validation.js';

const estoqueService = new EstoqueService();

export async function estoqueRoutes(fastify: FastifyInstance) {
  // Registrar baixa técnica (perda de estoque)
  fastify.post('/baixa', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['produtoId', 'quantidade', 'motivo'],
        properties: {
          produtoId: { type: 'number', minimum: 1 },
          quantidade: { type: 'number', minimum: 1 },
          motivo: { type: 'string', enum: ['Quebra', 'Vencimento', 'Erro', 'Outro'] },
          observacao: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Autenticação necessária',
        });
      }

      const { produtoId, quantidade, motivo, observacao } = request.body as {
        produtoId: number;
        quantidade: number;
        motivo: string;
        observacao?: string;
      };

      const perda = await estoqueService.registrarBaixa(
        produtoId,
        quantidade,
        motivo,
        observacao,
        request.user.id
      );

      fastify.log.info({
        perdaId: perda.id,
        produtoId,
        quantidade,
        motivo,
        usuarioId: request.user.id,
      }, 'Baixa técnica registrada');

      return reply.status(201).send({
        success: true,
        data: perda,
      });
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof BusinessError || error instanceof ValidationError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao registrar baixa técnica');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao registrar baixa técnica',
      });
    }
  });

  // Listar baixas técnicas
  fastify.get('/baixas', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        produtoId,
        page = '1',
        limit = '50',
        dataInicio,
        dataFim,
      } = request.query as {
        produtoId?: string;
        page?: string;
        limit?: string;
        dataInicio?: string;
        dataFim?: string;
      };

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const produtoIdNum = produtoId ? parseId(produtoId) : undefined;

      const result = await estoqueService.listarBaixas(
        produtoIdNum,
        pageNum,
        limitNum,
        dataInicio,
        dataFim
      );

      return reply.send({
        success: true,
        ...result,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao listar baixas técnicas');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao listar baixas técnicas',
      });
    }
  });
}

