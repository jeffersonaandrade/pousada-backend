// Tipos TypeScript para manter type safety mesmo sem enums no Prisma
// SQLite não suporta enums, então usamos strings com tipos TypeScript

export const TipoCliente = {
  HOSPEDE: 'HOSPEDE',
  DAY_USE: 'DAY_USE',
  VIP: 'VIP',
} as const;

export type TipoCliente = typeof TipoCliente[keyof typeof TipoCliente];

export const StatusPedido = {
  PENDENTE: 'PENDENTE',
  PREPARANDO: 'PREPARANDO',
  PRONTO: 'PRONTO',
  ENTREGUE: 'ENTREGUE',
  CANCELADO: 'CANCELADO',
} as const;

export type StatusPedido = typeof StatusPedido[keyof typeof StatusPedido];

export const Role = {
  WAITER: 'WAITER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type Role = typeof Role[keyof typeof Role];

