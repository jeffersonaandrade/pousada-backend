import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProdutoService } from '../services/produto.service.js';

const produtoService = new ProdutoService();

export async function produtoRoutes(fastify: FastifyInstance) {
  // Criar produto
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as {
        nome: string;
        preco: number;
        estoque: number;
        foto?: string;
        categoria?: string;
        descricao?: string;
        setor?: string; // COZINHA, BAR_PISCINA, BOATE
        visivelCardapio?: boolean; // Se false, não aparece no cardápio
      };

      fastify.log.info({ data }, 'Criando produto');

      const produto = await produtoService.criarProduto(data);

      return reply.status(201).send({
        success: true,
        data: produto,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message, stack: error.stack }, 'Erro ao criar produto');
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Listar produtos
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        categoria, 
        page = '1', 
        limit = '10', 
        busca,
        estoqueBaixo,
        apenasDisponiveis // Para menu/garçom/kiosque - retorna apenas produtos com estoque > 0
      } = request.query as { 
        categoria?: string; 
        page?: string; 
        limit?: string; 
        busca?: string;
        estoqueBaixo?: string;
        apenasDisponiveis?: string;
      };
      
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const estoqueBaixoBool = estoqueBaixo === 'true';
      const apenasDisponiveisBool = apenasDisponiveis === 'true';
      
      const result = await produtoService.listarProdutos(
        categoria, 
        pageNum, 
        limitNum, 
        busca,
        estoqueBaixoBool,
        apenasDisponiveisBool
      );

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

  // Buscar produto por ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const produto = await produtoService.buscarProduto(parseInt(id));

      if (!produto) {
        return reply.status(404).send({
          success: false,
          error: 'Produto não encontrado',
        });
      }

      return reply.send({
        success: true,
        data: produto,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Atualizar produto
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as Partial<{
        nome: string;
        preco: number;
        estoque: number;
        foto: string;
        categoria: string;
        descricao: string;
        setor: string; // COZINHA, BAR_PISCINA, BOATE
        visivelCardapio: boolean; // Se false, não aparece no cardápio
      }>;

      const produto = await produtoService.atualizarProduto(parseInt(id), data);

      return reply.send({
        success: true,
        data: produto,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Adicionar estoque
  fastify.post('/:id/estoque', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { quantidade } = request.body as { quantidade: number };

      const produto = await produtoService.adicionarEstoque(parseInt(id), quantidade);

      return reply.send({
        success: true,
        data: produto,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Deletar produto
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await produtoService.deletarProduto(parseInt(id));

      fastify.log.info({ produtoId: id }, 'Produto deletado');

      return reply.send({
        success: true,
        message: 'Produto deletado com sucesso',
      });
    } catch (error: any) {
      // Se for erro de negócio (pedidos associados), retornar 400
      if (error.code === 'BUSINESS_ERROR' || error.message?.includes('pedido') || error.message?.includes('baixa técnica')) {
        return reply.status(400).send({
          success: false,
          error: error.message,
          code: error.code || 'BUSINESS_ERROR',
        });
      }
      // Se for produto não encontrado, retornar 404
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }
      // Outros erros (como foreign key constraint)
      fastify.log.error(error, 'Erro ao deletar produto');
      return reply.status(400).send({
        success: false,
        error: error.message || 'Erro ao deletar produto. Verifique se o produto não possui pedidos ou registros de baixa técnica associados.',
      });
    }
  });
}
