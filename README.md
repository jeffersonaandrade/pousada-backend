# Pousada RFID System - Backend

Sistema de gestão de consumo para pousadas e bares utilizando tecnologia RFID. Este backend fornece uma API REST completa, painel administrativo e comunicação em tempo real para gerenciar hóspedes, produtos e pedidos.

## Tecnologias Utilizadas

O backend foi construído com as seguintes tecnologias modernas e robustas:

- **Node.js** com **TypeScript** para desenvolvimento type-safe
- **Fastify** como framework web de alta performance
- **Prisma ORM** para gerenciamento do banco de dados
- **SQLite** como banco de dados local (ideal para redes locais/intranet)
- **Frontend React** (Vite) para painel administrativo customizado
- **Socket.io** para comunicação em tempo real entre cozinha e salão

## Arquitetura do Sistema

O sistema implementa uma arquitetura em camadas bem definida, separando responsabilidades entre **rotas**, **services** e **modelos de dados**. As regras de negócio críticas são implementadas nos services, garantindo atomicidade e consistência das operações através de transações do Prisma.

### Modelo de Dados

O banco de dados é estruturado com as seguintes entidades principais:

| Entidade | Descrição | Campos Principais |
|----------|-----------|-------------------|
| **Usuario** | Garçons e funcionários do sistema | `nome`, `pin` (4 dígitos), `cargo` (WAITER/MANAGER/ADMIN), `ativo` |
| **Quarto** | Quartos da pousada | `numero` (único), `andar`, `categoria`, `status` (LIVRE/OCUPADO/LIMPEZA/MANUTENCAO) |
| **Hospede** | Clientes da pousada ou day use | `tipo` (HOSPEDE/DAY_USE/VIP), `nome`, `documento`, `quartoId`, `uidPulseira` (único), `limiteGasto`, `dividaAtual`, `ativo`, `dataCheckout` |
| **Produto** | Itens do cardápio | `nome`, `preco`, `estoque`, `foto`, `categoria`, `setor` (COZINHA/BAR_PISCINA/BOATE), `visivelCardapio` |
| **Pedido** | Pedidos realizados | `hospedeId`, `produtoId`, `status` (PENDENTE/PREPARANDO/PRONTO/ENTREGUE/CANCELADO), `valor`, `data`, `metodoCriacao` (NFC/MANUAL), `dataInicioPreparo`, `dataPronto` |
| **Pagamento** | Histórico de pagamentos | `hospedeId`, `valor`, `metodo` (PIX/DINHEIRO/CARTAO/DEBITO), `data` |
| **PerdaEstoque** | Baixas técnicas de estoque | `produtoId`, `quantidade`, `motivo`, `usuarioId`, `data` |

### Regras de Negócio Implementadas

O sistema implementa regras de negócio críticas que garantem a integridade operacional e a consistência dos dados. Todas as operações críticas são executadas dentro de transações do Prisma para garantir atomicidade.

#### 📋 **Módulo: Hóspedes (Check-in/Check-out)**

**1. Validações de Check-in:**
- **Day Use**: Documento é obrigatório para clientes do tipo `DAY_USE`
- **Hóspede**: Quarto é obrigatório para clientes do tipo `HOSPEDE`
- **Pagamento na Entrada**: Se `pagoNaEntrada = true`, o campo `metodoPagamento` é obrigatório
- **Quarto Disponível**: O quarto deve estar com status `LIVRE` e sem hóspedes ativos para permitir check-in
- **Ocupação Automática**: Ao realizar check-in, o quarto é automaticamente marcado como `OCUPADO`

**2. Criação Automática de Pedido de Diária:**
- Se `valorEntrada` for fornecido, o sistema cria automaticamente um pedido de "Diária" ou "Day Use"
- O produto de diária é criado automaticamente se não existir (categoria "Serviço", estoque infinito)
- Produtos de serviço (Diária/Day Use) são criados com `visivelCardapio: false` (não aparecem no cardápio)

**3. Inicialização de Dívida:**
- Se `pagoNaEntrada = true`: `dividaAtual` começa em `0`
- Se `pagoNaEntrada = false` ou não informado: `dividaAtual` começa com o valor de `valorEntrada`
- Se não houver `valorEntrada`: `dividaAtual` começa em `0`

