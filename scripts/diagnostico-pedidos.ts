import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnosticarPedidos() {
  console.log('\n=== DIAGNÓSTICO DE PEDIDOS ===\n');

  // Buscar todos os pedidos de hoje
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const pedidosHoje = await prisma.pedido.findMany({
    where: {
      data: {
        gte: hoje,
        lte: fimHoje,
      },
    },
    include: {
      hospede: true,
      produto: true,
      gerente: true,
    },
    orderBy: {
      id: 'desc',
    },
  });

  console.log(`📊 Total de pedidos hoje: ${pedidosHoje.length}\n`);

  // Agrupar por método
  const porMetodo = pedidosHoje.reduce(
    (acc, p) => {
      const metodo = p.metodoCriacao || 'NULL';
      if (!acc[metodo]) {
        acc[metodo] = [];
      }
      acc[metodo].push(p);
      return acc;
    },
    {} as Record<string, typeof pedidosHoje>
  );

  console.log('📈 Distribuição por método:');
  Object.entries(porMetodo).forEach(([metodo, pedidos]) => {
    console.log(`  ${metodo}: ${pedidos.length} pedidos`);
  });

  console.log('\n📋 Últimos 10 pedidos:');
  pedidosHoje.slice(0, 10).forEach((p) => {
    console.log(`
  ID: ${p.id}
  Data: ${p.data.toLocaleString('pt-BR')}
  Método: ${p.metodoCriacao || 'NULL'}
  Gerente: ${p.gerente?.nome || 'N/A'}
  Hóspede: ${p.hospede.nome}
  Produto: ${p.produto.nome}
  Valor: R$ ${p.valor.toFixed(2)}
  Status: ${p.status}
    `);
  });

  // Verificar pedidos sem metodoCriacao
  const semMetodo = pedidosHoje.filter((p) => !p.metodoCriacao);
  if (semMetodo.length > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${semMetodo.length} pedidos sem metodoCriacao!`);
    console.log('IDs:', semMetodo.map((p) => p.id).join(', '));
  }

  // Verificar pedidos manuais sem gerente
  const manuaisSemGerente = pedidosHoje.filter(
    (p) => p.metodoCriacao === 'MANUAL' && !p.gerenteId
  );
  if (manuaisSemGerente.length > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${manuaisSemGerente.length} pedidos MANUAIS sem gerenteId!`);
    console.log('IDs:', manuaisSemGerente.map((p) => p.id).join(', '));
  }

  // Estatísticas agregadas
  const stats = {
    total: pedidosHoje.length,
    nfc: pedidosHoje.filter((p) => p.metodoCriacao === 'NFC').length,
    manual: pedidosHoje.filter((p) => p.metodoCriacao === 'MANUAL').length,
    semMetodo: semMetodo.length,
    cancelados: pedidosHoje.filter((p) => p.status === 'CANCELADO').length,
    valorTotal: pedidosHoje
      .filter((p) => p.status !== 'CANCELADO')
      .reduce((sum, p) => sum + p.valor, 0),
  };

  console.log('\n💰 Estatísticas:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  NFC: ${stats.nfc}`);
  console.log(`  Manual: ${stats.manual}`);
  console.log(`  Sem Método: ${stats.semMetodo}`);
  console.log(`  Cancelados: ${stats.cancelados}`);
  console.log(`  Valor Total: R$ ${stats.valorTotal.toFixed(2)}`);

  await prisma.$disconnect();
}

diagnosticarPedidos().catch(console.error);

