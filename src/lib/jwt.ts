import jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-para-intranet-123456789';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JWTPayload {
  userId: number;
  nome: string;
  cargo: string;
}

/**
 * Gera um token JWT para o usuário autenticado
 */
export function generateToken(user: AuthenticatedUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    nome: user.nome,
    cargo: user.cargo,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Valida e decodifica um token JWT
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}