**4. Check-out:**
- **Pagamento Obrigatório**: Exige criação de `Pagamento` com o valor restante da dívida
- **Validação de Pagamento**: Valida se a soma dos pagamentos corresponde à `dividaAtual` (tolerância de R$ 0,01)
- **Forçar Checkout**: Permite checkout mesmo com diferença de pagamento se `forcarCheckout = true`
- **Liberação de Recursos**: 
  - Zera `dividaAtual`
  - Define `ativo = false`
  - Libera pulseira (`uidPulseira = null`) para reuso
  - Grava `dataCheckout` com horário brasileiro
- **Status do Quarto**: Ao realizar checkout, o quarto é automaticamente marcado como `LIMPEZA`

#### 🛒 **Módulo: Pedidos**

**1. Validações de Criação:**
- **Hóspede Ativo**: Apenas hóspedes com `ativo = true` podem fazer pedidos
- **Estoque Disponível**: Produto deve ter `estoque > 0` e quantidade suficiente
- **Limite Day Use**: Para clientes `DAY_USE` com `limiteGasto` configurado:
  - Calcula: `dividaAtual + valorNovoPedido`
  - Se exceder `limiteGasto`, bloqueia a venda com erro 403
  - Mensagem detalhada informa limite, dívida atual e valor do pedido

**2. Controle Atômico de Estoque:**
- Todas as operações de pedido são executadas em transação única
- Verifica estoque → Decrementa estoque → Cria pedido → Atualiza dívida
- Se qualquer etapa falhar, toda a operação é revertida automaticamente

**3. Atualização de Dívida:**
- Ao criar pedido, `dividaAtual` do hóspede é incrementada com o valor do pedido
- Valor do pedido é congelado no momento da criação (não muda se o preço do produto mudar depois)

**4. Cancelamento de Pedidos:**
- **Autorização Obrigatória**: Requer PIN de gerente/administrador (`managerPin`)
- **Validação de Permissão**: PIN deve pertencer a usuário com cargo `MANAGER` ou `ADMIN`
- **Estorno Automático**:
  - Devolve itens ao estoque (`estoque + quantidade`)
  - Subtrai valor da `dividaAtual` do hóspede
  - Atualiza status do pedido para `CANCELADO`
- **Transação Atômica**: Toda operação de cancelamento é executada em transação única

**5. Timestamps de Preparo:**
- `dataInicioPreparo`: Gravado quando status muda para `PREPARANDO` (apenas na primeira vez)
- `dataPronto`: Gravado quando status muda para `PRONTO`
- Todos os timestamps usam horário brasileiro para fins legais

**6. Data/Hora do Pedido:**
- Todos os pedidos são gravados com `data` no horário brasileiro (timezone configurado)
- Importante para fins legais e contestação de compras

**7. Vinculação ao Garçom:**
- Pedidos criados via API são automaticamente vinculados ao usuário autenticado (`usuarioId`)
- Se o pedido for criado com autenticação (PIN ou JWT), o campo `usuarioId` é preenchido
- Pedidos criados sem autenticação ou durante check-in automático têm `usuarioId = null`
- Permite rastreamento de "Meus Pedidos Recentes" por garçom
- Filtros disponíveis: `usuarioId=X` (pedidos de um garçom) e `recente=true` (últimas 24h)

#### 📦 **Módulo: Produtos**

**1. Visibilidade no Cardápio:**
- Campo `visivelCardapio` controla se o produto aparece no cardápio do garçom/tablet
- **Padrão**: `true` (produtos aparecem no cardápio)
- **Produtos de Serviço**: "Day Use" e "Diária" são criados com `visivelCardapio: false`
- **Filtro Automático**: Quando `apenasDisponiveis=true` (cardápio), filtra automaticamente:
  - Produtos com `estoque > 0`
  - Produtos com `visivelCardapio = true`

**2. Categorização por Setor:**
- Campo `setor` categoriza produtos por área de produção:
  - `COZINHA`: Produtos preparados na cozinha geral
  - `BAR_PISCINA`: Produtos preparados no bar da piscina
  - `BOATE`: Produtos preparados na boate
