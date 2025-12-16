import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError } from '../lib/errors.js';
import { getDataHoraBrasil } from '../lib/dateUtils.js';
import { CaixaService } from './caixa.service.js';

export class FinanceiroService {
  private caixaService: CaixaService;

  constructor() {
    this.caixaService = new CaixaService();
  }

  // ========== CATEGORIAS ==========

  async listarCategorias(tipo?: 'DESPESA' | 'RECEITA') {
    const where: any = {};
    if (tipo) where.tipo = tipo;

    return await prisma.categoriaFinanceira.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async criarCategoria(data: { nome: string; tipo: 'DESPESA' | 'RECEITA' }) {
    return await prisma.categoriaFinanceira.create({
      data,
    });
  }

  async atualizarCategoria(id: number, data: { nome?: string; tipo?: 'DESPESA' | 'RECEITA' }) {
    const categoria = await prisma.categoriaFinanceira.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundError('Categoria');
    }

    return await prisma.categoriaFinanceira.update({
      where: { id },
      data,
    });
  }

  async removerCategoria(id: number) {
    const categoria = await prisma.categoriaFinanceira.findUnique({
      where: { id },
      include: {
        contasPagar: true,
        contasReceber: true,
      },
    });

    if (!categoria) {
      throw new NotFoundError('Categoria');
    }

    // Verificar se há contas vinculadas
    if (categoria.contasPagar.length > 0 || categoria.contasReceber.length > 0) {
      throw new BusinessError(
        'Não é possível remover categoria com contas vinculadas. Remova ou altere as contas primeiro.'
      );
    }

    return await prisma.categoriaFinanceira.delete({
      where: { id },
    });
  }

  // ========== CONTAS A PAGAR ==========

  async listarContasPagar(filtros?: {
    status?: string;
    categoriaId?: number;
    dataInicio?: Date;
    dataFim?: Date;
  }) {
    const where: any = {};

    if (filtros?.status) {
      where.status = filtros.status;
    }

    if (filtros?.categoriaId) {
      where.categoriaId = filtros.categoriaId;
    }

    if (filtros?.dataInicio || filtros?.dataFim) {
      where.dataVencimento = {};
      if (filtros.dataInicio) {
        where.dataVencimento.gte = filtros.dataInicio;
      }
      if (filtros.dataFim) {
        where.dataVencimento.lte = filtros.dataFim;
      }
    }

    return await prisma.contaPagar.findMany({
      where,
      include: {
        categoria: true,
      },
      orderBy: { dataVencimento: 'asc' },
    });
  }

  async criarContaPagar(data: {
    descricao: string;
    valor: number;
    dataVencimento: Date;
    categoriaId: number;
    fornecedor?: string;
    observacao?: string;
  }) {
    // Validar categoria
    const categoria = await prisma.categoriaFinanceira.findUnique({
      where: { id: data.categoriaId },
    });

    if (!categoria) {
      throw new NotFoundError('Categoria');
    }

    if (categoria.tipo !== 'DESPESA') {
      throw new BusinessError('Categoria deve ser do tipo DESPESA para contas a pagar');
    }

    // Determinar status inicial (se vencimento já passou, marcar como ATRASADO)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(data.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);

    const status = vencimento < hoje ? 'ATRASADO' : 'PENDENTE';

    return await prisma.contaPagar.create({
      data: {
        ...data,
        status,
      },
      include: {
        categoria: true,
      },
    });
  }

  async atualizarContaPagar(
    id: number,
    data: {
      descricao?: string;
      valor?: number;
      dataVencimento?: Date;
      categoriaId?: number;
      fornecedor?: string;
      observacao?: string;
    }
  ) {
    const conta = await prisma.contaPagar.findUnique({
      where: { id },
    });

    if (!conta) {
      throw new NotFoundError('Conta a pagar');
    }

    // Se já foi paga, não permite edição
    if (conta.status === 'PAGO') {
      throw new BusinessError('Não é possível editar conta já paga');
    }

    // Validar categoria se fornecida
    if (data.categoriaId) {
      const categoria = await prisma.categoriaFinanceira.findUnique({
        where: { id: data.categoriaId },
      });

      if (!categoria) {
        throw new NotFoundError('Categoria');
      }

      if (categoria.tipo !== 'DESPESA') {
        throw new BusinessError('Categoria deve ser do tipo DESPESA');
      }
    }

    // Recalcular status se data de vencimento mudou
    let status = conta.status;
    if (data.dataVencimento) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(data.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);

      if (conta.status === 'PENDENTE' || conta.status === 'ATRASADO') {
        status = vencimento < hoje ? 'ATRASADO' : 'PENDENTE';
      }
    }

