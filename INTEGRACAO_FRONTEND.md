# 📋 Documentação de Integração - Backend para Frontend

## ✅ Status: Backend 100% Preparado!

O backend está **totalmente compatível** com o que o frontend espera. Todas as respostas abaixo.

---

## 📋 Informações Básicas de Conexão

### 1. Endereço da API

- **URL Base da API**: `http://192.168.0.38:3000/api`
- **URL do Socket.io**: `http://192.168.0.38:3000`
- **IP do Servidor**: `192.168.0.38`
- **Porta**: `3000` (configurável via variável de ambiente `PORT`)
- **Protocolo**: HTTP (para intranet)

### 2. Estrutura de Resposta da API

✅ **Formato padrão de resposta** (exatamente como o frontend espera):

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  code?: string; // Código do erro (quando aplicável)
}
```

---

## 🔌 Endpoints - TODOS IMPLEMENTADOS ✅

### **AUTENTICAÇÃO**

#### ✅ POST `/api/usuarios/auth`

**Body:**
```json
{
  "pin": "1234"
}
```

**Exemplo CURL:**
```bash
curl -X POST http://localhost:3000/api/usuarios/auth \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"1234\"}"
```

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "João Silva",
    "pin": "1234",
    "cargo": "WAITER",
    "ativo": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Resposta de erro (401):**
```json
{
  "success": false,
  "error": "PIN inválido ou usuário inativo"
}
```

**Importante:**
- ✅ Endpoint correto: `/api/usuarios/auth`
- ✅ PIN é enviado como **string** (4 dígitos)
- ✅ Valores de `cargo`: `"WAITER"`, `"MANAGER"`, `"ADMIN"`
- ✅ **O token JWT retornado deve ser armazenado e enviado em todas as requisições protegidas**
- ✅ Use o header `Authorization: Bearer <token>` para autenticar requisições protegidas

---

### **HÓSPEDES**

#### ✅ GET `/api/hospedes/pulseira/:uid`

**Parâmetros:**
- `uid`: UID da pulseira NFC (string)

**Exemplo CURL:**
```bash
curl -X GET http://localhost:3000/api/hospedes/pulseira/NFC123456
```

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tipo": "HOSPEDE",
    "nome": "Maria Santos",
    "documento": null,
    "quarto": "101",
    "uidPulseira": "NFC123456",
    "limiteGasto": null,
    "dividaAtual": 150.50,
    "ativo": true,
    "pedidos": [
      {
        "id": 1,
        "produto": { ... },
        "data": "2025-11-30T12:00:00Z"
      }
    ]
  }
}
```

**Resposta de erro (404):**
```json
{
  "success": false,
  "error": "Pulseira não encontrada"
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/hospedes/pulseira/:uid`
- ✅ UID é uma **string** (qualquer formato)
- ✅ Retorna 404 se não encontrado

---

#### ✅ POST `/api/hospedes`

**Body:**
```json
{
  "tipo": "HOSPEDE",
  "nome": "João Silva",
  "documento": "12345678900",
  "quarto": "101",
  "uidPulseira": "NFC123456",
  "limiteGasto": 200.00
}
```

**Exemplo CURL:**
```bash
curl -X POST http://localhost:3000/api/hospedes \
  -H "Content-Type: application/json" \
  -d "{\"tipo\":\"HOSPEDE\",\"nome\":\"João Silva\",\"documento\":\"12345678900\",\"quarto\":\"101\",\"uidPulseira\":\"NFC123456\",\"limiteGasto\":200.00}"
```