- **Padrão**: `COZINHA`
- Usado no KDS (Kitchen Display System) para colorir cards visualmente

**3. Exclusão de Produtos:**
- **Proteção de Dados**: Não permite excluir produtos com:
  - Pedidos associados (histórico de vendas)
  - Registros de baixa técnica (perdas de estoque)
- **Alternativa**: Para ocultar produto, defina `estoque = 0` ou `visivelCardapio = false`

**4. Produtos Especiais (Serviços):**
- Produtos como "Diária" e "Day Use" são criados automaticamente
- Possuem estoque infinito (999999)
- Não aparecem no cardápio (`visivelCardapio: false`)
- Preço pode ser atualizado no momento do check-in

#### 🏨 **Módulo: Quartos**

**1. Status de Quartos:**
- **LIVRE**: Disponível para check-in
- **OCUPADO**: Hóspede ativo no quarto (mudado automaticamente no check-in)
- **LIMPEZA**: Após checkout, aguardando limpeza (mudado automaticamente no check-out)
- **MANUTENCAO**: Quarto em manutenção (definido manualmente)

**2. Validações de Check-in:**
- Quarto deve estar `LIVRE` para permitir check-in
- Quarto não pode ter hóspedes ativos vinculados
- Ao confirmar check-in, status muda automaticamente para `OCUPADO`

**3. Transições de Status:**
- **LIVRE** → Pode mudar para: `OCUPADO`, `LIMPEZA`, `MANUTENCAO`
- **OCUPADO** → Pode mudar para: `LIMPEZA`, `MANUTENCAO` (não pode ir direto para `LIVRE`)
- **LIMPEZA** → Pode mudar para: `LIVRE` (após limpeza concluída)
- **MANUTENCAO** → Pode mudar para: `LIVRE` (após manutenção concluída)
- **Bloqueio**: Não permite mudar status de quarto `OCUPADO` com hóspede ativo (exceto via checkout)

**4. Exclusão de Quartos:**
- **Regras de Segurança**:
  - Status deve ser `LIVRE`
  - Não pode ter hóspedes ativos vinculados
- **Histórico**: Avisa sobre histórico de hóspedes, mas permite exclusão (V1 - sem soft delete)

#### 💰 **Módulo: Pagamentos**

**1. Registro de Pagamentos:**
- Todos os pagamentos são registrados com data/hora no horário brasileiro
- Métodos aceitos: `PIX`, `DINHEIRO`, `CARTAO`, `DEBITO`
- Histórico completo mantido para auditoria

**2. Validação no Checkout:**
- Soma de todos os pagamentos deve corresponder à `dividaAtual`
- Tolerância de R$ 0,01 para diferenças de arredondamento
- Permite forçar checkout mesmo com diferença (para casos especiais)

#### 📊 **Módulo: Estoque**

**1. Baixa Técnica (Perdas):**
- Decrementa estoque do produto
- Registra motivo (Quebra, Vencimento, Erro, etc.)
- Registra usuário que realizou a baixa
- Não gera impacto financeiro (apenas controle de estoque)
- Valida estoque suficiente antes de registrar baixa

**2. Controle de Estoque em Pedidos:**
- Verifica estoque antes de criar pedido
- Decrementa estoque automaticamente ao criar pedido
- Incrementa estoque automaticamente ao cancelar pedido

#### 🔐 **Módulo: Usuários e Autenticação**

**1. Validação de PIN:**
- PIN deve conter exatamente 4 dígitos numéricos
- PIN deve ser único entre usuários ativos
- Usuários inativos podem reutilizar PINs

**2. Cargos e Permissões:**
- **WAITER**: Garçom - pode criar pedidos, atualizar status
- **MANAGER**: Gerente - pode autorizar pedidos manuais, cancelar pedidos
- **ADMIN**: Administrador - acesso total ao sistema

**3. Autenticação de Pedidos Manuais:**
- Pedidos criados manualmente (sem NFC) requerem PIN de `MANAGER` ou `ADMIN`
- PIN é validado antes de autorizar o pedido
- Gerente que autorizou fica registrado no pedido (`gerenteId`)

