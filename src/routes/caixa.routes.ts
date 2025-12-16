import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CaixaService } from '../services/caixa.service.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

const caixaService = new CaixaService();

export async function caixaRoutes(fastify: FastifyInstance) {
  // Abrir caixa - requer autenticação
  fastify.post('/abrir', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const body = request.body as {
        saldoInicial: number;
      };

      if (body.saldoInicial === undefined || body.saldoInicial === null) {
        return reply.status(400).send({
          success: false,
          error: 'Saldo inicial é obrigatório',
        });
      }

      const caixa = await caixaService.abrirCaixa(
        request.user.id,
        body.saldoInicial
      );

      fastify.log.info({
        caixaId: caixa.id,
        usuarioId: request.user.id,
        saldoInicial: body.saldoInicial,
      }, 'Caixa aberto');

      return reply.status(201).send({
        success: true,
        data: caixa,
        message: 'Caixa aberto com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao abrir caixa');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao abrir caixa',
      });
    }
  });

  // Fechar caixa - requer autenticação
  fastify.post('/fechar', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const body = request.body as {
        saldoFinalDinheiro: number;
        saldoFinalCartao?: number;
        observacao?: string;
      };

      if (body.saldoFinalDinheiro === undefined || body.saldoFinalDinheiro === null) {
        return reply.status(400).send({
          success: false,
          error: 'Saldo final em dinheiro é obrigatório',
        });
      }

      const resultado = await caixaService.fecharCaixa(
        request.user.id,
        body.saldoFinalDinheiro,
        body.saldoFinalCartao,
        body.observacao
      );

      fastify.log.info({
        caixaId: resultado.id,
        usuarioId: request.user.id,
        quebraCaixa: resultado.resumo.quebraCaixa,
      }, 'Caixa fechado');

      return reply.send({
        success: true,
        data: resultado,
        message: 'Caixa fechado com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao fechar caixa');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao fechar caixa',
      });
    }
  });

  // Status do caixa - requer autenticação
  fastify.get('/status', {
    preHandler: [optionalAuthenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Se não autenticado, retorna que não tem caixa aberto
      if (!request.user) {
        return reply.send({
          success: true,
          data: {
            temCaixaAberto: false,
            caixa: null,
            resumo: null,
          },
        });
      }

      const status = await caixaService.obterStatusCaixa(request.user.id);

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao obter status do caixa');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao obter status do caixa',
      });
    }
  });

  // Registrar sangria - requer autenticação
  fastify.post('/sangria', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const body = request.body as {
        valor: number;
        observacao?: string;
      };

      if (body.valor === undefined || body.valor === null || body.valor <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Valor da sangria deve ser maior que zero',
        });
      }

      const lancamento = await caixaService.registrarSangria(
        request.user.id,
        body.valor,
        body.observacao
      );

      fastify.log.info({
        lancamentoId: lancamento.id,
        usuarioId: request.user.id,
        valor: body.valor,
      }, 'Sangria registrada');

      return reply.status(201).send({
        success: true,
        data: lancamento,
        message: 'Sangria registrada com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao registrar sangria');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao registrar sangria',
      });
    }
  });

  // Registrar suprimento - requer autenticação
  fastify.post('/suprimento', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const body = request.body as {
        valor: number;
        observacao?: string;
      };

      if (body.valor === undefined || body.valor === null || body.valor <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Valor do suprimento deve ser maior que zero',
        });
      }

      const lancamento = await caixaService.registrarSuprimento(
        request.user.id,
        body.valor,
        body.observacao
      );

      fastify.log.info({
        lancamentoId: lancamento.id,
        usuarioId: request.user.id,
        valor: body.valor,
      }, 'Suprimento registrado');

      return reply.status(201).send({
        success: true,
        data: lancamento,
        message: 'Suprimento registrado com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao registrar suprimento');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao registrar suprimento',
      });
    }
  });
}

