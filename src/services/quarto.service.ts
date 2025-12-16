import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError, ValidationError } from '../lib/errors.js';

export class QuartoService {
  /**
   * Lista todos os quartos com seus status
   */
  async listarQuartos() {
    return await prisma.quarto.findMany({
      orderBy: [
        { andar: 'asc' },
        { numero: 'asc' },
      ],
      include: {
        hospedes: {
          where: { ativo: true },
          select: {
            id: true,
            nome: true,
            tipo: true,
          },
          take: 1, // Apenas o hóspede atual (se houver)
        },
      },
    });
  }

  /**
   * Busca um quarto por ID
   */
  async buscarQuarto(id: number) {
    const quarto = await prisma.quarto.findUnique({
      where: { id },
      include: {
        hospedes: {
          where: { ativo: true },
          select: {
            id: true,
            nome: true,
            tipo: true,
          },
        },
      },
    });

    if (!quarto) {
      throw new NotFoundError('Quarto');
    }

    return quarto;
  }

  /**
   * Busca um quarto por número
   */
  async buscarQuartoPorNumero(numero: string) {
    return await prisma.quarto.findUnique({
      where: { numero },
      include: {
        hospedes: {
          where: { ativo: true },
          select: {
            id: true,
            nome: true,
            tipo: true,
          },
        },
      },
    });
  }

  /**
   * Atualiza o status de um quarto
   * Regras:
   * - LIMPEZA pode ser mudado para LIVRE
   * - LIVRE pode ser mudado para OCUPADO, LIMPEZA ou MANUTENCAO
   * - OCUPADO só pode ser mudado para LIMPEZA ou MANUTENCAO (via checkout)
   * - MANUTENCAO pode ser mudado para LIVRE
   */
  async atualizarStatus(id: number, novoStatus: string) {
    const statusValidos = ['LIVRE', 'OCUPADO', 'LIMPEZA', 'MANUTENCAO'];
    
    if (!statusValidos.includes(novoStatus)) {
      throw new BusinessError(`Status inválido. Valores permitidos: ${statusValidos.join(', ')}`);
    }

    const quarto = await prisma.quarto.findUnique({
      where: { id },
      include: {
        hospedes: {
          where: { ativo: true },
        },
      },
    });

    if (!quarto) {
      throw new NotFoundError('Quarto');
    }

    // Validações de transição de status
    if (quarto.status === 'OCUPADO' && novoStatus === 'LIVRE') {
      throw new BusinessError('Não é possível mudar um quarto OCUPADO diretamente para LIVRE. Primeiro mude para LIMPEZA.');
    }

    if (quarto.status === 'OCUPADO' && quarto.hospedes.length > 0) {
      throw new BusinessError('Não é possível mudar o status de um quarto que ainda possui hóspede ativo. Realize o checkout primeiro.');
    }

    return await prisma.quarto.update({
      where: { id },
      data: { status: novoStatus },
    });
  }

  /**
   * Valida se um quarto está disponível para check-in
   * Retorna o quarto se estiver LIVRE, lança erro caso contrário
   */
  async validarQuartoDisponivel(quartoId: number) {
    const quarto = await prisma.quarto.findUnique({
      where: { id: quartoId },
      include: {
        hospedes: {
          where: { ativo: true },
        },
      },
    });

    if (!quarto) {
      throw new NotFoundError('Quarto');
    }

    if (quarto.status !== 'LIVRE') {
      throw new BusinessError(
        `Quarto ${quarto.numero} não está disponível. Status atual: ${quarto.status}. ` +
        `Apenas quartos com status LIVRE podem ser ocupados.`
      );
    }

    if (quarto.hospedes.length > 0) {
      throw new BusinessError(
        `Quarto ${quarto.numero} já possui um hóspede ativo. Realize o checkout primeiro.`
      );
    }

    return quarto;
  }

  /**
   * Marca um quarto como OCUPADO (usado no check-in)
   */
  async ocuparQuarto(quartoId: number) {
    return await prisma.quarto.update({
      where: { id: quartoId },
      data: { status: 'OCUPADO' },
    });
  }

  /**
   * Marca um quarto como LIMPEZA (usado no check-out)
   */
  async liberarQuarto(quartoId: number) {
    return await prisma.quarto.update({
      where: { id: quartoId },
      data: { status: 'LIMPEZA' },
    });
  }

