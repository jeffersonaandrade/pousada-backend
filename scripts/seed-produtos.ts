import { prisma } from '../src/lib/prisma.js';

async function seedProdutos() {
  console.log('Adicionando produtos de exemplo...\n');

  const produtos = [
    {
      nome: 'Hambúrguer Artesanal',
      preco: 25.90,
      estoque: 50,
      categoria: 'Lanches',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Batata Frita',
      preco: 12.50,
      estoque: 100,
      categoria: 'Acompanhamentos',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Refrigerante Lata',
      preco: 5.00,
      estoque: 200,
      categoria: 'Bebidas',
      setor: 'BAR_PISCINA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Água Mineral',
      preco: 3.50,
      estoque: 150,
      categoria: 'Bebidas',
      setor: 'BAR_PISCINA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Cerveja Long Neck',
      preco: 8.00,
      estoque: 100,
      categoria: 'Bebidas',
      setor: 'BAR_PISCINA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Pizza Média',
      preco: 35.00,
      estoque: 30,
      categoria: 'Lanches',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Salada Caesar',
      preco: 18.00,
      estoque: 40,
      categoria: 'Saladas',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Suco Natural',
      preco: 7.50,
      estoque: 80,
      categoria: 'Bebidas',
      setor: 'BAR_PISCINA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Açaí',
      preco: 15.00,
      estoque: 60,
      categoria: 'Sobremesas',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Sorvete',
      preco: 10.00,
      estoque: 70,
      categoria: 'Sobremesas',
      setor: 'COZINHA',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Whisky Johnnie Walker',
      preco: 45.00,
      estoque: 30,
      categoria: 'Bebidas Alcoólicas',
      setor: 'BOATE',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Vodka Absolut',
      preco: 40.00,
      estoque: 25,
      categoria: 'Bebidas Alcoólicas',
      setor: 'BOATE',
      visivelCardapio: true,
      foto: null,
    },
    {
      nome: 'Caipirinha',
      preco: 18.00,
      estoque: 50,
      categoria: 'Bebidas Alcoólicas',
      setor: 'BOATE',
      visivelCardapio: true,
      foto: null,
    },
  ];

  try {
    for (const produto of produtos) {
      const existe = await prisma.produto.findFirst({
        where: { nome: produto.nome },
      });

      if (existe) {
        console.log(`Produto "${produto.nome}" já existe, pulando...`);
        continue;
      }

      const criado = await prisma.produto.create({
        data: produto,
      });

      console.log(`✓ Criado: ${criado.nome} - R$ ${criado.preco.toFixed(2)}`);
    }

    const total = await prisma.produto.count();
    console.log(`\n✓ Total de produtos no banco: ${total}`);
    console.log('\nProdutos adicionados com sucesso!');
  } catch (error: any) {
    console.error('Erro ao adicionar produtos:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProdutos()
  .then(() => {
    console.log('\nConcluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro:', error);
    process.exit(1);
  });