#### ⚡ **Garantias de Integridade**

**1. Transações Atômicas:**
- Todas as operações críticas usam transações do Prisma
- Se qualquer etapa falhar, toda a operação é revertida
- Garante consistência dos dados mesmo em caso de erro

**2. Horário Brasileiro:**
- Todas as datas/horas são gravadas no timezone brasileiro
- Importante para fins legais e contestação de compras
- Função `getDataHoraBrasil()` garante consistência

**3. Validações em Múltiplas Camadas:**
- Validações no Service (regras de negócio)
- Validações no Route (formato dos dados)
- Validações no Banco (constraints e relacionamentos)

## Instalação e Configuração

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:

- **Node.js** versão 18 ou superior
- **npm** ou **yarn** para gerenciamento de pacotes

### Passo 1: Instalar Dependências

Execute o comando abaixo na raiz do projeto backend:

```bash
npm install
```

### Passo 2: Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e ajuste as configurações conforme necessário:

```bash
cp .env.example .env
```

O arquivo `.env` contém as seguintes variáveis:

```env
PORT=3000
DATABASE_URL="file:./dev.db"

# Proteções para intranet
RATE_LIMIT_MAX=100                    # Máximo de requisições por IP
RATE_LIMIT_WINDOW=60000              # Janela de tempo em ms (60000 = 1 minuto)
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000  # Origens permitidas (separadas por vírgula)

# Autenticação JWT
JWT_SECRET=sua-chave-secreta-super-segura-para-intranet-123456789  # Altere para uma chave segura em produção
JWT_EXPIRES_IN=24h                                                    # Tempo de expiração do token (padrão: 24 horas)
```

**Importante**: 
- `CORS_ORIGINS`: Configure os IPs/domínios da sua intranet. Se não configurado, permite todas as origens (apenas para desenvolvimento).
- `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW`: Ajuste conforme necessário para sua rede.

**Autenticação:**
O sistema não usa mais variáveis de ambiente para login. A autenticação é feita através de **usuários cadastrados na tabela `Usuario`** com PIN de 4 dígitos.

**Primeiro Acesso:**
Após executar as migrations, crie o primeiro usuário administrador:

```bash
npm run criar:admin
```

Isso criará um usuário admin com as seguintes credenciais:
- **Nome:** Administrador
- **PIN:** 0000
- **Cargo:** ADMIN

⚠️ **IMPORTANTE:** Altere o PIN após o primeiro login usando a tela de Equipe no painel administrativo.

**Login no Sistema:**
1. Acesse `http://localhost:3000` (será redirecionado para `/login`)
2. Digite o PIN de 4 dígitos do usuário
3. Após autenticação, você terá acesso ao painel administrativo

**Criar Novos Usuários:**
Use a tela de Equipe no painel admin para criar novos usuários (garçons, gerentes, etc.).

### Passo 3: Executar Migrations do Banco de Dados

O Prisma precisa criar as tabelas no banco SQLite. Execute:

```bash
npm run prisma:migrate
```

Ou, se preferir apenas sincronizar sem criar migrations:

```bash
npm run prisma:push
```

Este comando irá:
- Gerar o cliente Prisma com base no schema
- Criar o arquivo `dev.db` com todas as tabelas
- Aplicar os índices e relacionamentos

### Passo 4: Iniciar o Servidor

Para desenvolvimento com hot-reload:

```bash
npm run dev
```

Para produção (após build):

```bash
npm run build
npm start
```

O servidor estará disponível em `http://localhost:3000`.

## Endpoints da API

Todos os endpoints retornam respostas no formato JSON com a estrutura:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  code?: string; // Código do erro (quando aplicável)
}
```

### Autenticação

O sistema usa **autenticação híbrida** com 3 níveis diferentes:

#### 1. **Cliente (Público)**
- Não precisa de autenticação
- Identifica-se através da pulseira RFID (`uidPulseira`)
- Ao criar pedido, envia `uidPulseira` no body

#### 2. **Garçom (PIN)**
- Usa PIN de 4 dígitos no header `X-User-Pin`
- Não precisa fazer login ou obter JWT
- Pode criar pedidos, cancelar e atualizar status

**Exemplo:**
```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "X-User-Pin: 1234" \
  -H "Content-Type: application/json" \
  -d "{\"hospedeId\":1,\"produtoId\":5}"
