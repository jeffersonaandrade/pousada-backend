import { TipoCliente } from '../types/enums.js';
import { prisma } from '../lib/prisma.js';
import { ValidationError, NotFoundError, BusinessError } from '../lib/errors.js';
import { getDataHoraBrasil } from '../lib/dateUtils.js';
import { QuartoService } from './quarto.service.js';
import { CaixaService } from './caixa.service.js';

export class HospedeService {
  private quartoService: QuartoService;
  private caixaService: CaixaService;

  constructor() {
    this.quartoService = new QuartoService();
    this.caixaService = new CaixaService();
  }

  /**
   * Busca ou cria produto especial para diária/day use
   * Produtos especiais não consomem estoque
   * @param tx Transação do Prisma (opcional, se não fornecido usa prisma direto)
   */
  private async buscarOuCriarProdutoDiaria(
    tipo: TipoCliente,
    tx?: any
  ): Promise<number> {
    const nomeProduto = tipo === 'DAY_USE' ? 'Day Use' : 'Diária';
    const prismaClient = tx || prisma;
    
    // Buscar produto existente
    let produto = await prismaClient.produto.findFirst({
      where: { nome: nomeProduto },
    });

    // Se não existir, criar (sem estoque, pois é serviço)
    if (!produto) {
      produto = await prismaClient.produto.create({
        data: {
          nome: nomeProduto,
          preco: 0, // Preço será definido no momento do check-in
          estoque: 999999, // Estoque infinito para serviços
          categoria: 'Serviço',
          descricao: `Produto especial para ${nomeProduto.toLowerCase()}`,
          visivelCardapio: false, // Produtos de serviço não aparecem no cardápio
        },
      });
    }

    return produto.id;
  }

