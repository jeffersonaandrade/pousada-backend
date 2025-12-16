import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware para logar operações críticas
 */
export async function logOperation(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: string,
  details?: Record<string, any>
) {
  const userId = request.user?.id || 'anonymous';
  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';

  request.log.info({
    operation,
    userId,
    ip,
    method: request.method,
    url: request.url,
    ...details,
  }, `Operação crítica: ${operation}`);
}

/**
 * Hook para logar automaticamente operações de escrita
 */
export function setupOperationLogging(fastify: any) {
  // Loga operações POST, PATCH, DELETE
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
      const userId = request.user?.id || 'anonymous';
      const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';

      request.log.info({
        operation: `${request.method} ${request.url}`,
        userId,
        ip,
        body: request.method === 'POST' || request.method === 'PATCH' 
          ? request.body 
          : undefined,
      }, 'Operação de escrita detectada');
    }
  });
}

