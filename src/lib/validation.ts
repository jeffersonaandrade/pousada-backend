// Utilitários de validação

export function parseId(id: string): number {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('ID inválido');
  }
  return parsed;
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} é obrigatório`);
  }
}

export function validatePositiveNumber(value: number, fieldName: string): void {
  if (value === undefined || value === null || isNaN(value) || value < 0) {
    throw new Error(`${fieldName} deve ser um número positivo`);
  }
}

export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value.length < min || value.length > max) {
    throw new Error(
      `${fieldName} deve ter entre ${min} e ${max} caracteres`
    );
  }
}

