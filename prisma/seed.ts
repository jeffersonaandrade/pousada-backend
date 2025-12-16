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

  // Criar ou atualizar usuários de teste (um de cada cargo)
  console.log('Criando/atualizando usuários de teste...');
  
  const usuariosTeste = [
    { nome: 'Administrador', pin: '0000', cargo: 'ADMIN' as const },
    { nome: 'João Garçom', pin: '1234', cargo: 'WAITER' as const },
    { nome: 'Soares Gerente', pin: '5678', cargo: 'MANAGER' as const },
    { nome: 'Maria Limpeza', pin: '9999', cargo: 'CLEANER' as const },
  ];

  for (const usuarioData of usuariosTeste) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { pin: usuarioData.pin },
    });

    if (usuarioExistente) {
      // Atualizar usuário existente
      await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: {
          nome: usuarioData.nome,
          cargo: usuarioData.cargo,
          ativo: true,
        },
      });
      console.log(`✅ Usuário atualizado: ${usuarioData.nome} (PIN: ${usuarioData.pin}, Cargo: ${usuarioData.cargo})`);
    } else {
      // Criar novo usuário
      await prisma.usuario.create({
        data: {
          nome: usuarioData.nome,
          pin: usuarioData.pin,
          cargo: usuarioData.cargo,
          ativo: true,
        },
      });
      console.log(`✅ Usuário criado: ${usuarioData.nome} (PIN: ${usuarioData.pin}, Cargo: ${usuarioData.cargo})`);
    }
  }

  console.log('✅ Todos os usuários de teste foram criados/atualizados!');

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

