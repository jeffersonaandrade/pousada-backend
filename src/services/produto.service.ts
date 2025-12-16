import { prisma } from '../lib/prisma.js';
import { NotFoundError, BusinessError } from '../lib/errors.js';

export class ProdutoService {
  async criarProduto(data: {
    nome: string;
    preco: number;
    estoque: number;
    foto?: string;
    categoria?: string;
    descricao?: string;
    setor?: string; // COZINHA, BAR_PISCINA, BOATE
    visivelCardapio?: boolean; // Se false, não aparece no cardápio
  }) {
    try {
      console.log('ProdutoService.criarProduto - Dados recebidos:', JSON.stringify(data));
      const produto = await prisma.produto.create({
        data,
      });
      console.log('ProdutoService.criarProduto - Produto criado com sucesso:', produto.id);
      return produto;
    } catch (error: any) {
      console.error('ProdutoService.criarProduto - Erro:', error.message, error.code);
      throw error;
    }
  }

  async listarProdutos(
    categoria?: string, 
    page: number = 1, 
    limit: number = 10, 
    busca?: string, 
    estoqueBaixo?: boolean,
    apenasDisponiveis?: boolean // Se true, retorna apenas produtos com estoque > 0 (para menu/garçom/kiosque)
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (categoria) where.categoria = categoria;
    
    // Se for para menu/garçom/kiosque, mostrar apenas produtos disponíveis (estoque > 0) e visíveis no cardápio
    if (apenasDisponiveis === true) {
      where.estoque = { gt: 0 };
      where.visivelCardapio = true; // Filtrar produtos que devem aparecer no cardápio
    } else if (estoqueBaixo === true) {
      where.estoque = { lt: 10 }; // Estoque menor que 10
    }
    
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { categoria: { contains: busca } },
        { descricao: { contains: busca } },
      ];
    }

    // Buscar total sem filtros para debug
    const totalGeral = await prisma.produto.count();

    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip,
        take: limit,
      }),
      prisma.produto.count({ where }),
    ]);

    // Log para debug
    console.log('ListarProdutos - Total geral:', totalGeral, 'Total com filtros:', total, 'Where:', JSON.stringify(where));

    return {
      data: produtos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async buscarProduto(id: number) {
    return await prisma.produto.findUnique({
      where: { id },
    });
  }

  async atualizarProduto(id: number, data: Partial<{
    nome: string;
    preco: number;
    estoque: number;
    foto: string;
    categoria: string;
    descricao: string;
    setor: string; // COZINHA, BAR_PISCINA, BOATE
    visivelCardapio: boolean; // Se false, não aparece no cardápio
  }>) {
    return await prisma.produto.update({
      where: { id },
      data,
    });
  }

  async adicionarEstoque(id: number, quantidade: number) {
    return await prisma.produto.update({
      where: { id },
      data: { estoque: { increment: quantidade } },
    });
  }

  async deletarProduto(id: number) {
    // Verificar se o produto existe
    const produto = await prisma.produto.findUnique({
      where: { id },
    });

    if (!produto) {
      throw new NotFoundError('Produto');
    }

    // Verificar se há pedidos associados
    const totalPedidos = await prisma.pedido.count({
      where: { produtoId: id },
    });

    if (totalPedidos > 0) {
      throw new BusinessError(
        `Não é possível deletar o produto "${produto.nome}" pois ele possui ${totalPedidos} pedido(s) associado(s). ` +
        `Para ocultar o produto do menu, defina o estoque como 0.`
      );
    }

    // Verificar se há perdas de estoque associadas
    const totalPerdas = await prisma.perdaEstoque.count({
      where: { produtoId: id },
    });

    if (totalPerdas > 0) {
      throw new BusinessError(
        `Não é possível deletar o produto "${produto.nome}" pois ele possui ${totalPerdas} registro(s) de baixa técnica. ` +
        `Para ocultar o produto do menu, defina o estoque como 0.`
      );
    }

    // Se não houver pedidos nem perdas, pode deletar
    return await prisma.produto.delete({
      where: { id },
    });
  }
}
