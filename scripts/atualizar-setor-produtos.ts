import { prisma } from '../src/lib/prisma.js';

async function atualizarSetorProdutos() {
  console.log('Atualizando setor dos produtos existentes...\n');

  try {
    // Produtos de cozinha
    const produtosCozinha = [
      'Hambúrguer Artesanal',
      'Batata Frita',
      'Pizza Média',
      'Salada Caesar',
      'Açaí',
      'Sorvete',
    ];

    // Produtos de bar da piscina
    const produtosBarPiscina = [
      'Refrigerante Lata',
      'Água Mineral',
      'Cerveja Long Neck',
      'Suco Natural',
    ];

    // Produtos de boate
    const produtosBoate = [
      'Whisky Johnnie Walker',
      'Vodka Absolut',
      'Caipirinha',
    ];

    // Atualizar produtos de cozinha
    for (const nome of produtosCozinha) {
      const atualizado = await prisma.produto.updateMany({
        where: { nome },
        data: { setor: 'COZINHA' },
      });
      if (atualizado.count > 0) {
        console.log(`✓ ${nome} -> COZINHA`);
      }
    }

    // Atualizar produtos de bar da piscina
    for (const nome of produtosBarPiscina) {
      const atualizado = await prisma.produto.updateMany({
        where: { nome },
        data: { setor: 'BAR_PISCINA' },
      });
      if (atualizado.count > 0) {
        console.log(`✓ ${nome} -> BAR_PISCINA`);
      }
    }

    // Atualizar produtos de boate
    for (const nome of produtosBoate) {
      const atualizado = await prisma.produto.updateMany({
        where: { nome },
        data: { setor: 'BOATE' },
      });
      if (atualizado.count > 0) {
        console.log(`✓ ${nome} -> BOATE`);
      }
    }

    // Atualizar produtos sem setor definido para COZINHA (padrão)
    const atualizados = await prisma.produto.updateMany({
      where: { setor: 'COZINHA' }, // Isso vai pegar os que já foram atualizados ou os que têm o default
      data: {}, // Não precisa fazer nada, só garantir que todos tenham setor
    });

    // Todos os produtos já têm setor com default "COZINHA" do schema
    // Os produtos que não foram mapeados acima já terão COZINHA como padrão

    const total = await prisma.produto.count();
    console.log(`\n✅ Atualização concluída! Total de produtos: ${total}`);
  } catch (error: any) {
    console.error('Erro ao atualizar setores:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

atualizarSetorProdutos()
  .then(() => {
    console.log('\nConcluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro:', error);
    process.exit(1);
  });

