import { prisma } from '../src/lib/prisma.js';

async function atualizarVisivelCardapio() {
  console.log('Atualizando visivelCardapio dos produtos...\n');

  try {
    // Produtos de serviço que NÃO devem aparecer no cardápio
    const produtosOcultos = ['Day Use', 'Diária'];

    // Atualizar produtos de serviço para visivelCardapio: false
    for (const nome of produtosOcultos) {
      const atualizado = await prisma.produto.updateMany({
        where: { nome },
        data: { visivelCardapio: false },
      });
      if (atualizado.count > 0) {
        console.log(`✓ ${nome} -> visivelCardapio: false`);
      }
    }

    // Garantir que todos os outros produtos tenham visivelCardapio: true
    // (produtos que não são "Day Use" ou "Diária")
    const produtosVisiveis = await prisma.produto.updateMany({
      where: {
        AND: [
          { nome: { notIn: produtosOcultos } },
          { categoria: { not: 'Serviço' } },
        ],
      },
      data: { visivelCardapio: true },
    });

    if (produtosVisiveis.count > 0) {
      console.log(`✓ ${produtosVisiveis.count} produto(s) atualizado(s) para visivelCardapio: true`);
    }

    // Verificar produtos com categoria "Serviço" que não são Day Use/Diária
    const produtosServico = await prisma.produto.findMany({
      where: {
        categoria: 'Serviço',
        nome: { notIn: produtosOcultos },
      },
    });

    if (produtosServico.length > 0) {
      console.log(`\n⚠️  ${produtosServico.length} produto(s) de serviço encontrado(s). Atualizando para visivelCardapio: false...`);
      await prisma.produto.updateMany({
        where: {
          categoria: 'Serviço',
          nome: { notIn: produtosOcultos },
        },
        data: { visivelCardapio: false },
      });
    }

    const total = await prisma.produto.count();
    const visiveis = await prisma.produto.count({ where: { visivelCardapio: true } });
    const ocultos = await prisma.produto.count({ where: { visivelCardapio: false } });

    console.log(`\n✅ Atualização concluída!`);
    console.log(`   Total de produtos: ${total}`);
    console.log(`   Visíveis no cardápio: ${visiveis}`);
    console.log(`   Ocultos do cardápio: ${ocultos}`);
  } catch (error: any) {
    console.error('Erro ao atualizar visivelCardapio:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

atualizarVisivelCardapio()
  .then(() => {
    console.log('\nConcluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro:', error);
    process.exit(1);
  });