```

#### 3. **Admin/Manager (JWT)**
- Login inicial (POST `/api/usuarios/auth`):
```json
{
  "pin": "0000"
}
```

- Resposta com token JWT:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Administrador",
    "pin": "0000",
    "cargo": "ADMIN",
    "ativo": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

- Usar o token em requisições administrativas:
```
Authorization: Bearer <token_jwt>
```

**Exemplo CURL:**
```bash
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d "{\"nome\":\"João\",\"pin\":\"1234\",\"cargo\":\"WAITER\"}"
```

**Nota**: O token JWT expira em 24 horas (configurável via variável de ambiente `JWT_EXPIRES_IN`).

### Usuários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/usuarios` | Criar novo usuário |
| `GET` | `/api/usuarios` | Listar usuários (query: `?ativo=true`) |
| `GET` | `/api/usuarios/:id` | Buscar usuário por ID |
| `POST` | `/api/usuarios/auth` | Autenticar por PIN |
| `PATCH` | `/api/usuarios/:id` | Atualizar usuário |
| `POST` | `/api/usuarios/:id/desativar` | Desativar usuário |

### Hóspedes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/hospedes` | Criar novo hóspede (check-in) com validação de quarto |
| `GET` | `/api/hospedes` | Listar hóspedes (query: `?ativo=true&tipo=HOSPEDE&busca=nome`) |
| `GET` | `/api/hospedes/:id` | Buscar hóspede por ID (inclui pedidos e pagamentos) |
| `GET` | `/api/hospedes/pulseira/:uid` | Buscar por UID da pulseira NFC |
| `PATCH` | `/api/hospedes/:id` | Atualizar hóspede |
| `POST` | `/api/hospedes/:id/desativar` | Desativar hóspede |
| `POST` | `/api/hospedes/:id/zerar-divida` | Zerar dívida do hóspede (requer autenticação) |
| `POST` | `/api/hospedes/:id/checkout` | Checkout com pagamento obrigatório |
| `GET` | `/api/hospedes/diagnostico/dividas` | Diagnóstico de dívidas (comparação com cálculos) |

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/produtos` | Criar novo produto (aceita `setor` e `visivelCardapio`) |
| `GET` | `/api/produtos` | Listar produtos (query: `?categoria=bebidas&apenasDisponiveis=true`) |
| `GET` | `/api/produtos/:id` | Buscar produto por ID |
| `PATCH` | `/api/produtos/:id` | Atualizar produto |
| `POST` | `/api/produtos/:id/estoque` | Adicionar estoque |
| `DELETE` | `/api/produtos/:id` | Deletar produto (bloqueado se houver pedidos ou perdas) |

**Query Params do GET `/api/produtos`:**
- `apenasDisponiveis=true`: Retorna apenas produtos com `estoque > 0` e `visivelCardapio = true` (para cardápio)
- `categoria`: Filtrar por categoria
- `estoqueBaixo=true`: Filtrar produtos com estoque < 10
- `busca`: Buscar por nome, categoria ou descrição

### Pedidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/pedidos` | Criar pedido(s) - aceita múltiplos itens em uma requisição |
| `GET` | `/api/pedidos` | Listar pedidos (query: `?status=PENDENTE&hospedeId=1&metodoCriacao=NFC&usuarioId=2&recente=true`) |
| `GET` | `/api/pedidos/:id` | Buscar pedido por ID |
| `PATCH` | `/api/pedidos/:id/status` | Atualizar status (requer autenticação PIN ou JWT) |
| `DELETE` | `/api/pedidos/:id` | Cancelar pedido (requer `managerPin` no body) |

**Criação de Pedidos:**
- **NFC (Automático)**: Enviar `uidPulseira` no body - aprovação automática
- **Manual**: Enviar `hospedeId` + `managerPin` - requer PIN de MANAGER/ADMIN
- Aceita múltiplos itens: `{ items: [{ produtoId, quantidade }], ... }`
- **Vinculação ao Garçom**: Se autenticado via PIN ou JWT, o pedido é automaticamente vinculado ao usuário que o criou

