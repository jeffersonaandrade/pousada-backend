import { StatusPedido } from '../types/enums.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError, ForbiddenError } from '../lib/errors.js';
import { getDataHoraBrasil } from '../lib/dateUtils.js';

export class PedidoService {
  /**
   * Cria múltiplos pedidos em uma única transação
   * @param hospedeId ID do hóspede
   * @param items Array de { produtoId: number, quantidade?: number }
   * @param metodoCriacao 'NFC' ou 'MANUAL'
   * @param gerenteId ID do gerente que autorizou (se métodoCriacao = 'MANUAL')
   * @param usuarioId ID do garçom que criou o pedido (opcional)
   */
  async criarPedidos(
    hospedeId: number, 
    items: Array<{ produtoId: number; quantidade?: number }>,
    metodoCriacao: 'NFC' | 'MANUAL' = 'NFC',
    gerenteId?: number,
    usuarioId?: number
  ) {
    return await prisma.$transaction(async (tx) => {
      // Buscar hóspede
      const hospede = await tx.hospede.findUnique({
        where: { id: hospedeId },
      });

      if (!hospede) {
        throw new NotFoundError('Hóspede');
      }

      if (!hospede.ativo) {
        throw new BusinessError('Hóspede inativo');
      }

      const pedidosCriados = [];

      // Processar cada item
      for (const item of items) {
        const quantidade = item.quantidade || 1;

        // Buscar produto
        const produto = await tx.produto.findUnique({
          where: { id: item.produtoId },
        });

        if (!produto) {
          throw new NotFoundError(`Produto com ID ${item.produtoId}`);
        }

        // Validação: produto deve ter estoque disponível (estoque > 0)
        if (produto.estoque <= 0) {
          throw new BusinessError(
            `Produto "${produto.nome}" está esgotado e não está disponível para venda`
          );
        }

        // Validação de estoque suficiente
        if (produto.estoque < quantidade) {
          throw new BusinessError(
            `Produto "${produto.nome}" sem estoque suficiente. Disponível: ${produto.estoque}, Solicitado: ${quantidade}`
          );
        }

        // Calcular valor total do item
        const valorTotal = produto.preco * quantidade;

        // Validação de limite para Day Use: erro 403 se limite excedido
        if (hospede.tipo === 'DAY_USE' && hospede.limiteGasto !== null) {
          const novaDivida = hospede.dividaAtual + valorTotal;
          if (novaDivida > hospede.limiteGasto) {
            throw new ForbiddenError(
              `Limite de crédito excedido. Limite: R$ ${hospede.limiteGasto.toFixed(2)}, ` +
              `Dívida atual: R$ ${hospede.dividaAtual.toFixed(2)}, ` +
              `Valor do pedido: R$ ${valorTotal.toFixed(2)}`
            );
          }
        }

        // Decrementar estoque
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoque: { decrement: quantidade } },
        });

        // Criar pedido (um por item)
        for (let i = 0; i < quantidade; i++) {
          // Obter data/hora no timezone brasileiro para fins legais
          const dataHoraBrasil = getDataHoraBrasil();
          
          const pedido = await tx.pedido.create({
            data: {
              hospedeId,
              produtoId: item.produtoId,
              valor: produto.preco,
              status: 'PENDENTE',
              metodoCriacao,
              gerenteId: metodoCriacao === 'MANUAL' ? gerenteId : null,
              usuarioId: usuarioId || null, // ID do garçom que criou o pedido
              data: dataHoraBrasil, // Data/hora no timezone brasileiro
            },
            include: {
              hospede: true,
              produto: true,
              gerente: true,
              usuario: true, // Incluir dados do garçom que criou
            },
          });
          pedidosCriados.push(pedido);
        }
      }

      // Atualizar dívida do hóspede (soma de todos os pedidos)
      const totalDivida = pedidosCriados.reduce((sum, p) => sum + p.valor, 0);
      await tx.hospede.update({
        where: { id: hospedeId },
        data: { dividaAtual: { increment: totalDivida } },
      });

