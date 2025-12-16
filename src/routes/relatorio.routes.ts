import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RelatorioService } from '../services/relatorio.service.js';
import { authenticate } from '../middleware/auth.js';

const relatorioService = new RelatorioService();

export async function relatorioRoutes(fastify: FastifyInstance) {
  // Exportar relatório de vendas em Excel
  fastify.get('/vendas/excel', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { dataInicio, dataFim } = request.query as {
        dataInicio?: string;
        dataFim?: string;
      };

      const buffer = await relatorioService.gerarRelatorioVendasExcel(dataInicio, dataFim);

      // Definir nome do arquivo
      const hoje = new Date().toISOString().split('T')[0];
      const nomeArquivo = `relatorio-vendas-${hoje}.xlsx`;

      // Configurar headers para download
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      reply.header('Content-Length', buffer.length.toString());

      fastify.log.info({
        dataInicio,
        dataFim,
        tamanho: buffer.length,
        usuarioId: request.user?.id,
      }, 'Relatório Excel gerado');

      return reply.send(buffer);
    } catch (error: any) {
      fastify.log.error(error, 'Erro ao gerar relatório Excel');
      return reply.status(500).send({
        success: false,
        error: 'Erro interno do servidor ao gerar relatório',
      });
    }
  });
}