**Resposta de sucesso (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tipo": "HOSPEDE",
    "nome": "João Silva",
    "documento": null,
    "quarto": "101",
    "uidPulseira": "NFC123456",
    "limiteGasto": 200.00,
    "dividaAtual": 0,
    "ativo": true
  }
}
```

**Validações implementadas:**
- ✅ **Documento obrigatório** para `tipo: "DAY_USE"`
- ✅ **Quarto obrigatório** para `tipo: "HOSPEDE"`
- ✅ **Pulseira única**: Se já cadastrada, retorna erro 400 com mensagem clara
- ✅ Valores de `tipo`: `"HOSPEDE"`, `"DAY_USE"`, `"VIP"`

**Resposta de erro (400):**
```json
{
  "success": false,
  "error": "Documento é obrigatório para Day Use"
}
```
ou
```json
{
  "success": false,
  "error": "Quarto é obrigatório para Hóspede"
}
```
ou
```json
{
  "success": false,
  "error": "uidPulseira já está em uso",
  "code": "VALIDATION_ERROR"
}
```

---

#### ✅ GET `/api/hospedes`

**Query Params (opcionais):**
- `ativo`: string (`"true"` ou `"false"`)

**Exemplo CURL:**
```bash
# Listar todos
curl -X GET http://localhost:3000/api/hospedes

# Filtrar apenas ativos
curl -X GET http://localhost:3000/api/hospedes?ativo=true
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tipo": "HOSPEDE",
      "nome": "Maria Santos",
      "documento": null,
      "quarto": "101",
      "uidPulseira": "NFC123456",
      "limiteGasto": null,
      "dividaAtual": 150.50,
      "ativo": true
    }
  ]
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/hospedes`
- ✅ Filtro `ativo` suportado (query param como string)

---

#### ✅ PATCH `/api/hospedes/:id/checkout`

**Descrição:**
- Zera a dívida do hóspede
- Desativa o hóspede (libera a pulseira para reuso)
- Operação de checkout completa

**Parâmetros:**
- `id`: ID do hóspede (number, na URL)

**Exemplo CURL:**
```bash
curl -X PATCH http://localhost:3000/api/hospedes/1/checkout \
  -H "Content-Type: application/json"
```

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tipo": "HOSPEDE",
    "nome": "João Silva",
    "documento": null,
    "quarto": "101",
    "uidPulseira": "NFC123456",
    "limiteGasto": null,
    "dividaAtual": 0.00,
    "ativo": false
  }
}
```

**Resposta de erro (404):**
```json
{
  "success": false,
  "error": "Hóspede não encontrado"
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/hospedes/:id/checkout`
- ✅ Zera a dívida automaticamente
- ✅ Desativa o hóspede (libera pulseira)
- ✅ Rota pública (não requer autenticação)
- ✅ Retorna 404 se hóspede não encontrado

---

### **PRODUTOS**

#### ✅ GET `/api/produtos`

**Query Params (opcionais):**
- `categoria`: string

**Exemplo CURL:**
```bash
# Listar todos os produtos
curl -X GET http://localhost:3000/api/produtos

# Filtrar por categoria
curl -X GET http://localhost:3000/api/produtos?categoria=Lanches
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nome": "Hambúrguer",
      "preco": 25.90,
      "estoque": 10,
      "foto": "http://...",
      "categoria": "Lanches"
    }
  ]
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/produtos`
- ✅ URL da foto: **string** (pode ser absoluta ou relativa, conforme enviado)
- ✅ Filtro por categoria funciona via query param: `?categoria=Lanches`

---

### **PEDIDOS**

#### ✅ POST `/api/pedidos`

**Regra de Segurança:**
- **Cenário A (NFC)**: Aprovação automática via pulseira
- **Cenário B (Manual)**: Requer PIN de gerente/manager para autorização

**Body - Cenário A (NFC - Pulseira):**
```json
{
  "items": [
    { "produtoId": 5, "quantidade": 1 },
    { "produtoId": 3, "quantidade": 2 }
  ],
  "uidPulseira": "NFC123456"
}
```

**Body - Cenário B (Manual - Digitação):**
```json
{
  "items": [
    { "produtoId": 5, "quantidade": 1 },
    { "produtoId": 3, "quantidade": 2 }
  ],
  "hospedeId": 1,
  "managerPin": "5678"
}
```

