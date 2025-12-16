import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HospedeService } from '../services/hospede.service.js';
import { TipoCliente } from '../types/enums.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { logOperation } from '../middleware/logging.js';
import { prisma } from '../lib/prisma.js';

const hospedeService = new HospedeService();

export async function hospedeRoutes(fastify: FastifyInstance) {
  // Criar hóspede (Check-in)
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as {
        tipo: TipoCliente;
        nome: string;
        documento?: string;
        telefone?: string;
        email?: string;
        quarto?: string; // DEPRECATED: Número do quarto (string) - mantido para compatibilidade
        quartoId?: number; // ID do quarto (preferencial)
        uidPulseira: string;
        limiteGasto?: number;
        origem?: string; // BALCAO ou SITE
        valorEntrada?: number | string; // Valor da diária/day use para criar pedido automaticamente
        pagoNaEntrada?: boolean; // Se true, registra pagamento e zera dívida inicial
        metodoPagamento?: string; // PIX, DINHEIRO, CARTAO, DEBITO (obrigatório se pagoNaEntrada = true)
      };

      // Log para debug
      fastify.log.info({ 
        valorEntrada: data.valorEntrada,
        pagoNaEntrada: data.pagoNaEntrada,
        metodoPagamento: data.metodoPagamento,
        tipoValorEntrada: typeof data.valorEntrada,
        dadosRecebidos: data 
      }, 'Criando hóspede com check-in');

      const hospede = await hospedeService.criarHospede(data);

      // Log do resultado
      fastify.log.info({ 
        hospedeId: hospede.id,
        dividaAtual: hospede.dividaAtual 
      }, 'Hóspede criado');

      let message = 'Hóspede criado com sucesso';
      if (data.valorEntrada) {
        if (data.pagoNaEntrada) {
          message = 'Hóspede criado, pedido de diária registrado e pagamento efetuado com sucesso';
        } else {
          message = 'Hóspede criado e pedido de diária registrado com sucesso';
        }
      }

      return reply.status(201).send({
        success: true,
        data: hospede,
        message,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao criar hóspede');
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Listar hóspedes
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        ativo, 
        page = '1', 
        limit = '10', 
        busca,
        tipo
      } = request.query as { 
        ativo?: string; 
        page?: string; 
        limit?: string; 
        busca?: string;
        tipo?: string;
      };
      
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      const result = await hospedeService.listarHospedes(
        ativo !== undefined ? ativo === 'true' : undefined,
        pageNum,
        limitNum,
        busca,
        tipo
      );

      // Log para debug
      fastify.log.info({ 
        total: result.pagination.total,
        hospedes: result.data.map(h => ({ 
          id: h.id, 
          nome: h.nome, 
          dividaAtual: h.dividaAtual 
        }))
      }, 'Listando hóspedes');

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

  // Buscar hóspede por ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const hospede = await hospedeService.buscarHospede(parseInt(id));

      if (!hospede) {
        return reply.status(404).send({
          success: false,
          error: 'Hóspede não encontrado',
        });
      }

      return reply.send({
        success: true,
        data: hospede,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Buscar por pulseira NFC
  fastify.get('/pulseira/:uid', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { uid } = request.params as { uid: string };
      const hospede = await hospedeService.buscarPorPulseira(uid);

      if (!hospede) {
        return reply.status(404).send({
          success: false,
          error: 'Pulseira não encontrada',
        });
      }

      return reply.send({
        success: true,
        data: hospede,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Atualizar hóspede
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as Partial<{
        nome: string;
        documento: string;
        telefone: string;
        email: string;
        quarto: string;
        limiteGasto: number;
        ativo: boolean;
        origem: string;
      }>;

      const hospede = await hospedeService.atualizarHospede(parseInt(id), data);

      return reply.send({
        success: true,
        data: hospede,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Desativar hóspede
  fastify.post('/:id/desativar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const hospede = await hospedeService.desativarHospede(parseInt(id));

      return reply.send({
        success: true,
        data: hospede,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Zerar dívida - requer autenticação (operação sensível)
  fastify.post('/:id/zerar-divida', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const hospede = await hospedeService.zerarDivida(parseInt(id));

    await logOperation(request, reply, 'ZERAR_DIVIDA', {
      hospedeId: hospede.id,
      dividaAnterior: hospede.dividaAtual,
    });

    return reply.send({
      success: true,
      data: hospede,
    });
  });

  // Endpoint de diagnóstico - verificar dados de hóspedes no banco
  fastify.get('/diagnostico/dividas', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const hospedes = await prisma.hospede.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          tipo: true,
          dividaAtual: true,
          pedidos: {
            select: {
              id: true,
              valor: true,
              status: true,
            },
          },
          pagamentos: {
            select: {
              id: true,
              valor: true,
              metodo: true,
            },
          },
        },
      });

      const resultado = hospedes.map(h => {
        const totalPedidos = h.pedidos.reduce((sum, p) => sum + p.valor, 0);
        const totalPagamentos = h.pagamentos.reduce((sum, p) => sum + p.valor, 0);
        const dividaCalculada = totalPedidos - totalPagamentos;

        return {
          id: h.id,
          nome: h.nome,
          tipo: h.tipo,
          dividaAtual: h.dividaAtual,
          totalPedidos,
          totalPagamentos,
          dividaCalculada,
          diferenca: Math.abs(h.dividaAtual - dividaCalculada),
          pedidos: h.pedidos.length,
          pagamentos: h.pagamentos.length,
        };
      });

      return reply.send({
        success: true,
        data: resultado,
        message: 'Diagnóstico de dívidas',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Checkout - exige pagamento, zera dívida e desativa hóspede (libera pulseira)
  // Rota pública para recepção (pode ser usada sem autenticação, mas se autenticado registra no caixa)
  fastify.post('/:id/checkout', {
    preHandler: [optionalAuthenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        metodoPagamento: string; // PIX, DINHEIRO, CARTAO, DEBITO (obrigatório)
        valorPagamento?: number; // Valor a pagar (opcional, se não fornecido usa dividaAtual)
        forcarCheckout?: boolean; // Se true, força checkout mesmo se pagamento não bater com dívida
      };

      if (!body.metodoPagamento) {
        return reply.status(400).send({
          success: false,
          error: 'Método de pagamento é obrigatório para checkout',
        });
      }

      const hospede = await hospedeService.realizarCheckout(parseInt(id), {
        metodoPagamento: body.metodoPagamento,
        valorPagamento: body.valorPagamento,
        forcarCheckout: body.forcarCheckout ?? false,
        usuarioId: request.user?.id, // Passar ID do usuário autenticado (se houver)
      });

      return reply.send({
        success: true,
        data: hospede,
        message: 'Checkout realizado com sucesso. Pagamento registrado e pulseira liberada.',
      });
    } catch (error: any) {
      if (error.message === 'Hóspede não encontrado' || error.message.includes('não encontrado')) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
