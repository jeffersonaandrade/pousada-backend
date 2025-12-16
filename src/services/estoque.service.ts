import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError, ValidationError } from '../lib/errors.js';
import { getDataHoraBrasil } from '../lib/dateUtils.js';

export class EstoqueService {
  /**
   * Registra uma baixa técnica (perda de estoque)
   * Decrementa o estoque do produto e registra o motivo
   * @param produtoId ID do produto
   * @param quantidade Quantidade perdida
   * @param motivo Motivo da perda (Quebra, Vencimento, Erro)
   * @param observacao Observação adicional (opcional)
   * @param usuarioId ID do usuário que registrou a baixa
   */
  async registrarBaixa(
    produtoId: number,
    quantidade: number,
    motivo: string,
    observacao: string | undefined,
    usuarioId: number
  ) {
    if (quantidade <= 0) {
      throw new ValidationError('Quantidade deve ser maior que zero');
    }

    if (!motivo || motivo.trim() === '') {
      throw new ValidationError('Motivo é obrigatório');
    }

    return await prisma.$transaction(async (tx) => {
      // Buscar produto
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
      });

      if (!produto) {
        throw new NotFoundError('Produto');
      }

      // Verificar se há estoque suficiente
      if (produto.estoque < quantidade) {
        throw new BusinessError(
          `Estoque insuficiente. Disponível: ${produto.estoque}, Solicitado: ${quantidade}`
        );
      }

      // Permitir baixa mesmo se estoque for zero (para registrar perdas de produtos já esgotados)
      // Mas validar que não pode baixar mais do que tem

      // Decrementar estoque
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoque: { decrement: quantidade } },
      });

      // Registrar a perda
      const perda = await tx.perdaEstoque.create({
        data: {
          produtoId,
          quantidade,
          motivo: motivo.trim(),
          observacao: observacao?.trim() || null,
          data: getDataHoraBrasil(), // Horário brasileiro
          usuarioId,
        },
        include: {
          produto: true,
          usuario: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });

      return perda;
    });
  }

  /**
   * Lista as baixas técnicas registradas
   */
  async listarBaixas(
    produtoId?: number,
    page: number = 1,
    limit: number = 50,
    dataInicio?: string,
    dataFim?: string
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (produtoId) where.produtoId = produtoId;

    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) {
        const inicio = new Date(dataInicio + 'T00:00:00');
        where.data.gte = inicio;
      }
      if (dataFim) {
        const fim = new Date(dataFim + 'T23:59:59');
        fim.setHours(23, 59, 59, 999);
        where.data.lte = fim;
      }
    }

    const [perdas, total] = await Promise.all([
      prisma.perdaEstoque.findMany({
        where,
        include: {
          produto: {
            select: {
              id: true,
              nome: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
        orderBy: { data: 'desc' },
        skip,
        take: limit,
      }),
      prisma.perdaEstoque.count({ where }),
    ]);

    return {
      data: perdas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

