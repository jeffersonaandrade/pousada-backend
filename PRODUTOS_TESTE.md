# Produtos para Teste - Adicionar ao Banco

## Opção 1: Via API (Recomendado)

Use o endpoint POST `/api/produtos` com os seguintes dados:

### Endpoint
```
POST http://192.168.0.38:3000/api/produtos
Content-Type: application/json
```

### Produtos para Adicionar

#### 1. Hambúrguer Artesanal
```json
{
  "nome": "Hambúrguer Artesanal",
  "preco": 25.90,
  "estoque": 50,
  "categoria": "Lanches"
}
```

#### 2. Batata Frita
```json
{
  "nome": "Batata Frita",
  "preco": 12.50,
  "estoque": 100,
  "categoria": "Acompanhamentos"
}
```

#### 3. Refrigerante Lata
```json
{
  "nome": "Refrigerante Lata",
  "preco": 5.00,
  "estoque": 200,
  "categoria": "Bebidas"
}
```

#### 4. Água Mineral
```json
{
  "nome": "Água Mineral",
  "preco": 3.50,
  "estoque": 150,
  "categoria": "Bebidas"
}
```

#### 5. Cerveja Long Neck
```json
{
  "nome": "Cerveja Long Neck",
  "preco": 8.00,
  "estoque": 100,
  "categoria": "Bebidas"
}
```

#### 6. Pizza Média
```json
{
  "nome": "Pizza Média",
  "preco": 35.00,
  "estoque": 30,
  "categoria": "Lanches"
}
```

#### 7. Salada Caesar
```json
{
  "nome": "Salada Caesar",
  "preco": 18.00,
  "estoque": 40,
  "categoria": "Saladas"
}
```

#### 8. Suco Natural
```json
{
  "nome": "Suco Natural",
  "preco": 7.50,
  "estoque": 80,
  "categoria": "Bebidas"
}
```

#### 9. Açaí
```json
{
  "nome": "Açaí",
  "preco": 15.00,
  "estoque": 60,
  "categoria": "Sobremesas"
}
```

#### 10. Sorvete
```json
{
  "nome": "Sorvete",
  "preco": 10.00,
  "estoque": 70,
  "categoria": "Sobremesas"
}
```

---

## Opção 2: Via Prisma Studio (Interface Visual)

1. Execute:
```bash
npm run prisma:studio
```

2. Abra o navegador em `http://localhost:5555`
3. Clique em "Produto"
4. Clique em "Add record"
5. Preencha os campos e salve

---

## Opção 3: Via SQL Direto (SQLite)

Se preferir, você pode executar SQL diretamente no banco:

```sql
INSERT INTO Produto (nome, preco, estoque, categoria) VALUES
('Hambúrguer Artesanal', 25.90, 50, 'Lanches'),
('Batata Frita', 12.50, 100, 'Acompanhamentos'),
('Refrigerante Lata', 5.00, 200, 'Bebidas'),
('Água Mineral', 3.50, 150, 'Bebidas'),
('Cerveja Long Neck', 8.00, 100, 'Bebidas'),
('Pizza Média', 35.00, 30, 'Lanches'),
('Salada Caesar', 18.00, 40, 'Saladas'),
('Suco Natural', 7.50, 80, 'Bebidas'),
('Açaí', 15.00, 60, 'Sobremesas'),
('Sorvete', 10.00, 70, 'Sobremesas');
```

Para executar no SQLite:
```bash
sqlite3 prisma/dev.db
```
Depois cole o SQL acima.

---

## Opção 4: Via Script (Se o servidor estiver rodando)

Execute o script que criei:
```bash
npm run seed:produtos
```

Ou diretamente:
```bash
npx tsx scripts/seed-produtos.ts
```

---

## Resumo dos Produtos

| Nome | Preço | Estoque | Categoria |
|------|-------|---------|-----------|
| Hambúrguer Artesanal | R$ 25,90 | 50 | Lanches |
| Batata Frita | R$ 12,50 | 100 | Acompanhamentos |
| Refrigerante Lata | R$ 5,00 | 200 | Bebidas |
| Água Mineral | R$ 3,50 | 150 | Bebidas |
| Cerveja Long Neck | R$ 8,00 | 100 | Bebidas |
| Pizza Média | R$ 35,00 | 30 | Lanches |
| Salada Caesar | R$ 18,00 | 40 | Saladas |
| Suco Natural | R$ 7,50 | 80 | Bebidas |
| Açaí | R$ 15,00 | 60 | Sobremesas |
| Sorvete | R$ 10,00 | 70 | Sobremesas |

---

## Teste após Adicionar

Verifique se os produtos foram adicionados:
```
GET http://192.168.0.38:3000/api/produtos
```

