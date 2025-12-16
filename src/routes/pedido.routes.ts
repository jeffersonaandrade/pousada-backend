import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PedidoService } from '../services/pedido.service.js';
import { UsuarioService } from '../services/usuario.service.js';
import { StatusPedido } from '../types/enums.js';
import { parseId } from '../lib/validation.js';
import { NotFoundError, ValidationError, BusinessError, ForbiddenError } from '../lib/errors.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const pedidoService = new PedidoService();
const usuarioService = new UsuarioService();

export async function pedidoRoutes(fastify: FastifyInstance) {
  // Criar pedido(s)
  // Cenário A (NFC): { items: [...], uidPulseira: "..." } - Aprovação automática
  // Cenário B (Manual): { items: [...], hospedeId: 123, managerPin: "..." } - Requer PIN de gerente
  fastify.post('/', {
    preHandler: [optionalAuthenticate],
    schema: {
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['produtoId'],
              properties: {
                produtoId: { type: 'number', minimum: 1 },
                quantidade: { type: 'number', minimum: 1, default: 1 },
              },
            },
          },
          // Cenário A: NFC
          uidPulseira: { type: 'string' },
          // Cenário B: Manual
          hospedeId: { type: 'number', minimum: 1 },
          managerPin: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      items: Array<{ produtoId: number; quantidade?: number }>;
      uidPulseira?: string;
      hospedeId?: number;
      managerPin?: string;
    };

    let hospedeId: number;
    let hospede: any;

    // ===== CENÁRIO A: NFC (Pulseira) =====
    if (body.uidPulseira) {
      // Buscar hóspede pela pulseira
      hospede = await prisma.hospede.findUnique({
        where: { uidPulseira: body.uidPulseira, ativo: true },
      });

      if (!hospede) {
        return reply.status(404).send({
          success: false,
          error: 'Pulseira não encontrada ou hóspede inativo',
        });
      }

      hospedeId = hospede.id;
      // NFC: Aprovação automática, não precisa de PIN de gerente
    }
    // ===== CENÁRIO B: Manual (Digitação) =====
    else if (body.hospedeId) {
      hospedeId = body.hospedeId;

      // VALIDAÇÃO OBRIGATÓRIA: PIN de Gerente
      if (!body.managerPin) {
        return reply.status(400).send({
          success: false,
          error: 'PIN de gerente é obrigatório para pedidos manuais',
        });
      }

      // Validar PIN de gerente
      const gerente = await usuarioService.validarPinGerente(body.managerPin);
      if (!gerente) {
        return reply.status(403).send({
          success: false,
          error: 'Permissão negada: PIN de gerente inválido ou sem permissão',
        });
      }

      // Buscar hóspede
      hospede = await prisma.hospede.findUnique({
        where: { id: hospedeId },
      });

      if (!hospede) {
        return reply.status(404).send({
          success: false,
          error: 'Hóspede não encontrado',
        });
      }

      if (!hospede.ativo) {
        return reply.status(400).send({
          success: false,
          error: 'Hóspede inativo',
        });
      }

      fastify.log.info({
        gerenteId: gerente.id,
        gerenteNome: gerente.nome,
        hospedeId,
        hospedeNome: hospede.nome,
      }, 'Pedido manual autorizado por gerente');
    }
    // ===== ERRO: Nenhum cenário válido =====
    else {
      return reply.status(400).send({
        success: false,
        error: 'É necessário informar uidPulseira (NFC) ou hospedeId + managerPin (Manual)',
      });
    }

    // Criar pedidos
    try {
      let metodoCriacao: 'NFC' | 'MANUAL' = 'NFC';
      let gerenteId: number | undefined;

      // Determinar método de criação
      if (body.uidPulseira) {
        metodoCriacao = 'NFC';
        fastify.log.info({ uidPulseira: body.uidPulseira }, 'Pedido via NFC');
      } else if (body.hospedeId && body.managerPin) {
        metodoCriacao = 'MANUAL';
        fastify.log.info({ hospedeId: body.hospedeId, temManagerPin: !!body.managerPin }, 'Pedido MANUAL detectado');
        // Buscar gerente que autorizou
        const gerente = await usuarioService.validarPinGerente(body.managerPin);
        if (gerente) {
          gerenteId = gerente.id;
          fastify.log.info({ gerenteId: gerente.id, gerenteNome: gerente.nome }, 'Gerente encontrado para pedido manual');
        } else {
          fastify.log.warn({ managerPin: body.managerPin }, 'Gerente não encontrado para pedido manual');
        }
      } else {
        fastify.log.warn({ body: JSON.stringify(body) }, 'Método de criação não determinado - usando NFC como padrão');
      }

      // Pegar ID do usuário autenticado (garçom que criou o pedido)
      const usuarioId = request.user?.id;

      const pedidos = await pedidoService.criarPedidos(
        hospedeId, 
        body.items, 
        metodoCriacao, 
        gerenteId,
        usuarioId // Passar ID do garçom que criou
      );

      // Emitir eventos Socket.io para a cozinha (um evento por pedido)
      pedidos.forEach((pedido) => {
        fastify.io.emit('novo_pedido', pedido);
      });

      fastify.log.info({
        metodoCriacao,
        gerenteId,
        quantidadeItens: body.items.length,
        hospedeId,
        pedidosCriados: pedidos.length,
        primeiroPedidoId: pedidos[0]?.id,
        primeiroPedidoMetodo: pedidos[0]?.metodoCriacao,
      }, 'Pedidos criados');

      return reply.status(201).send({
        success: true,
        data: pedidos.length === 1 ? pedidos[0] : pedidos,
        count: pedidos.length,
      });
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      if (error instanceof BusinessError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      if (error instanceof ForbiddenError) {
        return reply.status(403).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao criar pedidos');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao criar pedidos',
      });
    }
  });

  // Estatísticas de pedidos por método (NFC vs Manual)
  fastify.get('/estatisticas/metodo', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { dataInicio, dataFim } = request.query as {
        dataInicio?: string;
        dataFim?: string;
      };

      const where: any = {
        status: { not: 'CANCELADO' }, // Excluir cancelados
      };

      // Filtro por data se fornecido
      if (dataInicio || dataFim) {
        where.data = {};
        if (dataInicio) {
          // Criar data no início do dia (00:00:00) no timezone local
          const inicio = new Date(dataInicio + 'T00:00:00');
          where.data.gte = inicio;
          fastify.log.info({ dataInicio, inicio: inicio.toISOString() }, 'Filtro data início');
        }
        if (dataFim) {
          // Criar data no fim do dia (23:59:59) no timezone local
          const fim = new Date(dataFim + 'T23:59:59');
          fim.setHours(23, 59, 59, 999);
          where.data.lte = fim;
          fastify.log.info({ dataFim, fim: fim.toISOString() }, 'Filtro data fim');
        }
      }

      // Log para debug
      fastify.log.info({ where, dataInicio, dataFim }, 'Buscando estatísticas de método');

      // Buscar estatísticas agregadas
      const [totalPedidos, pedidosNFC, pedidosManual] = await Promise.all([
        prisma.pedido.count({ where }),
        prisma.pedido.aggregate({
          where: { ...where, metodoCriacao: 'NFC' },
          _count: { id: true },
          _sum: { valor: true },
        }),
        prisma.pedido.aggregate({
          where: { ...where, metodoCriacao: 'MANUAL' },
          _count: { id: true },
          _sum: { valor: true },
        }),
      ]);

      // Log para debug
      fastify.log.info({
        totalPedidos,
        nfc: pedidosNFC._count.id,
        manual: pedidosManual._count.id,
        filtroData: { dataInicio, dataFim },
      }, 'Estatísticas encontradas');

      // Buscar pedidos manuais por gerente
      const pedidosPorGerente = await prisma.pedido.groupBy({
        by: ['gerenteId'],
        where: { ...where, metodoCriacao: 'MANUAL' },
        _count: { id: true },
        _sum: { valor: true },
      });

      // Buscar nomes dos gerentes
      const gerentesIds = pedidosPorGerente.map((p) => p.gerenteId).filter(Boolean) as number[];
      const gerentes = gerentesIds.length > 0
        ? await prisma.usuario.findMany({
            where: { id: { in: gerentesIds } },
            select: { id: true, nome: true },
          })
        : [];

      const gerentesMap = new Map(gerentes.map((g) => [g.id, g.nome]));

      const estatisticasPorGerente = pedidosPorGerente.map((p) => ({
        gerenteId: p.gerenteId,
        gerenteNome: p.gerenteId ? gerentesMap.get(p.gerenteId) || 'Desconhecido' : null,
        totalPedidos: p._count.id,
        valorTotal: p._sum.valor || 0,
      }));

      return reply.send({
        success: true,
        data: {
          total: {
            pedidos: totalPedidos,
            valor: (pedidosNFC._sum.valor || 0) + (pedidosManual._sum.valor || 0),
          },
          nfc: {
            pedidos: pedidosNFC._count.id,
            valor: pedidosNFC._sum.valor || 0,
            percentual: totalPedidos > 0 ? ((pedidosNFC._count.id / totalPedidos) * 100).toFixed(2) : '0',
          },
          manual: {
            pedidos: pedidosManual._count.id,
            valor: pedidosManual._sum.valor || 0,
            percentual: totalPedidos > 0 ? ((pedidosManual._count.id / totalPedidos) * 100).toFixed(2) : '0',
          },
          porGerente: estatisticasPorGerente,
        },
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Erro ao buscar estatísticas de método');
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Listar pedidos
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { 
      status, 
      page = '1', 
      limit = '10', 
      busca,
      hospedeId,
      metodoCriacao,
      usuarioId,
      recente
    } = request.query as { 
      status?: StatusPedido; 
      page?: string; 
      limit?: string; 
      busca?: string;
      hospedeId?: string;
      metodoCriacao?: string;
      usuarioId?: string;
      recente?: string;
    };
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const hospedeIdNum = hospedeId ? parseInt(hospedeId, 10) : undefined;
    const usuarioIdNum = usuarioId ? parseInt(usuarioId, 10) : undefined;
    const recenteBool = recente === 'true' || recente === '1';
    
    const result = await pedidoService.listarPedidos(
      status, 
      pageNum, 
      limitNum, 
      busca, 
      hospedeIdNum,
      metodoCriacao as 'NFC' | 'MANUAL' | undefined,
      usuarioIdNum,
      recenteBool
    );

    return reply.send({
      success: true,
      ...result,
    });
  });

  // Buscar pedido por ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const pedidoId = parseId(id);
    const pedido = await pedidoService.buscarPedido(pedidoId);

    if (!pedido) {
      throw new NotFoundError('Pedido');
    }

    return reply.send({
      success: true,
      data: pedido,
    });
  });

  // Atualizar status do pedido
  // Requer autenticação por PIN (garçom/cozinha) ou JWT (admin)
  fastify.patch('/:id/status', {
    preHandler: [optionalAuthenticate],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['PENDENTE', 'PREPARANDO', 'PRONTO', 'ENTREGUE', 'CANCELADO'],
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Apenas usuários autenticados podem atualizar status
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Autenticação necessária para atualizar status. Envie X-User-Pin (garçom/cozinha) ou Authorization Bearer (admin)',
      });
    }

    const { id } = request.params as { id: string };
    const { status } = request.body as { status: StatusPedido };
    const pedidoId = parseId(id);

    const pedido = await pedidoService.atualizarStatus(pedidoId, status);

    // Emitir evento de atualização
    fastify.io.emit('pedido_atualizado', pedido);

    return reply.send({
      success: true,
      data: pedido,
    });
  });

  // Cancelar pedido (DELETE) - Requer PIN de gerente/administrador
  fastify.delete('/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['managerPin'],
        properties: {
          managerPin: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { managerPin } = request.body as { managerPin: string };
      const pedidoId = parseId(id);

      if (!managerPin) {
        return reply.status(400).send({
          success: false,
          error: 'PIN de gerente é obrigatório para cancelar pedidos',
        });
      }

      const pedido = await pedidoService.cancelarPedidoComPin(pedidoId, managerPin);

      // Emitir evento de cancelamento após a transação ser concluída
      fastify.io.emit('pedido_cancelado', pedido);

      fastify.log.info({
        pedidoId: pedido.id,
        managerPin: managerPin.substring(0, 2) + '**', // Log parcial do PIN por segurança
      }, 'Pedido cancelado com sucesso');

      return reply.send({
        success: true,
        data: pedido,
      });
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      if (error instanceof BusinessError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      if (error instanceof ForbiddenError) {
        return reply.status(403).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      fastify.log.error(error, 'Erro ao cancelar pedido');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao cancelar pedido',
      });
    }
  });

  // Cancelar pedido (POST - método legado)
  // Requer autenticação por PIN (garçom) ou JWT (admin)
  fastify.post('/:id/cancelar', {
    preHandler: [optionalAuthenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Apenas usuários autenticados podem cancelar pedidos
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Autenticação necessária para cancelar pedidos. Envie X-User-Pin (garçom) ou Authorization Bearer (admin)',
      });
    }

    const { id } = request.params as { id: string };
    const pedidoId = parseId(id);
    const pedido = await pedidoService.cancelarPedido(pedidoId);

    // Emitir evento de cancelamento
    fastify.io.emit('pedido_cancelado', pedido);

    return reply.send({
      success: true,
      data: pedido,
    });
  });
}