      return pedidosCriados;
    });
  }

  /**
   * Cria um novo pedido com validações de negócio:
   * 1. Verifica limite de gasto para Day Use
   * 2. Verifica e decrementa estoque atomicamente
   * @deprecated Use criarPedidos() para múltiplos itens
   */
  async criarPedido(hospedeId: number, produtoId: number) {
    return await prisma.$transaction(async (tx) => {
      // Buscar hóspede
      const hospede = await tx.hospede.findUnique({
        where: { id: hospedeId },
      });

      if (!hospede) {
        throw new NotFoundError('Hóspede');
      }

      if (!hospede.ativo) {
        throw new BusinessError('Hóspede inativo');
      }

      // Buscar produto
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
      });

      if (!produto) {
        throw new NotFoundError('Produto');
      }

      // Validação de estoque
      if (produto.estoque <= 0) {
        throw new BusinessError('Produto sem estoque disponível');
      }

      // Validação de limite para Day Use
      if (hospede.tipo === 'DAY_USE' && hospede.limiteGasto !== null) {
        const novaDivida = hospede.dividaAtual + produto.preco;
        if (novaDivida > hospede.limiteGasto) {
          throw new BusinessError(
            `Limite de gasto excedido. Limite: R$ ${hospede.limiteGasto.toFixed(2)}, ` +
            `Dívida atual: R$ ${hospede.dividaAtual.toFixed(2)}, ` +
            `Valor do pedido: R$ ${produto.preco.toFixed(2)}`
          );
        }
      }

      // Decrementar estoque
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoque: { decrement: 1 } },
      });

      // Atualizar dívida do hóspede
      await tx.hospede.update({
        where: { id: hospedeId },
        data: { dividaAtual: { increment: produto.preco } },
      });

      // Criar pedido
      const pedido = await tx.pedido.create({
        data: {
          hospedeId,
          produtoId,
          valor: produto.preco,
          status: 'PENDENTE',
        },
        include: {
          hospede: true,
          produto: true,
        },
      });

      return pedido;
    });
  }

  async listarPedidos(
    status?: StatusPedido, 
    page: number = 1, 
    limit: number = 10, 
    busca?: string, 
    hospedeId?: number,
    metodoCriacao?: 'NFC' | 'MANUAL',
    usuarioId?: number,
    recente?: boolean
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status) where.status = status;
    if (hospedeId) where.hospedeId = hospedeId;
    if (metodoCriacao) where.metodoCriacao = metodoCriacao;
    if (usuarioId) where.usuarioId = usuarioId;
    
    // Filtro de pedidos recentes (últimas 24 horas)
    if (recente) {
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);
      where.data = {
        ...where.data,
        gte: dataLimite,
      };
    }
    
    if (busca) {
      where.OR = [
        { hospede: { nome: { contains: busca } } },
        { produto: { nome: { contains: busca } } },
      ];
    }

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          hospede: true,
          produto: true,
          gerente: true,
          usuario: true, // Incluir dados do garçom que criou
        },
        orderBy: { data: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pedido.count({ where }),
    ]);

    return {
      data: pedidos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async buscarPedido(id: number) {
    return await prisma.pedido.findUnique({
      where: { id },
      include: {
        hospede: true,
        produto: true,
        gerente: true, // Incluir gerente que autorizou (se houver)
        usuario: true, // Incluir garçom que criou o pedido (se houver)
      },
    });
  }

  async atualizarStatus(id: number, status: StatusPedido) {
    const dataHoraBrasil = getDataHoraBrasil();
    const updateData: any = { status };

    // Gravar timestamps conforme o status
    if (status === 'PREPARANDO' && !updateData.dataInicioPreparo) {
      // Buscar pedido para verificar se já tem dataInicioPreparo
      const pedidoAtual = await prisma.pedido.findUnique({
        where: { id },
        select: { dataInicioPreparo: true },
      });
      
      if (!pedidoAtual?.dataInicioPreparo) {
        updateData.dataInicioPreparo = dataHoraBrasil;
      }
    } else if (status === 'PRONTO') {
      updateData.dataPronto = dataHoraBrasil;
    }

    return await prisma.pedido.update({
      where: { id },
      data: updateData,
      include: {
        hospede: true,
        produto: true,
      },
    });
  }

  /**
   * Cancela um pedido com validação de PIN de gerente
   * @param id ID do pedido
   * @param managerPin PIN do gerente/administrador
   * @returns Pedido cancelado
   */
  async cancelarPedidoComPin(id: number, managerPin: string) {
    return await prisma.$transaction(async (tx) => {
      // Buscar pedido
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: { produto: true, hospede: true },
      });

      if (!pedido) {
        throw new NotFoundError('Pedido');
      }

      if (pedido.status === 'CANCELADO') {
        throw new BusinessError('Pedido já está cancelado');
      }

      // Validar PIN de gerente/administrador
      const gerente = await tx.usuario.findUnique({
        where: { pin: managerPin, ativo: true },
      });

      if (!gerente || (gerente.cargo !== 'MANAGER' && gerente.cargo !== 'ADMIN')) {
        throw new ForbiddenError('PIN de gerente inválido ou sem permissão para cancelar pedidos');
      }

      // Estornar estoque (devolver quantidade ao estoque)
      // Nota: cada pedido representa 1 unidade do produto
      await tx.produto.update({
        where: { id: pedido.produtoId },
        data: { estoque: { increment: 1 } },
      });

      // Estornar dívida (subtrair valor da dívida atual)
      await tx.hospede.update({
        where: { id: pedido.hospedeId },
        data: { dividaAtual: { decrement: pedido.valor } },
      });

      // Atualizar status para CANCELADO
      return await tx.pedido.update({
        where: { id },
        data: { status: 'CANCELADO' },
        include: {
          hospede: true,
          produto: true,
          gerente: true,
        },
      });
    });
  }

  /**
   * Cancela um pedido sem validação de PIN (método legado)
   * @deprecated Use cancelarPedidoComPin() para cancelamento seguro
   */
  async cancelarPedido(id: number) {
    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: { produto: true, hospede: true },
      });

      if (!pedido) {
        throw new NotFoundError('Pedido');
      }

      if (pedido.status === 'CANCELADO') {
        throw new BusinessError('Pedido já está cancelado');
      }

      // Reverter estoque
      await tx.produto.update({
        where: { id: pedido.produtoId },
        data: { estoque: { increment: 1 } },
      });

      // Reverter dívida
      await tx.hospede.update({
        where: { id: pedido.hospedeId },
        data: { dividaAtual: { decrement: pedido.valor } },
      });

      // Atualizar status
      return await tx.pedido.update({
        where: { id },
        data: { status: 'CANCELADO' },
        include: {
          hospede: true,
          produto: true,
        },
      });
    });
  }
}
