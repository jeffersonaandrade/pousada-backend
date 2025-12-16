import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '../../uploads');

// Garante que a pasta uploads existe
async function ensureUploadsDir() {
  try {
    await mkdir(uploadsDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function uploadRoutes(fastify: FastifyInstance) {
  // Garante que a pasta existe ao iniciar
  await ensureUploadsDir();

  fastify.post('/api/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file({
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
        },
      });

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'Nenhum arquivo enviado',
        });
      }

      // Valida tipo de arquivo
      if (!data.mimetype.startsWith('image/')) {
        return reply.status(400).send({
          success: false,
          error: 'Apenas arquivos de imagem são permitidos',
        });
      }

      // Gera nome único para o arquivo
      const extension = extname(data.filename) || '.jpg';
      const filename = `${uuidv4()}${extension}`;
      const filepath = join(uploadsDir, filename);

      // Salva o arquivo no disco
      await pipeline(data.file, createWriteStream(filepath));

      // Retorna a URL relativa
      const url = `/uploads/${filename}`;

      fastify.log.info(`Arquivo salvo: ${filename}`);

      return reply.status(200).send({
        success: true,
        url,
        filename,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao fazer upload');

      if (error.code === 'LIMIT_FILE_SIZE') {
        return reply.status(400).send({
          success: false,
          error: 'Arquivo muito grande. Tamanho máximo: 5MB',
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Erro ao fazer upload do arquivo',
      });
    }
  });
}

