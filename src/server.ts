import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import multipart from '@fastify/multipart';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { networkInterfaces } from 'os';
import { pedidoRoutes } from './routes/pedido.routes.js';
import { hospedeRoutes } from './routes/hospede.routes.js';
import { produtoRoutes } from './routes/produto.routes.js';
import { usuarioRoutes } from './routes/usuario.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';
import { estoqueRoutes } from './routes/estoque.routes.js';
import { relatorioRoutes } from './routes/relatorio.routes.js';
import { quartoRoutes } from './routes/quarto.routes.js';
import { caixaRoutes } from './routes/caixa.routes.js';
import { financeiroRoutes } from './routes/financeiro.routes.js';
import { AppError, handlePrismaError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';
import { setupOperationLogging } from './middleware/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Error handler global
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    // Se for AppError, usa os dados do erro
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Trata erros do Prisma
    if (error.code?.startsWith('P')) {
      const appError = handlePrismaError(error);
      return reply.status(appError.statusCode).send({
        success: false,
        error: appError.message,
        code: appError.code,
      });
    }

    // Erro de validação do Fastify
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: error.validation,
      });
    }

    // Erro genérico
    return reply.status(500).send({
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : error.message,
    });
  });

  // Rate limiting - proteção básica contra abuso
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requisições
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // por minuto
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Muitas requisições. Tente novamente em alguns instantes.',
        code: 'RATE_LIMIT_EXCEEDED',
      };
    },
  });

  // CORS - configurável para intranet
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : true; // Se não configurado, permite tudo (compatibilidade)

  await fastify.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // Multipart para upload de arquivos
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Socket.io - Configurado para suportar React Native/Expo
  const io = new Server(fastify.server, {
    cors: {
      origin: allowedOrigins === true ? '*' : allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'], // Permite fallback para polling (necessário para React Native)
    allowEIO3: true, // Compatibilidade com versões antigas
    pingTimeout: 60000, // 60 segundos
    pingInterval: 25000, // 25 segundos
    connectTimeout: 45000, // 45 segundos
  });

  // Logging de operações críticas
  setupOperationLogging(fastify);

  // Disponibilizar io para as rotas
  fastify.decorate('io', io);

  // Socket.io event handlers
  io.on('connection', (socket) => {
    fastify.log.info(`Cliente conectado: ${socket.id}`);

    socket.on('disconnect', () => {
      fastify.log.info(`Cliente desconectado: ${socket.id}`);
    });
  });

  // Rotas da API (devem ser registradas ANTES dos arquivos estáticos)
  fastify.register(pedidoRoutes, { prefix: '/api/pedidos' });
  fastify.register(hospedeRoutes, { prefix: '/api/hospedes' });
  fastify.register(produtoRoutes, { prefix: '/api/produtos' });
  fastify.register(usuarioRoutes, { prefix: '/api/usuarios' });
  fastify.register(estoqueRoutes, { prefix: '/api/estoque' });
  fastify.register(relatorioRoutes, { prefix: '/api/relatorios' });
  fastify.register(quartoRoutes, { prefix: '/api/quartos' });
  fastify.register(caixaRoutes, { prefix: '/api/caixa' });
  fastify.register(financeiroRoutes, { prefix: '/api/financeiro' });
  fastify.register(uploadRoutes);

  // Health check
  fastify.get('/health', async () => {
    try {
      // Verifica conexão com o banco
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Health check failed');
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  });

  // Servir arquivos estáticos do frontend (React build)
  const publicPath = join(__dirname, '../public');
  
  await fastify.register(staticFiles, {
    root: publicPath,
    prefix: '/',
    // Não servir index.html diretamente aqui, será tratado pelo setNotFoundHandler
  });

  // Servir arquivos de upload (segunda instância de static)
  const uploadsPath = join(__dirname, '../uploads');
  
  await fastify.register(staticFiles, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false, // Importante: não conflitar com o static do frontend
  });

  // SPA Support: Para qualquer rota que não comece com /api, servir index.html
  // Isso permite que o React Router funcione corretamente
  fastify.setNotFoundHandler(async (request, reply) => {
    // Se a rota começa com /api, retornar 404 normal
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({
        success: false,
        error: 'Rota da API não encontrada',
      });
    }

    // Para todas as outras rotas, servir index.html (SPA)
    try {
      const indexPath = join(publicPath, 'index.html');
      const indexContent = readFileSync(indexPath, 'utf-8');
      return reply.type('text/html').send(indexContent);
    } catch (error) {
      // Se index.html não existir, retornar mensagem amigável
      return reply.status(404).type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head><title>Frontend não encontrado</title></head>
          <body>
            <h1>Frontend não encontrado</h1>
            <p>Execute o build do frontend e copie os arquivos para a pasta <code>public</code>.</p>
          </body>
        </html>
      `);
    }
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    
    // Obter IPs locais para exibir nos logs
    const getLocalIPs = () => {
      const interfaces = networkInterfaces();
      const ips: string[] = [];
      
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          // Ignora loopback e IPv6
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }
      
      return ips;
    };

    const localIPs = getLocalIPs();
    
    // Logs informativos (usando apenas caracteres ASCII para compatibilidade)
    fastify.log.info('');
    fastify.log.info('===========================================================');
    fastify.log.info('>>> SERVIDOR INICIADO COM SUCESSO');
    fastify.log.info('===========================================================');
    fastify.log.info('');
    fastify.log.info('Enderecos locais:');
    fastify.log.info(`   - http://localhost:${PORT}`);
    if (localIPs.length > 0) {
      localIPs.forEach(ip => {
        fastify.log.info(`   - http://${ip}:${PORT}`);
      });
    }
    fastify.log.info('');
    fastify.log.info('Para o React Native/Expo, use:');
    if (localIPs.length > 0) {
      const primaryIP = localIPs[0];
      fastify.log.info(`   - API Base URL: http://${primaryIP}:${PORT}/api`);
      fastify.log.info(`   - Socket.io URL: http://${primaryIP}:${PORT}`);
    } else {
      fastify.log.info(`   - API Base URL: http://SEU_IP_LOCAL:${PORT}/api`);
      fastify.log.info(`   - Socket.io URL: http://SEU_IP_LOCAL:${PORT}`);
      fastify.log.info('   [AVISO] Nao foi possivel detectar o IP local automaticamente');
      fastify.log.info('   [AVISO] Use: ipconfig (Windows) ou ifconfig (Linux/Mac) para descobrir');
    }
    fastify.log.info('');
    fastify.log.info('Socket.io configurado e pronto para conexoes');
    fastify.log.info('===========================================================');
    fastify.log.info('');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