    return await prisma.contaPagar.update({
      where: { id },
      data: {
        ...data,
        status,
      },
      include: {
        categoria: true,
      },
    });
  }

  async removerContaPagar(id: number) {
    const conta = await prisma.contaPagar.findUnique({
      where: { id },
    });

    if (!conta) {
      throw new NotFoundError('Conta a pagar');
    }

    // Não permite remover conta já paga
    if (conta.status === 'PAGO') {
      throw new BusinessError('Não é possível remover conta já paga');
    }

    return await prisma.contaPagar.delete({
      where: { id },
    });
  }

  /**
   * Baixa de conta a pagar (pagar conta)
   * Se método for DINHEIRO e houver caixaId, registra sangria automaticamente
   */
  async pagarConta(
    id: number,
    data: {
      metodoPagamento: string;
      dataPagamento?: Date;
      usuarioId?: number;
      caixaId?: number;
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      const conta = await tx.contaPagar.findUnique({
        where: { id },
      });

      if (!conta) {
        throw new NotFoundError('Conta a pagar');
      }

      if (conta.status === 'PAGO') {
        throw new BusinessError('Conta já foi paga');
      }

      const dataHoraBrasil = getDataHoraBrasil();
      const dataPagamento = data.dataPagamento || dataHoraBrasil;

      // Se pagamento for em DINHEIRO e houver usuarioId, registrar sangria no caixa
      if (data.metodoPagamento === 'DINHEIRO' && data.usuarioId) {
        try {
          await this.caixaService.registrarSangria(
            data.usuarioId,
            conta.valor,
            `Pagamento de conta: ${conta.descricao}${conta.fornecedor ? ` - ${conta.fornecedor}` : ''}`,
            tx // Passar transação atual
          );
        } catch (error) {
          // Se não houver caixa aberto, não falha o pagamento
          // Mas loga o aviso
          console.warn(
            `Tentativa de pagar conta em dinheiro (R$ ${conta.valor.toFixed(2)}) sem caixa aberto`
          );
        }
      }

      // Atualizar conta
      const contaAtualizada = await tx.contaPagar.update({
        where: { id },
        data: {
          status: 'PAGO',
          dataPagamento,
          metodoPagamento: data.metodoPagamento,
        },
        include: {
          categoria: true,
        },
      });

      return contaAtualizada;
    });
  }

  // ========== CONTAS A RECEBER ==========

  async listarContasReceber(filtros?: {
    status?: string;
    categoriaId?: number;
    origem?: string;
    dataInicio?: Date;
    dataFim?: Date;
  }) {
    const where: any = {};

    if (filtros?.status) {
      where.status = filtros.status;
    }

    if (filtros?.categoriaId) {
      where.categoriaId = filtros.categoriaId;
    }

    if (filtros?.origem) {
      where.origem = filtros.origem;
    }

    if (filtros?.dataInicio || filtros?.dataFim) {
      where.dataVencimento = {};
      if (filtros.dataInicio) {
        where.dataVencimento.gte = filtros.dataInicio;
      }
      if (filtros.dataFim) {
        where.dataVencimento.lte = filtros.dataFim;
      }
    }

    return await prisma.contaReceber.findMany({
      where,
      include: {
        categoria: true,
      },
      orderBy: { dataVencimento: 'asc' },
    });
  }

  async criarContaReceber(data: {
    descricao: string;
    valor: number;
    dataVencimento: Date;
    categoriaId: number;
    origem: 'HOSPEDE' | 'CARTAO_CREDITO' | 'OUTROS';
    observacao?: string;
  }) {
    // Validar categoria
    const categoria = await prisma.categoriaFinanceira.findUnique({
      where: { id: data.categoriaId },
    });

    if (!categoria) {
      throw new NotFoundError('Categoria');
    }

    if (categoria.tipo !== 'RECEITA') {
      throw new BusinessError('Categoria deve ser do tipo RECEITA para contas a receber');
    }

    // Determinar status inicial
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(data.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);

    const status = vencimento < hoje ? 'ATRASADO' : 'PENDENTE';

    return await prisma.contaReceber.create({
      data: {
        ...data,
        status,
      },
      include: {
        categoria: true,
      },
    });
  }

  async atualizarContaReceber(
    id: number,
    data: {
      descricao?: string;
      valor?: number;
      dataVencimento?: Date;
      categoriaId?: number;
      origem?: 'HOSPEDE' | 'CARTAO_CREDITO' | 'OUTROS';
      observacao?: string;
    }
  ) {
    const conta = await prisma.contaReceber.findUnique({
      where: { id },
    });

    if (!conta) {
      throw new NotFoundError('Conta a receber');
    }

    // Se já foi recebida, não permite edição
    if (conta.status === 'RECEBIDO') {
      throw new BusinessError('Não é possível editar conta já recebida');
    }

    // Validar categoria se fornecida
    if (data.categoriaId) {
      const categoria = await prisma.categoriaFinanceira.findUnique({
        where: { id: data.categoriaId },
      });

      if (!categoria) {
        throw new NotFoundError('Categoria');
      }

      if (categoria.tipo !== 'RECEITA') {
        throw new BusinessError('Categoria deve ser do tipo RECEITA');
      }
    }

    // Recalcular status se data de vencimento mudou
    let status = conta.status;
    if (data.dataVencimento) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(data.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);

      if (conta.status === 'PENDENTE' || conta.status === 'ATRASADO') {
        status = vencimento < hoje ? 'ATRASADO' : 'PENDENTE';
      }
    }

    return await prisma.contaReceber.update({
      where: { id },
      data: {
        ...data,
        status,
      },
      include: {
        categoria: true,
      },
    });
  }

  async removerContaReceber(id: number) {
    const conta = await prisma.contaReceber.findUnique({
      where: { id },
    });

    if (!conta) {
      throw new NotFoundError('Conta a receber');
    }

    // Não permite remover conta já recebida
    if (conta.status === 'RECEBIDO') {
      throw new BusinessError('Não é possível remover conta já recebida');
    }

    return await prisma.contaReceber.delete({
      where: { id },
    });
  }

  async receberConta(id: number, dataRecebimento?: Date) {
    const conta = await prisma.contaReceber.findUnique({
      where: { id },
    });

    if (!conta) {
      throw new NotFoundError('Conta a receber');
    }

    if (conta.status === 'RECEBIDO') {
      throw new BusinessError('Conta já foi recebida');
    }

    const dataHoraBrasil = getDataHoraBrasil();
    const dataReceb = dataRecebimento || dataHoraBrasil;

    return await prisma.contaReceber.update({
      where: { id },
      data: {
        status: 'RECEBIDO',
        dataRecebimento: dataReceb,
      },
      include: {
        categoria: true,
      },
    });
  }

  // ========== DASHBOARD FINANCEIRO ==========

  async obterDashboard() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Contas a Pagar
    const todasContasPagar = await prisma.contaPagar.findMany({
      where: {
        status: { not: 'PAGO' },
      },
    });

    const contasPagarVencidas = todasContasPagar.filter(
      (c) => new Date(c.dataVencimento) < hoje
    );
    const contasPagarHoje = todasContasPagar.filter(
      (c) => {
        const venc = new Date(c.dataVencimento);
        venc.setHours(0, 0, 0, 0);
        return venc.getTime() === hoje.getTime();
      }
    );
    const contasPagarFuturas = todasContasPagar.filter(
      (c) => new Date(c.dataVencimento) > hoje
    );

    // Contas a Receber
    const todasContasReceber = await prisma.contaReceber.findMany({
      where: {
        status: { not: 'RECEBIDO' },
      },
    });

    const contasReceberVencidas = todasContasReceber.filter(
      (c) => new Date(c.dataVencimento) < hoje
    );
    const contasReceberHoje = todasContasReceber.filter(
      (c) => {
        const venc = new Date(c.dataVencimento);
        venc.setHours(0, 0, 0, 0);
        return venc.getTime() === hoje.getTime();
      }
    );
    const contasReceberFuturas = todasContasReceber.filter(
      (c) => new Date(c.dataVencimento) > hoje
    );

    return {
      contasPagar: {
        vencidas: {
          quantidade: contasPagarVencidas.length,
          valor: contasPagarVencidas.reduce((sum, c) => sum + c.valor, 0),
        },
        hoje: {
          quantidade: contasPagarHoje.length,
          valor: contasPagarHoje.reduce((sum, c) => sum + c.valor, 0),
        },
        futuras: {
          quantidade: contasPagarFuturas.length,
          valor: contasPagarFuturas.reduce((sum, c) => sum + c.valor, 0),
        },
        total: {
          quantidade: todasContasPagar.length,
          valor: todasContasPagar.reduce((sum, c) => sum + c.valor, 0),
        },
      },
      contasReceber: {
        vencidas: {
          quantidade: contasReceberVencidas.length,
          valor: contasReceberVencidas.reduce((sum, c) => sum + c.valor, 0),
        },
        hoje: {
          quantidade: contasReceberHoje.length,
          valor: contasReceberHoje.reduce((sum, c) => sum + c.valor, 0),
        },
        futuras: {
          quantidade: contasReceberFuturas.length,
          valor: contasReceberFuturas.reduce((sum, c) => sum + c.valor, 0),
        },
        total: {
          quantidade: todasContasReceber.length,
          valor: todasContasReceber.reduce((sum, c) => sum + c.valor, 0),
        },
      },
    };
  }
}

