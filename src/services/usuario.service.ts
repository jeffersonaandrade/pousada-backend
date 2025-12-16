import { Role } from '../types/enums.js';
import { prisma } from '../lib/prisma.js';
import { ValidationError } from '../lib/errors.js';

export class UsuarioService {
  async criarUsuario(data: {
    nome: string;
    pin: string;
    cargo: Role;
  }) {
    // Validar PIN (4 dígitos)
    if (!/^\d{4}$/.test(data.pin)) {
      throw new ValidationError('PIN deve conter exatamente 4 dígitos');
    }

    // Verificar se já existe um usuário ATIVO com este PIN
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { pin: data.pin },
    });

    if (usuarioExistente && usuarioExistente.ativo) {
      throw new ValidationError('PIN já está em uso por outro usuário ativo');
    }

    // Se existe um usuário inativo com este PIN, atualizar ao invés de criar
    if (usuarioExistente && !usuarioExistente.ativo) {
      return await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: {
          nome: data.nome,
          cargo: data.cargo,
          ativo: true, // Reativar o usuário
        },
      });
    }

    // Criar novo usuário
    return await prisma.usuario.create({
      data,
    });
  }

  async listarUsuarios(ativo?: boolean, page: number = 1, limit: number = 10, busca?: string, cargo?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (ativo !== undefined) where.ativo = ativo;
    if (cargo) where.cargo = cargo;
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { pin: { contains: busca } },
      ];
    }

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip,
        take: limit,
      }),
      prisma.usuario.count({ where }),
    ]);

    return {
      data: usuarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async buscarUsuario(id: number) {
    return await prisma.usuario.findUnique({
      where: { id },
    });
  }

  async autenticarPorPin(pin: string) {
    return await prisma.usuario.findUnique({
      where: { pin, ativo: true },
    });
  }

  /**
   * Valida se o PIN pertence a um gerente ou admin
   * Retorna o usuário se for MANAGER ou ADMIN, null caso contrário
   */
  async validarPinGerente(pin: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { pin, ativo: true },
    });

    if (!usuario) {
      return null;
    }

    // Verifica se é MANAGER ou ADMIN
    if (usuario.cargo === 'MANAGER' || usuario.cargo === 'ADMIN') {
      return usuario;
    }

    return null;
  }

  async atualizarUsuario(id: number, data: Partial<{
    nome: string;
    pin: string;
    cargo: Role;
    ativo: boolean;
  }>) {
    if (data.pin && !/^\d{4}$/.test(data.pin)) {
      throw new ValidationError('PIN deve conter exatamente 4 dígitos');
    }

    // Se está alterando o PIN, verificar se já existe um usuário ATIVO com este PIN
    if (data.pin) {
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { pin: data.pin },
      });

      if (usuarioExistente && usuarioExistente.id !== id && usuarioExistente.ativo) {
        throw new ValidationError('PIN já está em uso por outro usuário ativo');
      }
    }

    return await prisma.usuario.update({
      where: { id },
      data,
    });
  }

  async desativarUsuario(id: number) {
    return await prisma.usuario.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
