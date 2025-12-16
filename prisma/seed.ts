import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Verificar se já existem quartos
  const quartosExistentes = await prisma.quarto.count();
  
  if (quartosExistentes === 0) {
    console.log('Criando quartos iniciais...');
    
    // Quartos do 1º andar (101-105)
    const quartosAndar1 = [
      { numero: '101', andar: 1, categoria: 'Standard' },
      { numero: '102', andar: 1, categoria: 'Standard' },
      { numero: '103', andar: 1, categoria: 'Standard' },
      { numero: '104', andar: 1, categoria: 'Standard' },
      { numero: '105', andar: 1, categoria: 'Standard' },
    ];

    // Quartos do 2º andar (201-205)
    const quartosAndar2 = [
      { numero: '201', andar: 2, categoria: 'Standard' },
      { numero: '202', andar: 2, categoria: 'Standard' },
      { numero: '203', andar: 2, categoria: 'Standard' },
      { numero: '204', andar: 2, categoria: 'Standard' },
      { numero: '205', andar: 2, categoria: 'Standard' },
    ];

    const todosQuartos = [...quartosAndar1, ...quartosAndar2];

    for (const quarto of todosQuartos) {
      await prisma.quarto.create({
        data: {
          ...quarto,
          status: 'LIVRE',
        },
      });
    }

    console.log(`✅ ${todosQuartos.length} quartos criados com sucesso!`);
  } else {
    console.log(`ℹ️  Já existem ${quartosExistentes} quartos no banco. Seed de quartos pulado.`);
  }

  // Verificar se já existem categorias financeiras
  const categoriasExistentes = await prisma.categoriaFinanceira.count();
  
  if (categoriasExistentes === 0) {
    console.log('Criando categorias financeiras padrão...');
    
    const categorias = [
      { nome: 'Aluguel', tipo: 'DESPESA' },
      { nome: 'Energia/Água', tipo: 'DESPESA' },
      { nome: 'Internet', tipo: 'DESPESA' },
      { nome: 'Fornecedores Bebida', tipo: 'DESPESA' },
      { nome: 'Manutenção', tipo: 'DESPESA' },
      { nome: 'Salários', tipo: 'DESPESA' },
      { nome: 'Hospedagem', tipo: 'RECEITA' },
      { nome: 'Day Use', tipo: 'RECEITA' },
      { nome: 'Vendas', tipo: 'RECEITA' },
    ];

    for (const categoria of categorias) {
      await prisma.categoriaFinanceira.create({
        data: categoria,
      });
    }

    console.log(`✅ ${categorias.length} categorias financeiras criadas com sucesso!`);
  } else {
    console.log(`ℹ️  Já existem ${categoriasExistentes} categorias no banco. Seed de categorias pulado.`);
  }

  console.log('Seed concluído!');
}

main()
  .catch((e) => {
    console.error('Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

