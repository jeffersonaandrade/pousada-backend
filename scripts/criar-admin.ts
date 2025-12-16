import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function criarAdmin() {
  try {
    // Verifica se já existe um admin
    const adminExistente = await prisma.usuario.findFirst({
      where: { cargo: 'ADMIN' },
    });

    if (adminExistente) {
      console.log('✅ Já existe um usuário ADMIN cadastrado:');
      console.log(`   Nome: ${adminExistente.nome}`);
      console.log(`   PIN: ${adminExistente.pin}`);
      return;
    }

    // Cria o primeiro admin
    const admin = await prisma.usuario.create({
      data: {
        nome: 'Administrador',
        pin: '0000', // PIN padrão - ALTERE APÓS O PRIMEIRO LOGIN!
        cargo: 'ADMIN',
        ativo: true,
      },
    });

    console.log('✅ Usuário ADMIN criado com sucesso!');
    console.log('');
    console.log('📋 Credenciais de acesso:');
    console.log(`   Nome: ${admin.nome}`);
    console.log(`   PIN: ${admin.pin}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere o PIN após o primeiro login!');
    console.log('   Use a tela de Equipe no painel admin para editar o PIN.');
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

criarAdmin();