**Filtros de Listagem:**
- `status`: Filtrar por status (PENDENTE, PREPARANDO, PRONTO, ENTREGUE, CANCELADO)
- `hospedeId`: Filtrar pedidos de um hóspede específico
- `metodoCriacao`: Filtrar por método (NFC ou MANUAL)
- `usuarioId`: Filtrar pedidos criados por um garçom específico (ex: "Meus Pedidos")
- `recente`: Filtrar pedidos das últimas 24 horas (`recente=true`)
- `busca`: Busca textual por nome do hóspede ou produto
- `page` e `limit`: Paginação (padrão: page=1, limit=10)

**Exemplos de Uso:**
- `GET /api/pedidos?recente=true` - Pedidos das últimas 24h
- `GET /api/pedidos?usuarioId=2` - Pedidos criados pelo garçom ID 2
- `GET /api/pedidos?usuarioId=2&recente=true` - Pedidos do garçom ID 2 nas últimas 24h

### Quartos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/quartos` | Listar todos os quartos com status e hóspedes ativos |
| `GET` | `/api/quartos/:id` | Buscar quarto por ID |
| `POST` | `/api/quartos` | Criar novo quarto |
| `PUT` | `/api/quartos/:id` | Atualizar dados cadastrais do quarto |
| `DELETE` | `/api/quartos/:id` | Remover quarto (apenas se LIVRE e sem hóspedes ativos) |
| `PATCH` | `/api/quartos/:id/status` | Atualizar status do quarto (governança) |

### Estoque

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/estoque/baixa` | Registrar baixa técnica (perda de estoque) |
| `GET` | `/api/estoque/baixas` | Listar baixas técnicas (query: `?produtoId=1&dataInicio=2025-01-01`) |

### Relatórios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/relatorios/vendas/excel` | Exportar relatório de vendas em Excel (.xlsx) |

### Upload de Arquivos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/upload` | Upload de imagens (fotos de produtos) - máximo 5MB |

**Regras de Upload:**
- Apenas arquivos de imagem são aceitos
- Tamanho máximo: 5MB
- Arquivos são salvos em `/uploads/` e servidos em `/uploads/:filename`
- Retorna URL relativa para uso no campo `foto` do produto

## Socket.io - Eventos em Tempo Real

O sistema utiliza Socket.io para comunicação em tempo real entre o salão e a cozinha. Os seguintes eventos são emitidos automaticamente:

| Evento | Quando é Emitido | Payload |
|--------|------------------|---------|
| `novo_pedido` | Ao criar um novo pedido | Objeto `Pedido` completo com `hospede` e `produto` |
| `pedido_atualizado` | Ao atualizar status do pedido | Objeto `Pedido` atualizado |
| `pedido_cancelado` | Ao cancelar um pedido | Objeto `Pedido` cancelado |

### Exemplo de Conexão (Cliente)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('novo_pedido', (pedido) => {
  console.log('Novo pedido recebido:', pedido);
  // Atualizar interface da cozinha
});

socket.on('pedido_atualizado', (pedido) => {
  console.log('Pedido atualizado:', pedido);
});
```

## Frontend - Painel Administrativo

O sistema utiliza um frontend React (Vite) customizado que é servido estaticamente pelo backend.

Após compilar o frontend (`npm run build` na pasta `web-admin`), os arquivos são automaticamente copiados para `backend/public` e servidos em `http://localhost:3000`.

O painel permite gerenciar todas as entidades do sistema através de uma interface moderna e responsiva.

## Visualizar Banco de Dados

### Opção 1: Prisma Studio (Recomendado)

A forma mais fácil e visual de ver e editar o banco de dados:

```bash
npm run prisma:studio
```

Depois abra no navegador: `http://localhost:5555`

Você terá acesso a:
- ✅ Interface visual com todas as tabelas
- ✅ Dados em formato de tabela
- ✅ Possibilidade de editar, criar e deletar registros
- ✅ Filtros e busca
- ✅ Relacionamentos visíveis