  /**
   * Cria hóspede com check-in completo
   * Se valorEntrada for fornecido, cria automaticamente um pedido de diária/day use
   * Se pagoNaEntrada for true, cria registro de pagamento e abate a dívida
   */
  async criarHospede(data: {
    tipo: TipoCliente;
    nome: string;
    documento?: string;
    telefone?: string;
    email?: string;
    quarto?: string; // DEPRECATED: Número do quarto (string) - mantido para compatibilidade
    quartoId?: number; // ID do quarto (preferencial)
    uidPulseira: string;
    limiteGasto?: number;
    origem?: string;
    valorEntrada?: number; // Valor da diária/day use para criar pedido automaticamente
    pagoNaEntrada?: boolean; // Se true, registra pagamento e zera a dívida inicial
    metodoPagamento?: string; // PIX, DINHEIRO, CARTAO, DEBITO (obrigatório se pagoNaEntrada = true)
  }) {
    // Validações de negócio
    if (data.tipo === 'DAY_USE' && !data.documento) {
      throw new ValidationError('Documento é obrigatório para Day Use');
    }

    // Para HOSPEDE, quarto é obrigatório (pode ser quartoId ou quarto string)
    if (data.tipo === 'HOSPEDE' && !data.quartoId && !data.quarto) {
      throw new ValidationError('Quarto é obrigatório para Hóspede');
    }

    // Validação: se pagoNaEntrada for true, metodoPagamento é obrigatório
    if (data.pagoNaEntrada && !data.metodoPagamento) {
      throw new ValidationError('Método de pagamento é obrigatório quando o pagamento é feito na entrada');
    }

    // Resolver quartoId: se fornecido quartoId, usar; se fornecido quarto (string), buscar por número
    let quartoId: number | undefined = data.quartoId;
    let numeroQuarto: string | undefined = data.quarto;

    if (data.tipo === 'HOSPEDE' && !quartoId && data.quarto) {
      // Buscar quarto por número
      const quarto = await this.quartoService.buscarQuartoPorNumero(data.quarto);
      if (!quarto) {
        throw new NotFoundError(`Quarto ${data.quarto}`);
      }
      quartoId = quarto.id;
      numeroQuarto = quarto.numero;
    }

    // Se for HOSPEDE, validar que o quarto está disponível e ocupá-lo
    if (data.tipo === 'HOSPEDE' && quartoId) {
      await this.quartoService.validarQuartoDisponivel(quartoId);
    }

    // Converter valorEntrada para número se for string
    const valorEntrada = typeof data.valorEntrada === 'string' 
      ? parseFloat(data.valorEntrada) 
      : data.valorEntrada;

    // Se valorEntrada for fornecido, criar hóspede, pedido e pagamento (se aplicável) em transação
    if (valorEntrada !== undefined && !isNaN(valorEntrada) && valorEntrada > 0) {
      return await prisma.$transaction(async (tx) => {
        // Lógica OBRIGATÓRIA: Se pagou na entrada, começa com 0. Se não pagou, começa com o valor da entrada.
        // Forçar definição explícita para garantir que prevaleça sobre qualquer valor default
        const dividaInicial = data.pagoNaEntrada === true ? 0 : valorEntrada;

        // Log para debug
        console.log('CriarHospede - Debug:', {
          valorEntrada,
          pagoNaEntrada: data.pagoNaEntrada,
          tipoPagoNaEntrada: typeof data.pagoNaEntrada,
          dividaInicial,
        });

        // Se for HOSPEDE, ocupar o quarto (mudar status para OCUPADO)
        if (data.tipo === 'HOSPEDE' && quartoId) {
          await tx.quarto.update({
            where: { id: quartoId },
            data: { status: 'OCUPADO' },
          });
        }

        // Criar hóspede
        const hospede = await tx.hospede.create({
          data: {
            tipo: data.tipo,
            nome: data.nome,
            documento: data.documento,
            telefone: data.telefone,
            email: data.email,
            quarto: numeroQuarto, // Mantido para compatibilidade
            quartoId: quartoId, // ID do quarto (obrigatório para HOSPEDE)
            uidPulseira: data.uidPulseira,
            limiteGasto: data.limiteGasto,
            origem: data.origem || 'BALCAO',
            dividaAtual: dividaInicial, // FORÇAR: Se pagou na entrada (true), começa com 0. Se não pagou (false/undefined), começa com valorEntrada
          },
        });

        // Buscar ou criar produto de diária (usando a transação)
        const produtoDiariaId = await this.buscarOuCriarProdutoDiaria(data.tipo, tx);
        
        // Atualizar preço do produto se necessário (para refletir o valor real)
        await tx.produto.update({
          where: { id: produtoDiariaId },
          data: { preco: valorEntrada },
        });

        // Criar pedido de diária automaticamente
        const dataHoraBrasil = getDataHoraBrasil();
        await tx.pedido.create({
          data: {
            hospedeId: hospede.id,
            produtoId: produtoDiariaId,
            valor: valorEntrada,
            status: 'ENTREGUE', // Diária já foi "entregue" no check-in
            metodoCriacao: 'MANUAL', // Check-in é sempre manual
            data: dataHoraBrasil,
          },
        });

        // Se pagou na entrada, criar registro de pagamento
        if (data.pagoNaEntrada && data.metodoPagamento) {
          const pagamento = await tx.pagamento.create({
            data: {
              hospedeId: hospede.id,
              valor: valorEntrada,
              metodo: data.metodoPagamento,
              data: dataHoraBrasil,
            },
          });

          // Se o pagamento for em DINHEIRO e houver usuarioId, registrar no caixa
          // Nota: No check-in, não temos usuarioId por padrão, mas podemos adicionar no futuro
          // Por enquanto, apenas registra se houver um campo usuarioId nos dados
          if (data.metodoPagamento === 'DINHEIRO' && (data as any).usuarioId) {
            try {
              await this.caixaService.registrarVenda(
                (data as any).usuarioId,
                valorEntrada,
                `Check-in hóspede ${hospede.nome} (ID: ${hospede.id})`,
                tx // Passar transação atual
              );
            } catch (error) {
              // Não falha o check-in se não conseguir registrar no caixa
              console.warn('Erro ao registrar venda no caixa:', error);
            }
          }
        }

        // Buscar hóspede novamente para garantir que os dados estão atualizados
        const hospedeAtualizado = await tx.hospede.findUnique({
          where: { id: hospede.id },
          include: {
            pagamentos: {
              orderBy: { data: 'desc' },
            },
          },
        });

        return hospedeAtualizado || hospede;
      });
    }

    // Se não houver valorEntrada, criar apenas o hóspede (dívida começa zerada)
    // Usar transação para garantir atomicidade (ocupar quarto + criar hóspede)
    return await prisma.$transaction(async (tx) => {
      // Se for HOSPEDE, ocupar o quarto (mudar status para OCUPADO)
      if (data.tipo === 'HOSPEDE' && quartoId) {
        await tx.quarto.update({
          where: { id: quartoId },
          data: { status: 'OCUPADO' },
        });
      }

      // Criar hóspede
      return await tx.hospede.create({
        data: {
          tipo: data.tipo,
          nome: data.nome,
          documento: data.documento,
          telefone: data.telefone,
          email: data.email,
          quarto: numeroQuarto, // Mantido para compatibilidade
          quartoId: quartoId, // ID do quarto (obrigatório para HOSPEDE)
          uidPulseira: data.uidPulseira,
          limiteGasto: data.limiteGasto,
          origem: data.origem || 'BALCAO',
          dividaAtual: 0, // FORÇAR: Sem valorEntrada, dívida começa zerada
        },
      });
    });
  }

