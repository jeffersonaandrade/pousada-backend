import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError } from '../lib/errors.js';
import { getDataHoraBrasil } from '../lib/dateUtils.js';

export class CaixaService {
  /**
   * Abre um novo caixa para o usuário
   * Valida que o usuário não tenha outro caixa aberto
   */
  async abrirCaixa(usuarioId: number, saldoInicial: number) {
    if (saldoInicial < 0) {
      throw new BusinessError('Saldo inicial não pode ser negativo');
    }

    return await prisma.$transaction(async (tx) => {
      // Verificar se o usuário já tem caixa aberto
      const caixaAberto = await tx.caixa.findFirst({
        where: {
          usuarioId,
          status: 'ABERTO',
        },
      });

      if (caixaAberto) {
        throw new BusinessError(
          `Usuário já possui um caixa aberto (ID: ${caixaAberto.id}, aberto em ${caixaAberto.dataAbertura.toLocaleString('pt-BR')})`
        );
      }

      // Verificar se o usuário existe
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
      });

      if (!usuario) {
        throw new NotFoundError('Usuário');
      }

      // Criar caixa
      const dataHoraBrasil = getDataHoraBrasil();
      const caixa = await tx.caixa.create({
        data: {
          usuarioId,
          saldoInicial,
          dataAbertura: dataHoraBrasil,
          status: 'ABERTO',
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              cargo: true,
            },
          },
        },
      });

      return caixa;
    });
  }

  /**
   * Fecha o caixa aberto do usuário
   * Calcula a quebra de caixa (diferença entre saldo esperado e saldo informado)
   */
  async fecharCaixa(
    usuarioId: number,
    saldoFinalDinheiro: number,
    saldoFinalCartao?: number,
    observacao?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      // Buscar caixa aberto do usuário
      const caixa = await tx.caixa.findFirst({
        where: {
          usuarioId,
          status: 'ABERTO',
        },
        include: {
          lancamentos: {
            orderBy: { data: 'asc' },
          },
        },
      });

      if (!caixa) {
        throw new BusinessError('Usuário não possui caixa aberto');
      }

      // Calcular saldo esperado em dinheiro
      const vendasDinheiro = caixa.lancamentos
        .filter((l) => l.tipo === 'VENDA')
        .reduce((sum, l) => sum + l.valor, 0);

      const sangrias = caixa.lancamentos
        .filter((l) => l.tipo === 'SANGRIA')
        .reduce((sum, l) => sum + Math.abs(l.valor), 0);

      const suprimentos = caixa.lancamentos
        .filter((l) => l.tipo === 'SUPRIMENTO')
        .reduce((sum, l) => sum + l.valor, 0);

      const saldoEsperadoDinheiro =
        caixa.saldoInicial + vendasDinheiro - sangrias + suprimentos;

      // Calcular quebra de caixa (diferença entre esperado e informado)
      const quebraCaixa = saldoFinalDinheiro - saldoEsperadoDinheiro;

      // Atualizar caixa
      const dataHoraBrasil = getDataHoraBrasil();
      const caixaFechado = await tx.caixa.update({
        where: { id: caixa.id },
        data: {
          status: 'FECHADO',
          dataFechamento: dataHoraBrasil,
          saldoFinalDinheiro,
          saldoFinalCartao: saldoFinalCartao || null,
          observacao: observacao
            ? `${observacao} | Quebra: R$ ${quebraCaixa.toFixed(2)}`
            : `Quebra de caixa: R$ ${quebraCaixa.toFixed(2)}`,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              cargo: true,
            },
          },
          lancamentos: {
            orderBy: { data: 'asc' },
          },
        },
      });

      return {
        ...caixaFechado,
        resumo: {
          saldoInicial: caixa.saldoInicial,
          vendasDinheiro,
          sangrias,
          suprimentos,
          saldoEsperadoDinheiro,
          saldoFinalDinheiro,
          quebraCaixa,
          totalLancamentos: caixa.lancamentos.length,
        },
      };
    });
  }

  /**
   * Retorna o status do caixa do usuário (se tem aberto e resumo)
   */
  async obterStatusCaixa(usuarioId: number) {
    const caixa = await prisma.caixa.findFirst({
      where: {
        usuarioId,
        status: 'ABERTO',
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            cargo: true,
          },
        },
        lancamentos: {
          orderBy: { data: 'desc' },
        },
      },
    });

    if (!caixa) {
      return {
        temCaixaAberto: false,
        caixa: null,
        resumo: null,
      };
    }

    // Calcular resumo
    const vendasDinheiro = caixa.lancamentos
      .filter((l) => l.tipo === 'VENDA')
      .reduce((sum, l) => sum + l.valor, 0);

    const sangrias = caixa.lancamentos
      .filter((l) => l.tipo === 'SANGRIA')
      .reduce((sum, l) => sum + Math.abs(l.valor), 0);

    const suprimentos = caixa.lancamentos
      .filter((l) => l.tipo === 'SUPRIMENTO')
      .reduce((sum, l) => sum + l.valor, 0);

    const saldoEsperadoDinheiro =
      caixa.saldoInicial + vendasDinheiro - sangrias + suprimentos;

    return {
      temCaixaAberto: true,
      caixa,
      resumo: {
        saldoInicial: caixa.saldoInicial,
        vendasDinheiro,
        sangrias,
        suprimentos,
        saldoEsperadoDinheiro,
        totalLancamentos: caixa.lancamentos.length,
        ultimosLancamentos: caixa.lancamentos.slice(0, 10), // Últimos 10 lançamentos
      },
    };
  }

  /**
   * Registra uma sangria (retirada de dinheiro do caixa)
   * @param tx Transação do Prisma (opcional, cria nova se não fornecido)
   */
  async registrarSangria(
    usuarioId: number,
    valor: number,
    observacao?: string,
    tx?: any
  ) {
    if (valor <= 0) {
      throw new BusinessError('Valor da sangria deve ser maior que zero');
    }

    const prismaClient = tx || prisma;

    // Se não estiver em transação, criar uma
    if (!tx) {
      return await prisma.$transaction(async (transaction) => {
        return this.registrarSangria(usuarioId, valor, observacao, transaction);
      });
    }

    // Executar dentro da transação fornecida
    // Buscar caixa aberto
    const caixa = await prismaClient.caixa.findFirst({
      where: {
        usuarioId,
        status: 'ABERTO',
      },
    });

    if (!caixa) {
      throw new BusinessError('Usuário não possui caixa aberto');
    }

    // Verificar se há saldo suficiente
    const lancamentos = await prismaClient.lancamentoCaixa.findMany({
      where: { caixaId: caixa.id },
    });

    const vendasDinheiro = lancamentos
      .filter((l) => l.tipo === 'VENDA')
      .reduce((sum, l) => sum + l.valor, 0);

    const sangrias = lancamentos
      .filter((l) => l.tipo === 'SANGRIA')
      .reduce((sum, l) => sum + Math.abs(l.valor), 0);

    const suprimentos = lancamentos
      .filter((l) => l.tipo === 'SUPRIMENTO')
      .reduce((sum, l) => sum + l.valor, 0);

    const saldoAtual =
      caixa.saldoInicial + vendasDinheiro - sangrias + suprimentos;

    if (valor > saldoAtual) {
      throw new BusinessError(
        `Saldo insuficiente para sangria. Saldo atual: R$ ${saldoAtual.toFixed(2)}, Valor solicitado: R$ ${valor.toFixed(2)}`
      );
    }

    // Criar lançamento de sangria (valor negativo)
    const dataHoraBrasil = getDataHoraBrasil();
    const lancamento = await prismaClient.lancamentoCaixa.create({
      data: {
        caixaId: caixa.id,
        tipo: 'SANGRIA',
        valor: -valor, // Negativo para representar saída
        observacao: observacao || 'Sangria registrada',
        data: dataHoraBrasil,
      },
    });

    return lancamento;
  }

  /**
   * Registra um suprimento (adição de dinheiro ao caixa)
   */
  async registrarSuprimento(
    usuarioId: number,
    valor: number,
    observacao?: string
  ) {
    if (valor <= 0) {
      throw new BusinessError('Valor do suprimento deve ser maior que zero');
    }

    return await prisma.$transaction(async (tx) => {
      // Buscar caixa aberto
      const caixa = await tx.caixa.findFirst({
        where: {
          usuarioId,
          status: 'ABERTO',
        },
      });

      if (!caixa) {
        throw new BusinessError('Usuário não possui caixa aberto');
      }

      // Criar lançamento de suprimento
      const dataHoraBrasil = getDataHoraBrasil();
      const lancamento = await tx.lancamentoCaixa.create({
        data: {
          caixaId: caixa.id,
          tipo: 'SUPRIMENTO',
          valor: valor, // Positivo para representar entrada
          observacao: observacao || 'Suprimento registrado',
          data: dataHoraBrasil,
        },
      });

      return lancamento;
    });
  }

  /**
   * Registra uma venda em dinheiro automaticamente
   * Chamado quando um pagamento em DINHEIRO é realizado
   * @param tx Transação do Prisma (opcional, cria nova se não fornecido)
   */
  async registrarVenda(
    usuarioId: number,
    valor: number,
    observacao?: string,
    tx?: any
  ) {
    if (valor <= 0) {
      throw new BusinessError('Valor da venda deve ser maior que zero');
    }

    const prismaClient = tx || prisma;

    // Se não estiver em transação, criar uma
    if (!tx) {
      return await prisma.$transaction(async (transaction) => {
        return this.registrarVenda(usuarioId, valor, observacao, transaction);
      });
    }

    // Buscar caixa aberto do usuário
    const caixa = await prismaClient.caixa.findFirst({
      where: {
        usuarioId,
        status: 'ABERTO',
      },
    });

    // Se não houver caixa aberto, não cria lançamento (não é erro crítico)
    // Mas loga um aviso
    if (!caixa) {
      console.warn(
        `Tentativa de registrar venda em dinheiro (R$ ${valor.toFixed(2)}) para usuário ${usuarioId} sem caixa aberto`
      );
      return null;
    }

    // Criar lançamento de venda
    const dataHoraBrasil = getDataHoraBrasil();
    const lancamento = await prismaClient.lancamentoCaixa.create({
      data: {
        caixaId: caixa.id,
        tipo: 'VENDA',
        valor: valor,
        observacao: observacao || 'Venda em dinheiro',
        data: dataHoraBrasil,
      },
    });

    return lancamento;
  }
}