  /**
   * Cria um novo quarto
   * Validação: número deve ser único
   * Status nasce como LIVRE
   */
  async criarQuarto(data: {
    numero: string;
    andar: number;
    categoria: string;
  }) {
    // Validações
    if (!data.numero || data.numero.trim() === '') {
      throw new ValidationError('Número do quarto é obrigatório');
    }

    if (!data.andar || data.andar < 1) {
      throw new ValidationError('Andar deve ser um número maior que zero');
    }

    if (!data.categoria || data.categoria.trim() === '') {
      throw new ValidationError('Categoria do quarto é obrigatória');
    }

    // Verificar se o número já existe
    const quartoExistente = await prisma.quarto.findUnique({
      where: { numero: data.numero.trim() },
    });

    if (quartoExistente) {
      throw new BusinessError(`Já existe um quarto com o número ${data.numero}`);
    }

    // Criar quarto (status nasce como LIVRE por padrão)
    return await prisma.quarto.create({
      data: {
        numero: data.numero.trim(),
        andar: data.andar,
        categoria: data.categoria.trim(),
        status: 'LIVRE',
      },
    });
  }

  /**
   * Atualiza dados cadastrais do quarto (número, categoria)
   * Não permite atualizar status (use atualizarStatus para isso)
   */
  async atualizarQuarto(
    id: number,
    data: {
      numero?: string;
      categoria?: string;
      andar?: number;
    }
  ) {
    // Buscar quarto existente
    const quarto = await prisma.quarto.findUnique({
      where: { id },
    });

    if (!quarto) {
      throw new NotFoundError('Quarto');
    }

    // Preparar dados para atualização
    const dadosAtualizacao: any = {};

    if (data.numero !== undefined) {
      if (data.numero.trim() === '') {
        throw new ValidationError('Número do quarto não pode ser vazio');
      }

      // Verificar se o novo número já existe (se for diferente do atual)
      if (data.numero.trim() !== quarto.numero) {
        const quartoExistente = await prisma.quarto.findUnique({
          where: { numero: data.numero.trim() },
        });

        if (quartoExistente) {
          throw new BusinessError(`Já existe um quarto com o número ${data.numero}`);
        }
      }

      dadosAtualizacao.numero = data.numero.trim();
    }

    if (data.categoria !== undefined) {
      if (data.categoria.trim() === '') {
        throw new ValidationError('Categoria do quarto não pode ser vazia');
      }
      dadosAtualizacao.categoria = data.categoria.trim();
    }

    if (data.andar !== undefined) {
      if (data.andar < 1) {
        throw new ValidationError('Andar deve ser um número maior que zero');
      }
      dadosAtualizacao.andar = data.andar;
    }

    // Se não houver dados para atualizar, retornar o quarto atual
    if (Object.keys(dadosAtualizacao).length === 0) {
      return quarto;
    }

    // Atualizar quarto
    return await prisma.quarto.update({
      where: { id },
      data: dadosAtualizacao,
    });
  }

  /**
   * Remove um quarto
   * Regra de Segurança: Só permite exclusão se:
   * - Status for LIVRE
   * - Não tiver hóspede ativo vinculado
   */
  async deletarQuarto(id: number) {
    // Buscar quarto com hóspedes ativos
    const quarto = await prisma.quarto.findUnique({
      where: { id },
      include: {
        hospedes: {
          where: { ativo: true },
        },
      },
    });

    if (!quarto) {
      throw new NotFoundError('Quarto');
    }

    // Validações de segurança
    if (quarto.status !== 'LIVRE') {
      throw new BusinessError(
        `Não é possível excluir o quarto ${quarto.numero}. Status atual: ${quarto.status}. ` +
        `Apenas quartos com status LIVRE podem ser excluídos.`
      );
    }

    if (quarto.hospedes.length > 0) {
      throw new BusinessError(
        `Não é possível excluir o quarto ${quarto.numero}. Existe(m) ${quarto.hospedes.length} hóspede(s) ativo(s) vinculado(s). ` +
        `Realize o checkout de todos os hóspedes antes de excluir o quarto.`
      );
    }

    // Verificar se há histórico de hóspedes (mesmo que inativos)
    const totalHospedes = await prisma.hospede.count({
      where: { quartoId: id },
    });

    if (totalHospedes > 0) {
      // Avisar sobre histórico, mas permitir exclusão (V1 - sem soft delete)
      // Em versões futuras, pode-se implementar soft delete
      console.warn(
        `Atenção: O quarto ${quarto.numero} possui ${totalHospedes} registro(s) histórico(s) de hóspedes. ` +
        `A exclusão será permanente.`
      );
    }

    // Excluir quarto
    return await prisma.quarto.delete({
      where: { id },
    });
  }
}