  async listarHospedes(ativo?: boolean, page: number = 1, limit: number = 10, busca?: string, tipo?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (ativo !== undefined) where.ativo = ativo;
    if (tipo) where.tipo = tipo;
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { quarto: { contains: busca } },
        { documento: { contains: busca } },
        { telefone: { contains: busca } },
        { email: { contains: busca } },
        { uidPulseira: { contains: busca } },
      ];
    }

    const [hospedes, total] = await Promise.all([
      prisma.hospede.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip,
        take: limit,
      }),
      prisma.hospede.count({ where }),
    ]);

    // Log para debug - verificar se dividaAtual está sendo retornado
    console.log('ListarHospedes - Total:', total, 'Hospedes retornados:', hospedes.length);
    hospedes.forEach(h => {
      console.log(`Hospede ${h.id} (${h.nome}): dividaAtual = ${h.dividaAtual}, tipo = ${h.tipo}`);
    });

    return {
      data: hospedes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async buscarHospede(id: number) {
    return await prisma.hospede.findUnique({
      where: { id },
      include: {
        pedidos: {
          include: { produto: true },
          orderBy: { data: 'desc' },
        },
        pagamentos: {
          orderBy: { data: 'desc' },
        },
        quartoRel: true, // Incluir dados do quarto
      },
    });
  }

  async buscarPorPulseira(uidPulseira: string) {
    return await prisma.hospede.findUnique({
      where: { uidPulseira },
      include: {
        pedidos: {
          include: { produto: true },
          orderBy: { data: 'desc' },
          take: 10,
        },
      },
    });
  }

  async atualizarHospede(id: number, data: Partial<{
    nome: string;
    documento: string;
    telefone: string;
    email: string;
    quarto: string;
    limiteGasto: number;
    ativo: boolean;
    origem: string;
  }>) {
    return await prisma.hospede.update({
      where: { id },
      data,
    });
  }

  async desativarHospede(id: number) {
    return await prisma.hospede.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async zerarDivida(id: number) {
    return await prisma.hospede.update({
      where: { id },
      data: { dividaAtual: 0 },
    });
  }

  /**
   * Realiza checkout do hóspede:
   * - Exige criação de Pagamento com o valor restante da dívida
   * - Valida se a soma dos pagamentos bate com a dívida
   * - Zera a dívida atual após pagamento
   * - Desativa o hóspede
   * - Libera a pulseira (uidPulseira = NULL) para reuso
   * - Grava dataCheckout
   */
  async realizarCheckout(
    id: number,
    options: {
      metodoPagamento: string; // PIX, DINHEIRO, CARTAO, DEBITO (obrigatório)
      valorPagamento?: number; // Valor a pagar (opcional, se não fornecido usa dividaAtual)
      forcarCheckout?: boolean; // Se true, força checkout mesmo se pagamento não bater com dívida
      usuarioId?: number; // ID do usuário que está realizando o checkout (para registro no caixa)
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      // Buscar hóspede com histórico de pagamentos
      const hospede = await tx.hospede.findUnique({
        where: { id },
        include: {
          pagamentos: {
            orderBy: { data: 'desc' },
          },
        },
      });

      if (!hospede) {
        throw new NotFoundError('Hóspede');
      }

      // Calcular valor do pagamento (usa dividaAtual se não fornecido)
      const valorPagamento = options.valorPagamento ?? hospede.dividaAtual;

      if (valorPagamento <= 0) {
        throw new BusinessError('Valor do pagamento deve ser maior que zero');
      }

      // Calcular total já pago (antes do pagamento atual)
      const totalPagoAnterior = hospede.pagamentos.reduce((sum, p) => sum + p.valor, 0);
      const totalDevido = hospede.dividaAtual;

      // Criar registro de pagamento
      const dataHoraBrasil = getDataHoraBrasil();
      const pagamento = await tx.pagamento.create({
        data: {
          hospedeId: hospede.id,
          valor: valorPagamento,
          metodo: options.metodoPagamento,
          data: dataHoraBrasil,
        },
      });

      // Se o pagamento for em DINHEIRO e houver usuarioId, registrar no caixa
      if (options.metodoPagamento === 'DINHEIRO' && options.usuarioId) {
        try {
          await this.caixaService.registrarVenda(
            options.usuarioId,
            valorPagamento,
            `Checkout hóspede ${hospede.nome} (ID: ${hospede.id})`,
            tx // Passar transação atual
          );
        } catch (error) {
          // Não falha o checkout se não conseguir registrar no caixa
          // Apenas loga o erro
          console.warn('Erro ao registrar venda no caixa:', error);
        }
      }

      // Calcular total pago (incluindo o pagamento atual)
      const totalPago = totalPagoAnterior + valorPagamento;

      // Validar se pagamento bate com dívida (a menos que seja forçado)
      if (!options.forcarCheckout && Math.abs(totalPago - totalDevido) > 0.01) {
        throw new BusinessError(
          `Valor pago (R$ ${totalPago.toFixed(2)}) não corresponde à dívida atual (R$ ${totalDevido.toFixed(2)}). ` +
          `Diferença: R$ ${Math.abs(totalPago - totalDevido).toFixed(2)}`
        );
      }

      // Se o hóspede tiver quarto, liberar o quarto (mudar status para LIMPEZA)
      if (hospede.quartoId) {
        await tx.quarto.update({
          where: { id: hospede.quartoId },
          data: { status: 'LIMPEZA' },
        });
      }

      // Realizar checkout: zerar dívida, desativar e liberar pulseira
      const hospedeAtualizado = await tx.hospede.update({
        where: { id },
        data: {
          dividaAtual: 0,
          ativo: false,
          uidPulseira: null, // Libera a pulseira para reuso
          dataCheckout: dataHoraBrasil,
        },
        include: {
          pagamentos: {
            orderBy: { data: 'desc' },
          },
          quartoRel: true, // Incluir dados do quarto na resposta
        },
      });

      return hospedeAtualizado;
    });
  }
}
