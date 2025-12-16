import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QuartoService } from '../services/quarto.service.js';

const quartoService = new QuartoService();

export async function quartoRoutes(fastify: FastifyInstance) {
  // Listar todos os quartos
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const quartos = await quartoService.listarQuartos();

      return reply.send({
        success: true,
        data: quartos,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao listar quartos');
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Buscar quarto por ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const quarto = await quartoService.buscarQuarto(parseInt(id));

      return reply.send({
        success: true,
        data: quarto,
      });
    } catch (error: any) {
      if (error.message?.includes('não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Criar novo quarto
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as {
        numero: string;
        andar: number;
        categoria: string;
      };

      const quarto = await quartoService.criarQuarto(data);

      return reply.status(201).send({
        success: true,
        data: quarto,
        message: `Quarto ${quarto.numero} criado com sucesso`,
      });
    } catch (error: any) {
      if (error.message?.includes('obrigatório') || error.message?.includes('Já existe')) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao criar quarto');
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Atualizar dados cadastrais do quarto
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as {
        numero?: string;
        categoria?: string;
        andar?: number;
      };

      const quarto = await quartoService.atualizarQuarto(parseInt(id), data);

      return reply.send({
        success: true,
        data: quarto,
        message: `Quarto ${quarto.numero} atualizado com sucesso`,
      });
    } catch (error: any) {
      if (error.message?.includes('não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      if (error.message?.includes('obrigatório') || error.message?.includes('Já existe') || error.message?.includes('não pode ser')) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao atualizar quarto');
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Deletar quarto
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await quartoService.deletarQuarto(parseInt(id));

      return reply.send({
        success: true,
        message: 'Quarto excluído com sucesso',
      });
    } catch (error: any) {
      if (error.message?.includes('não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      if (error.message?.includes('não é possível excluir') || error.message?.includes('Existe(m)')) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao deletar quarto');
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Atualizar status do quarto (Governança)
  fastify.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, forcar } = request.body as { status: string; forcar?: boolean };

      if (!status) {
        return reply.status(400).send({
          success: false,
          error: 'Campo "status" é obrigatório',
        });
      }

      const quarto = await quartoService.atualizarStatus(parseInt(id), status, forcar || false);

      return reply.send({
        success: true,
        data: quarto,
        message: `Status do quarto ${quarto.numero} atualizado para ${status}`,
      });
    } catch (error: any) {
      if (error.message?.includes('não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      if (error.message?.includes('não é possível') || error.message?.includes('Status inválido')) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}

