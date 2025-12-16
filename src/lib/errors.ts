// Classes de erro customizadas para melhor tratamento

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND');
  }
}

export class BusinessError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BUSINESS_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

// Função para tratar erros do Prisma
export function handlePrismaError(error: any): AppError {
  // Erro de constraint único (duplicata)
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'campo';
    return new ValidationError(`${field} já está em uso`);
  }

  // Registro não encontrado
  if (error.code === 'P2025') {
    return new NotFoundError('Registro');
  }

  // Erro de foreign key
  if (error.code === 'P2003') {
    return new ValidationError('Referência inválida');
  }

  // Outros erros do Prisma
  if (error.code?.startsWith('P')) {
    return new AppError('Erro no banco de dados', 500, 'DATABASE_ERROR');
  }

  // Se já for AppError, retorna direto
  if (error instanceof AppError) {
    return error;
  }

  // Erro genérico
  return new AppError(error.message || 'Erro interno do servidor', 500);
}

