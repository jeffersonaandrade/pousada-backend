import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FinanceiroService } from '../services/financeiro.service.js';
import { authenticate } from '../middleware/auth.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

const financeiroService = new FinanceiroService();

export async function financeiroRoutes(fastify: FastifyInstance) {
  // ========== CATEGORIAS ==========

  // Listar categorias
  fastify.get('/categorias', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tipo } = request.query as { tipo?: 'DESPESA' | 'RECEITA' };
      const categorias = await financeiroService.listarCategorias(tipo);

      return reply.send({
        success: true,
        data: categorias,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao listar categorias');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao listar categorias',
      });
    }
  });

  // Criar categoria
  fastify.post('/categorias', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        nome: string;
        tipo: 'DESPESA' | 'RECEITA';
      };

      if (!body.nome || !body.tipo) {
        return reply.status(400).send({
          success: false,
          error: 'Nome e tipo são obrigatórios',
        });
      }

      const categoria = await financeiroService.criarCategoria(body);

      return reply.status(201).send({
        success: true,
        data: categoria,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao criar categoria');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao criar categoria',
      });
    }
  });

  // Atualizar categoria
  fastify.patch('/categorias/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        nome?: string;
        tipo?: 'DESPESA' | 'RECEITA';
      };

      const categoria = await financeiroService.atualizarCategoria(parseInt(id), body);

      return reply.send({
        success: true,
        data: categoria,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao atualizar categoria');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao atualizar categoria',
      });
    }
  });

  // Remover categoria
  fastify.delete('/categorias/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await financeiroService.removerCategoria(parseInt(id));

      return reply.send({
        success: true,
        message: 'Categoria removida com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao remover categoria');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao remover categoria',
      });
    }
  });

  // ========== CONTAS A PAGAR ==========

  // Listar contas a pagar
  fastify.get('/contas-pagar', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, categoriaId, dataInicio, dataFim } = request.query as {
        status?: string;
        categoriaId?: string;
        dataInicio?: string;
        dataFim?: string;
      };

      const filtros: any = {};
      if (status) filtros.status = status;
      if (categoriaId) filtros.categoriaId = parseInt(categoriaId);
      if (dataInicio) filtros.dataInicio = new Date(dataInicio);
      if (dataFim) filtros.dataFim = new Date(dataFim);

      const contas = await financeiroService.listarContasPagar(filtros);

      return reply.send({
        success: true,
        data: contas,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao listar contas a pagar');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao listar contas a pagar',
      });
    }
  });

  // Criar conta a pagar
  fastify.post('/contas-pagar', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        descricao: string;
        valor: number;
        dataVencimento: string | Date;
        categoriaId: number;
        fornecedor?: string;
        observacao?: string;
      };

      if (!body.descricao || !body.valor || !body.dataVencimento || !body.categoriaId) {
        return reply.status(400).send({
          success: false,
          error: 'Descrição, valor, data de vencimento e categoria são obrigatórios',
        });
      }

      const conta = await financeiroService.criarContaPagar({
        ...body,
        dataVencimento: new Date(body.dataVencimento),
      });

      return reply.status(201).send({
        success: true,
        data: conta,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao criar conta a pagar');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao criar conta a pagar',
      });
    }
  });

  // Atualizar conta a pagar
  fastify.patch('/contas-pagar/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        descricao?: string;
        valor?: number;
        dataVencimento?: string | Date;
        categoriaId?: number;
        fornecedor?: string;
        observacao?: string;
      };

      const updateData: any = { ...body };
      if (body.dataVencimento) {
        updateData.dataVencimento = new Date(body.dataVencimento);
      }

      const conta = await financeiroService.atualizarContaPagar(parseInt(id), updateData);

      return reply.send({
        success: true,
        data: conta,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao atualizar conta a pagar');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao atualizar conta a pagar',
      });
    }
  });

  // Remover conta a pagar
  fastify.delete('/contas-pagar/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await financeiroService.removerContaPagar(parseInt(id));

      return reply.send({
        success: true,
        message: 'Conta a pagar removida com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao remover conta a pagar');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao remover conta a pagar',
      });
    }
  });

  // Pagar conta (baixa)
  fastify.post('/contas-pagar/:id/pagar', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        metodoPagamento: string;
        dataPagamento?: string | Date;
        caixaId?: number;
      };

      if (!body.metodoPagamento) {
        return reply.status(400).send({
          success: false,
          error: 'Método de pagamento é obrigatório',
        });
      }

      const conta = await financeiroService.pagarConta(parseInt(id), {
        metodoPagamento: body.metodoPagamento,
        dataPagamento: body.dataPagamento ? new Date(body.dataPagamento) : undefined,
        usuarioId: request.user.id,
        caixaId: body.caixaId,
      });

      fastify.log.info({
        contaId: conta.id,
        valor: conta.valor,
        metodoPagamento: body.metodoPagamento,
        usuarioId: request.user.id,
      }, 'Conta a pagar baixada');

      return reply.send({
        success: true,
        data: conta,
        message: 'Conta paga com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao pagar conta');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao pagar conta',
      });
    }
  });

  // ========== CONTAS A RECEBER ==========

  // Listar contas a receber
  fastify.get('/contas-receber', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, categoriaId, origem, dataInicio, dataFim } = request.query as {
        status?: string;
        categoriaId?: string;
        origem?: string;
        dataInicio?: string;
        dataFim?: string;
      };

      const filtros: any = {};
      if (status) filtros.status = status;
      if (categoriaId) filtros.categoriaId = parseInt(categoriaId);
      if (origem) filtros.origem = origem;
      if (dataInicio) filtros.dataInicio = new Date(dataInicio);
      if (dataFim) filtros.dataFim = new Date(dataFim);

      const contas = await financeiroService.listarContasReceber(filtros);

      return reply.send({
        success: true,
        data: contas,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao listar contas a receber');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao listar contas a receber',
      });
    }
  });

  // Criar conta a receber
  fastify.post('/contas-receber', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        descricao: string;
        valor: number;
        dataVencimento: string | Date;
        categoriaId: number;
        origem: 'HOSPEDE' | 'CARTAO_CREDITO' | 'OUTROS';
        observacao?: string;
      };

      if (!body.descricao || !body.valor || !body.dataVencimento || !body.categoriaId || !body.origem) {
        return reply.status(400).send({
          success: false,
          error: 'Descrição, valor, data de vencimento, categoria e origem são obrigatórios',
        });
      }

      const conta = await financeiroService.criarContaReceber({
        ...body,
        dataVencimento: new Date(body.dataVencimento),
      });

      return reply.status(201).send({
        success: true,
        data: conta,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao criar conta a receber');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao criar conta a receber',
      });
    }
  });

  // Atualizar conta a receber
  fastify.patch('/contas-receber/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        descricao?: string;
        valor?: number;
        dataVencimento?: string | Date;
        categoriaId?: number;
        origem?: 'HOSPEDE' | 'CARTAO_CREDITO' | 'OUTROS';
        observacao?: string;
      };

      const updateData: any = { ...body };
      if (body.dataVencimento) {
        updateData.dataVencimento = new Date(body.dataVencimento);
      }

      const conta = await financeiroService.atualizarContaReceber(parseInt(id), updateData);

      return reply.send({
        success: true,
        data: conta,
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao atualizar conta a receber');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao atualizar conta a receber',
      });
    }
  });

  // Remover conta a receber
  fastify.delete('/contas-receber/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await financeiroService.removerContaReceber(parseInt(id));

      return reply.send({
        success: true,
        message: 'Conta a receber removida com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao remover conta a receber');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao remover conta a receber',
      });
    }
  });

  // Receber conta (baixa)
  fastify.post('/contas-receber/:id/receber', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        dataRecebimento?: string | Date;
      };

      const conta = await financeiroService.receberConta(
        parseInt(id),
        body.dataRecebimento ? new Date(body.dataRecebimento) : undefined
      );

      fastify.log.info({
        contaId: conta.id,
        valor: conta.valor,
      }, 'Conta a receber baixada');

      return reply.send({
        success: true,
        data: conta,
        message: 'Conta recebida com sucesso',
      });
    } catch (error: any) {
      if (error instanceof BusinessError || error instanceof NotFoundError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao receber conta');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao receber conta',
      });
    }
  });

  // ========== DASHBOARD ==========

  // Dashboard financeiro
  fastify.get('/dashboard', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = await financeiroService.obterDashboard();

      return reply.send({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao obter dashboard financeiro');
      return reply.status(500).send({
        success: false,
        error: 'Erro ao obter dashboard financeiro',
      });
    }
  });
}