**Exemplo CURL - Cenário A (NFC):**
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"produtoId\":5,\"quantidade\":1}],\"uidPulseira\":\"NFC123456\"}"
```

**Exemplo CURL - Cenário B (Manual):**
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"produtoId\":5,\"quantidade\":1}],\"hospedeId\":1,\"managerPin\":\"5678\"}"
```

**Resposta de sucesso (201):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "hospedeId": 1,
      "produtoId": 5,
      "status": "PENDENTE",
      "valor": 25.90,
      "data": "2025-11-30T12:00:00Z",
      "hospede": {
        "id": 1,
        "nome": "Maria Santos",
        ...
      },
      "produto": {
        "id": 5,
        "nome": "Hambúrguer",
        ...
      }
    }
  ],
  "count": 1
}
```

**Validações automáticas:**
- ✅ **Estoque**: Verifica e decrementa automaticamente
- ✅ **Limite de gasto**: Valida para Day Use automaticamente
- ✅ **Hóspede ativo**: Verifica se está ativo
- ✅ **Transação atômica**: Se qualquer validação falhar, nada é salvo
- ✅ **PIN de Gerente (Manual)**: Valida se PIN pertence a MANAGER ou ADMIN

**Respostas de erro (400):**
```json
{
  "success": false,
  "error": "Produto sem estoque disponível"
}
```
ou
```json
{
  "success": false,
  "error": "Limite de gasto excedido. Limite: R$ 200.00, Dívida atual: R$ 150.50, Valor do pedido: R$ 25.90"
}
```
ou
```json
{
  "success": false,
  "error": "Hóspede inativo"
}
```
ou
```json
{
  "success": false,
  "error": "PIN de gerente é obrigatório para pedidos manuais"
}
```
ou
```json
{
  "success": false,
  "error": "É necessário informar uidPulseira (NFC) ou hospedeId + managerPin (Manual)"
}
```

**Respostas de erro (403):**
```json
{
  "success": false,
  "error": "Permissão negada: PIN de gerente inválido ou sem permissão"
}
```

**Respostas de erro (404):**
```json
{
  "success": false,
  "error": "Pulseira não encontrada ou hóspede inativo"
}
```
ou
```json
{
  "success": false,
  "error": "Hóspede não encontrado"
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/pedidos`
- ✅ **Cenário A (NFC)**: Aprovação automática via `uidPulseira`
- ✅ **Cenário B (Manual)**: Requer `hospedeId` + `managerPin` (PIN de MANAGER ou ADMIN)
- ✅ Suporta múltiplos itens em uma única requisição
- ✅ Valida estoque automaticamente
- ✅ Valida limite de gasto automaticamente
- ✅ Retorna erro 400 se sem estoque
- ✅ Retorna erro 400 se exceder limite
- ✅ Retorna erro 403 se PIN de gerente inválido ou sem permissão
- ✅ Retorna erro 404 se pulseira/hóspede não encontrado

---

#### ✅ GET `/api/pedidos`

**Query Params (opcionais):**
- `status`: string (`"PENDENTE"`, `"PREPARANDO"`, `"PRONTO"`, `"ENTREGUE"`, `"CANCELADO"`)
- `hospedeId`: number (ID do hóspede para filtrar pedidos de um hóspede específico)
- `page`: number (página para paginação, padrão: 1)
- `limit`: number (itens por página, padrão: 10)
- `busca`: string (busca por nome do hóspede ou produto)

**Exemplo CURL:**
```bash
# Listar todos os pedidos
curl -X GET http://localhost:3000/api/pedidos

# Filtrar por status
curl -X GET http://localhost:3000/api/pedidos?status=PENDENTE

# Filtrar pedidos de um hóspede específico
curl -X GET "http://localhost:3000/api/pedidos?hospedeId=1"

# Filtrar pedidos de um hóspede com status específico
curl -X GET "http://localhost:3000/api/pedidos?hospedeId=1&status=ENTREGUE"
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "hospedeId": 1,
      "produtoId": 5,
      "status": "PENDENTE",
      "valor": 25.90,
      "data": "2025-11-30T12:00:00Z",
      "hospede": {
        "id": 1,
        "nome": "Maria Santos",
        "tipo": "HOSPEDE",
        ...
      },
      "produto": {
        "id": 5,
        "nome": "Hambúrguer",
        "preco": 25.90,
        ...
      }
    }
  ]
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/pedidos`
- ✅ Filtro por status funciona via query param: `?status=PENDENTE`
- ✅ Filtro por hóspede funciona via query param: `?hospedeId=1`
- ✅ Pode combinar filtros: `?hospedeId=1&status=ENTREGUE`
- ✅ **Relacionamentos incluídos**: `hospede` e `produto` vêm no array
- ✅ Retorna array vazio se não houver pedidos para o hóspede
- ✅ Suporta paginação via `page` e `limit`

---

#### ✅ PATCH `/api/pedidos/:id/status`

**Body:**
```json
{
  "status": "PRONTO"
}
```

**Exemplo CURL:**
```bash
curl -X PATCH http://localhost:3000/api/pedidos/1/status \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"PRONTO\"}"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "PRONTO",
    "hospedeId": 1,
    "produtoId": 5,
    "valor": 25.90,
    "data": "2025-11-30T12:00:00Z",
    "hospede": { ... },
    "produto": { ... }
  }
}
```

**Respostas:**
- ✅ Endpoint correto: `/api/pedidos/:id/status`
- ✅ Status válidos: `"PENDENTE"`, `"PREPARANDO"`, `"PRONTO"`, `"ENTREGUE"`, `"CANCELADO"`

---

## 🔔 Socket.io - Eventos em Tempo Real

### Eventos que o backend emite:

#### 1. **Novo Pedido Criado**
```javascript
socket.on('novo_pedido', (pedido) => {
  // pedido contém:
  // {
  //   id, hospedeId, produtoId, status, valor, data,
  //   hospede: { id, nome, tipo, ... },
  //   produto: { id, nome, preco, ... }
  // }
});
```

#### 2. **Status do Pedido Atualizado**
```javascript
socket.on('pedido_atualizado', (pedido) => {
  // pedido contém o objeto completo atualizado
});
```

#### 3. **Pedido Cancelado**
```javascript
socket.on('pedido_cancelado', (pedido) => {
  // pedido contém o objeto cancelado
});
```

**Nota**: O backend não emite evento específico de "estoque atualizado", mas o estoque é atualizado automaticamente quando um pedido é criado ou cancelado. O frontend pode consultar o produto novamente se necessário.

**Respostas:**
- ✅ Eventos emitidos: `novo_pedido`, `pedido_atualizado`, `pedido_cancelado`
- ✅ Formato: Objeto completo do pedido com relacionamentos

---

## ⚠️ Tratamento de Erros

### Códigos de Status HTTP:

- ✅ **200**: Sucesso
- ✅ **201**: Criado com sucesso
- ✅ **400**: Erro de validação/regra de negócio
- ✅ **401**: Não autorizado
- ✅ **404**: Não encontrado
- ✅ **500**: Erro do servidor

### Formato das mensagens de erro:

```json
{
  "success": false,
  "error": "Mensagem de erro descritiva",
  "code": "VALIDATION_ERROR" // Opcional, quando aplicável
}
```

**Exemplos:**
```json
{
  "success": false,
  "error": "PIN inválido ou usuário inativo"
}
```

```json
{
  "success": false,
  "error": "Limite de gasto excedido. Limite: R$ 200.00, Dívida atual: R$ 150.50, Valor do pedido: R$ 25.90"
}
```

---

## 🔐 Segurança e Autenticação

### Autenticação por PIN com JWT

- ✅ **PIN é usado para login** inicial em `/api/usuarios/auth`
- ✅ **JWT é retornado** após login bem-sucedido e deve ser armazenado no frontend
- ✅ **Token JWT é obrigatório** para todas as rotas protegidas (criar/editar usuários, zerar dívidas, etc.)
- ✅ Para rotas administrativas, envie o token no header:
  - `Authorization: Bearer <token_jwt>`: Token JWT obtido após login em `/api/usuarios/auth`
- ✅ O token expira em 24 horas (configurável via `JWT_EXPIRES_IN`)

### CORS

- ✅ CORS configurado e **permitindo todas as origens** por padrão
- ✅ Configurável via variável de ambiente `CORS_ORIGINS` (separado por vírgula)
- ✅ Exemplo: `CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.101:3000`

---

## 📝 Validações do Backend

### ✅ Validações Implementadas:

#### 1. **Criar Hóspede:**
- ✅ Pulseira já cadastrada? → Erro 400
- ✅ Documento obrigatório para Day Use? → Erro 400
- ✅ Quarto obrigatório para Hóspede? → Erro 400

#### 2. **Criar Pedido:**
- ✅ Estoque disponível? → Erro 400 se sem estoque
- ✅ Limite de gasto (Day Use)? → Erro 400 se exceder
- ✅ Hóspede ativo? → Erro 400 se inativo
- ✅ Hóspede existe? → Erro 404 se não encontrado
- ✅ Produto existe? → Erro 404 se não encontrado

#### 3. **Autenticação:**
- ✅ PIN válido? → Erro 401 se inválido
- ✅ Usuário ativo? → Erro 401 se inativo

---

## 🎯 Informações Adicionais

### 1. Versão da API
- ❌ Não há versionamento (v1, v2, etc.) - não necessário para este projeto

### 2. Rate Limiting
- ✅ Implementado: **100 requisições por minuto por IP** (configurável)
- ✅ Configurável via `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW`

### 3. Timeout
- ⚠️ Não há timeout específico configurado - usar timeout padrão do cliente HTTP

### 4. Logs
- ✅ Logs estruturados com Pino
- ✅ Todas as operações críticas são logadas
- ✅ Logs incluem: usuário, IP, operação, detalhes

### 5. Ambiente de Teste
- ✅ Use o mesmo servidor de desenvolvimento
- ✅ Banco SQLite local (`dev.db`)

---

## 📋 Checklist de Informações

- [x] ✅ URL base da API: `http://IP:PORTA/api`
- [x] ✅ Porta do servidor: `3000` (configurável)
- [x] ✅ Protocolo: HTTP
- [x] ✅ Estrutura de resposta padrão: `{ success, data, error }`
- [x] ✅ Endpoints confirmados: TODOS
- [x] ✅ Formato dos dados: JSON
- [x] ✅ Códigos de status HTTP: 200, 201, 400, 401, 404, 500
- [x] ✅ Mensagens de erro: Formatadas e descritivas
- [x] ✅ Validações do backend: TODAS implementadas
- [x] ✅ Eventos Socket.io: `novo_pedido`, `pedido_atualizado`, `pedido_cancelado`
- [x] ✅ Autenticação: Por PIN (sem JWT)
- [x] ✅ CORS configurado: Permitindo todas as origens por padrão

---

## 🚀 Próximos Passos para o Frontend

1. ✅ **Configurar URL da API** em `src/config/api.ts`:
   ```typescript
   export const API_BASE_URL = 'http://192.168.0.38:3000/api';
   export const SOCKET_URL = 'http://192.168.0.38:3000';
   ```

2. ✅ **Implementar Socket.io**:
   ```typescript
   import io from 'socket.io-client';
   const socket = io('http://192.168.0.38:3000');
   
   socket.on('novo_pedido', (pedido) => { ... });
   socket.on('pedido_atualizado', (pedido) => { ... });
   socket.on('pedido_cancelado', (pedido) => { ... });
   ```

3. ✅ **Testar integração completa**

---

## ✅ CONCLUSÃO

**O backend está 100% preparado e compatível com o frontend!**

Todos os endpoints estão implementados, as validações estão funcionando, os eventos Socket.io estão configurados, e o formato de resposta é exatamente o esperado.

**Nenhuma alteração necessária no backend!** 🎉

