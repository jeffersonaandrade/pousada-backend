// Script simples para adicionar produtos via API
const produtos = [
  { nome: 'Hambúrguer Artesanal', preco: 25.90, estoque: 50, categoria: 'Lanches' },
  { nome: 'Batata Frita', preco: 12.50, estoque: 100, categoria: 'Acompanhamentos' },
  { nome: 'Refrigerante Lata', preco: 5.00, estoque: 200, categoria: 'Bebidas' },
  { nome: 'Água Mineral', preco: 3.50, estoque: 150, categoria: 'Bebidas' },
  { nome: 'Cerveja Long Neck', preco: 8.00, estoque: 100, categoria: 'Bebidas' },
  { nome: 'Pizza Média', preco: 35.00, estoque: 30, categoria: 'Lanches' },
  { nome: 'Salada Caesar', preco: 18.00, estoque: 40, categoria: 'Saladas' },
  { nome: 'Suco Natural', preco: 7.50, estoque: 80, categoria: 'Bebidas' },
  { nome: 'Açaí', preco: 15.00, estoque: 60, categoria: 'Sobremesas' },
  { nome: 'Sorvete', preco: 10.00, estoque: 70, categoria: 'Sobremesas' },
];

async function adicionarProdutos() {
  console.log('Adicionando produtos...\n');
  
  for (const produto of produtos) {
    try {
      const response = await fetch('http://localhost:3000/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(produto),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✓ ${produto.nome} - R$ ${produto.preco.toFixed(2)}`);
      } else {
        console.log(`✗ ${produto.nome}: ${data.error}`);
      }
    } catch (error) {
      console.log(`✗ ${produto.nome}: ${error.message}`);
    }
  }
  
  console.log('\nConcluído!');
}

adicionarProdutos();