### Opção 2: SQLite CLI (Linha de Comando)

Para usar o SQLite diretamente via terminal:

```bash
# Conectar ao banco
sqlite3 prisma/dev.db

# Comandos úteis dentro do SQLite:
.tables                    # Ver todas as tabelas
.schema Hospede            # Ver estrutura de uma tabela
SELECT * FROM Hospede;     # Ver todos os hóspedes
SELECT * FROM Produto;     # Ver todos os produtos
SELECT * FROM Pedido;      # Ver todos os pedidos
.quit                      # Sair
```

Ou executar comandos direto:

```bash
# Ver todos os hóspedes formatados
sqlite3 -header -column prisma/dev.db "SELECT id, nome, tipo, quarto, dividaAtual FROM Hospede;"

# Contar produtos
sqlite3 prisma/dev.db "SELECT COUNT(*) as total FROM Produto;"
```

### Opção 3: DB Browser for SQLite (Interface Gráfica)

1. Baixe em: https://sqlitebrowser.org/
2. Abra o arquivo: `prisma/dev.db`
3. Navegue pelas tabelas visualmente
4. Execute queries SQL
5. Edite dados diretamente

### Opção 4: Extensão VS Code

Se você usa VS Code, instale a extensão **SQLite Viewer** ou **SQLite**:
1. Abra o arquivo `prisma/dev.db`
2. Visualize as tabelas
3. Execute queries

**Dica**: Para uso diário, recomenda-se o **Prisma Studio** - é a forma mais rápida e visual de gerenciar os dados!

## Estrutura de Pastas

```
pousada-backend/
├── prisma/
│   └── schema.prisma          # Schema do banco de dados
├── src/
│   ├── config/
│   │   └── (removido - usando frontend React)
│   ├── routes/
│   │   ├── pedido.routes.ts   # Rotas de pedidos
│   │   ├── hospede.routes.ts  # Rotas de hóspedes
│   │   ├── produto.routes.ts  # Rotas de produtos
│   │   └── usuario.routes.ts  # Rotas de usuários
│   ├── services/
│   │   ├── pedido.service.ts  # Lógica de negócio de pedidos
│   │   ├── hospede.service.ts # Lógica de negócio de hóspedes
│   │   ├── produto.service.ts # Lógica de negócio de produtos
│   │   └── usuario.service.ts # Lógica de negócio de usuários
│   ├── types/
│   │   └── fastify.d.ts       # Tipos TypeScript customizados
│   └── server.ts              # Arquivo principal do servidor
├── .env.example               # Exemplo de variáveis de ambiente
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| Desenvolvimento | `npm run dev` | Inicia servidor com hot-reload |
| Build | `npm run build` | Compila TypeScript para JavaScript |
| Produção | `npm start` | Executa versão compilada |
| Prisma Generate | `npm run prisma:generate` | Gera cliente Prisma |
| Prisma Migrate | `npm run prisma:migrate` | Cria e aplica migrations |
| Prisma Push | `npm run prisma:push` | Sincroniza schema com banco |
| Prisma Studio | `npm run prisma:studio` | Abre interface visual do banco |
| Frontend Build | `cd ../web-admin && npm run build` | Compila e copia frontend para public |

## Próximos Passos

Após configurar o backend, você pode:

1. **Testar os endpoints** usando ferramentas como Postman, Insomnia ou cURL
2. **Acessar o painel web** em `http://localhost:3000` para gerenciar dados
3. **Integrar com o app mobile** configurando a URL da API no arquivo de configuração
4. **Monitorar logs** para acompanhar requisições e eventos em tempo real

## Suporte e Manutenção

Para adicionar novas funcionalidades, siga o padrão estabelecido:

1. Adicione novos modelos em `prisma/schema.prisma`
2. Execute `npm run prisma:push` para atualizar o banco
3. Crie services em `src/services/` com a lógica de negócio
4. Crie rotas em `src/routes/` consumindo os services
5. Registre as rotas em `src/server.ts`

O sistema foi projetado para ser facilmente extensível e manutenível, seguindo princípios de separação de responsabilidades e código limpo.
