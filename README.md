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
- **node-cron** para agendamento automático de tarefas (backup)
- **ExcelJS** para geração de relatórios em Excel

## Arquitetura do Sistema

O sistema implementa uma arquitetura em camadas bem definida, separando responsabilidades entre **rotas**, **services** e **modelos de dados**. As regras de negócio críticas são implementadas nos services, garantindo atomicidade e consistência das operações através de transações do Prisma.

### Modelo de Dados

O banco de dados é estruturado com as seguintes entidades principais:

| Entidade | Descrição | Campos Principais |
|----------|-----------|-------------------|
| **Usuario** | Garçons e funcionários do sistema | `nome`, `pin` (4 dígitos), `cargo` (WAITER/MANAGER/ADMIN/CLEANER), `ativo` |
| **Quarto** | Quartos da pousada | `numero` (único), `andar`, `categoria`, `status` (LIVRE/OCUPADO/LIMPEZA/MANUTENCAO) |
| **Hospede** | Clientes da pousada ou day use | `tipo` (HOSPEDE/DAY_USE/VIP), `nome`, `documento`, `telefone`, `email`, `quartoId`, `uidPulseira` (único), `limiteGasto`, `dividaAtual`, `ativo`, `origem` (BALCAO/SITE), `dataCheckout` |
| **Produto** | Itens do cardápio | `nome`, `preco`, `estoque`, `foto`, `categoria`, `descricao`, `setor` (COZINHA/BAR_PISCINA/BOATE), `visivelCardapio` |
| **Pedido** | Pedidos realizados | `hospedeId`, `produtoId`, `status` (PENDENTE/PREPARANDO/PRONTO/ENTREGUE/CANCELADO), `valor`, `data`, `metodoCriacao` (NFC/MANUAL), `dataInicioPreparo`, `dataPronto`, `usuarioId` (garçom que criou), `gerenteId` (gerente que autorizou pedido manual) |
| **Pagamento** | Histórico de pagamentos | `hospedeId`, `valor`, `metodo` (PIX/DINHEIRO/CARTAO/DEBITO), `data` |
| **PerdaEstoque** | Baixas técnicas de estoque | `produtoId`, `quantidade`, `motivo`, `observacao`, `usuarioId`, `data` |
| **Caixa** | Controle de caixa físico | `usuarioId`, `dataAbertura`, `dataFechamento`, `saldoInicial`, `saldoFinalDinheiro`, `saldoFinalCartao`, `status` (ABERTO/FECHADO), `observacao` |
| **LancamentoCaixa** | Movimentações do caixa | `caixaId`, `tipo` (VENDA/SANGRIA/SUPRIMENTO), `valor`, `observacao`, `data` |
| **CategoriaFinanceira** | Categorias de despesas/receitas | `nome`, `tipo` (DESPESA/RECEITA) |
| **ContaPagar** | Contas a pagar | `descricao`, `valor`, `dataVencimento`, `dataPagamento`, `status` (PENDENTE/PAGO/ATRASADO), `categoriaId`, `fornecedor`, `metodoPagamento`, `observacao` |
| **ContaReceber** | Contas a receber | `descricao`, `valor`, `dataVencimento`, `dataRecebimento`, `status` (PENDENTE/RECEBIDO/ATRASADO), `origem` (HOSPEDE/CARTAO_CREDITO/OUTROS), `categoriaId`, `observacao` |

### Regras de Negócio Implementadas

O sistema implementa regras de negócio críticas que garantem a integridade operacional e a consistência dos dados. Todas as operações críticas são executadas dentro de transações do Prisma para garantir atomicidade.

#### 📋 **Módulo: Hóspedes (Check-in/Check-out)**

**1. Validações de Check-in:**
- **Day Use**: Documento é obrigatório para clientes do tipo `DAY_USE`
- **Hóspede**: Quarto é obrigatório para clientes do tipo `HOSPEDE`
- **Pagamento na Entrada**: Se `pagoNaEntrada = true`, o campo `metodoPagamento` é obrigatório
- **Validação de Pulseira NFC**:
  - **Reutilização Controlada**: As pulseiras NFC são ativos reutilizáveis, mas não podem ser atribuídas a dois hóspedes ativos simultaneamente
  - **Verificação Automática**: Antes de criar um novo hóspede, o sistema verifica se a pulseira informada (`uidPulseira`) já está em uso por um hóspede ativo
  - **Comportamento**:
    - Se a pulseira estiver em uso: Retorna erro 409 (Conflict) com mensagem: "Esta pulseira está em uso por outro hóspede ativo. Realize o checkout dele primeiro."
    - Se a pulseira estiver livre: Permite o cadastro normalmente
  - **Aplicação**: A mesma regra vale para `HOSPEDE` e `DAY_USE`
  - **Objetivo**: Garantir a rotatividade das pulseiras com segurança, impedindo conflitos de consumo entre hóspedes
- **Quarto Disponível**: 
  - Permite check-in em quartos com status `LIVRE` ou `OCUPADO` (múltiplos hóspedes permitidos)
  - Bloqueia check-in em quartos com status `MANUTENCAO` ou `LIMPEZA`
- **Ocupação Automática**: 
  - Se o quarto está `LIVRE`: Muda automaticamente para `OCUPADO` no primeiro check-in
  - Se o quarto já está `OCUPADO`: Permanece `OCUPADO` (permite adicionar acompanhantes)

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
- **Checkout Condicional (Múltiplos Hóspedes)**:
  - **Verificação de Hóspedes Restantes**: Antes de atualizar o status do quarto, o sistema verifica quantos hóspedes ainda estão ativos (`ativo = true`) no mesmo `quartoId`, excluindo o hóspede que está fazendo checkout
  - **Lógica Condicional do Quarto**:
    - Se `hospedesRestantes > 0`: Mantém o quarto como `OCUPADO` (não altera status)
      - Mensagem: "Checkout realizado. Quarto permanece ocupado por X hóspede(s)."
      - Objetivo: Impedir que a equipe de limpeza entre no quarto enquanto ainda houver acompanhantes ativos
    - Se `hospedesRestantes === 0`: Atualiza o quarto para `LIMPEZA` (último hóspede do quarto)
      - Mensagem: "Checkout total realizado. Quarto liberado para limpeza."
      - Objetivo: Sinalizar que o quarto está livre e pronto para limpeza
  - **Day Use**: Hóspedes sem quarto vinculado não alteram status de quarto (apenas desativam o hóspede)
  - **Resposta da API**: Inclui informações sobre o quarto:
    ```json
    {
      "quarto": {
        "hospedesRestantes": 1,
        "status": "OCUPADO"
      }
    }
    ```
  - **Exemplos Práticos**:
    - **Caso 1 - Casal no Quarto 101**: 
      - João (ID: 1) e Maria (ID: 2) estão no quarto 101
      - João faz checkout → Quarto permanece `OCUPADO` (Maria ainda está ativa)
      - Maria faz checkout → Quarto muda para `LIMPEZA` (último hóspede)
    - **Caso 2 - Família no Quarto 201**:
      - Pai (ID: 3), Mãe (ID: 4) e Filho (ID: 5) estão no quarto 201
      - Pai faz checkout → Quarto permanece `OCUPADO` (2 hóspedes restantes)
      - Mãe faz checkout → Quarto permanece `OCUPADO` (1 hóspede restante)
      - Filho faz checkout → Quarto muda para `LIMPEZA` (último hóspede)
    - **Caso 3 - Day Use**:
      - Cliente Day Use (sem quarto) faz checkout → Apenas desativa o hóspede (não afeta quartos)

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
- **OCUPADO**: Hóspede(s) ativo(s) no quarto (mudado automaticamente no check-in)
- **LIMPEZA**: Após checkout do último hóspede, aguardando limpeza (mudado automaticamente apenas quando todos os hóspedes fizerem checkout)
- **MANUTENCAO**: Quarto em manutenção (definido manualmente)

**2. Validações de Check-in:**
- **Múltiplos Hóspedes Permitidos**: O sistema permite que múltiplos hóspedes (acompanhantes) sejam vinculados ao mesmo quarto
- **Status do Quarto**:
  - Quartos `LIVRE` ou `OCUPADO` podem receber novos hóspedes
  - Quartos em `MANUTENCAO` ou `LIMPEZA` são bloqueados para check-in
- **Atualização de Status**:
  - Se o quarto está `LIVRE`: Muda automaticamente para `OCUPADO` no primeiro check-in
  - Se o quarto já está `OCUPADO`: Permanece `OCUPADO` (permite adicionar acompanhantes)
- **Exemplo**: É possível cadastrar "João" no quarto 202 e, em seguida, cadastrar "Maria" também no quarto 202, sem erro

**3. Transições de Status:**
- **LIVRE** → Pode mudar para: `OCUPADO`, `LIMPEZA`, `MANUTENCAO`
- **OCUPADO** → Pode mudar para: `LIMPEZA`, `MANUTENCAO` (não pode ir direto para `LIVRE`)
- **LIMPEZA** → Pode mudar para: `LIVRE` (após limpeza concluída)
- **MANUTENCAO** → Pode mudar para: `LIVRE` (após manutenção concluída)
- **Bloqueio**: Não permite mudar status de quarto `OCUPADO` com hóspede ativo (exceto via checkout)

**4. Checkout Condicional (Múltiplos Hóspedes):**
- **Proteção para Quartos Compartilhados**: O sistema suporta quartos com múltiplos hóspedes (casais/famílias)
- **Lógica de Liberação**:
  - Ao realizar checkout de um hóspede, o sistema verifica quantos hóspedes ainda estão ativos no mesmo quarto
  - Se ainda houver hóspedes ativos: O quarto permanece `OCUPADO` (não muda para `LIMPEZA`)
  - Se for o último hóspede: O quarto muda automaticamente para `LIMPEZA`
- **Objetivo**: Impedir que a equipe de limpeza entre no quarto enquanto ainda houver acompanhantes ativos
- **Mensagens Informativas**: A API retorna informações sobre o status do quarto e quantos hóspedes restam
- **Day Use**: Hóspedes sem quarto vinculado não afetam o status do quarto
- **Exemplos Práticos**:
  - **Cenário 1**: Casal no Quarto 101 - João faz checkout primeiro → Quarto permanece `OCUPADO` → Maria faz checkout → Quarto muda para `LIMPEZA`
  - **Cenário 2**: Família no Quarto 201 - Pai e Mãe fazem checkout → Quarto permanece `OCUPADO` → Filho faz checkout → Quarto muda para `LIMPEZA`
  - **Cenário 3**: Hóspede único no Quarto 301 - Faz checkout → Quarto muda diretamente para `LIMPEZA`

**5. Exclusão de Quartos:**
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
- **CLEANER**: Camareira / Governança - pode visualizar e alterar status de quartos (perfil restrito para equipe de limpeza)

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

#### 💵 **Módulo: Caixa (Controle de Dinheiro Físico)**

**1. Abertura de Caixa:**
- Um usuário só pode ter um caixa aberto por vez
- Requer `saldoInicial` (fundo de troco)
- Status inicial: `ABERTO`
- Data/hora de abertura registrada

**2. Movimentações:**
- **Vendas em Dinheiro**: Registradas automaticamente quando pagamento em `DINHEIRO` é realizado no checkout
- **Sangrias**: Retirada de dinheiro do caixa (valida saldo suficiente)
- **Suprimentos**: Adição de dinheiro ao caixa (ex: troco adicional)

**3. Fechamento de Caixa:**
- Requer `saldoFinalDinheiro` (valor contado fisicamente)
- Calcula automaticamente a **quebra de caixa** (diferença entre esperado e contado)
- Saldo esperado = `saldoInicial + vendas - sangrias + suprimentos`
- Quebra = `saldoFinalDinheiro - saldoEsperado`
- Status muda para `FECHADO`
- Data/hora de fechamento registrada

**4. Integração com Pagamentos:**
- Pagamentos em `DINHEIRO` no checkout criam automaticamente `LancamentoCaixa` do tipo `VENDA`
- Pagamentos de contas a pagar em `DINHEIRO` criam automaticamente `LancamentoCaixa` do tipo `SANGRIA`

#### 💰 **Módulo: Financeiro (Contas a Pagar/Receber)**

**1. Categorias Financeiras:**
- Categorias do tipo `DESPESA` para contas a pagar
- Categorias do tipo `RECEITA` para contas a receber
- Categorias padrão criadas no seed: Aluguel, Energia/Água, Internet, Fornecedores Bebida, Manutenção, Salários, Hospedagem, Day Use, Vendas
- Não permite remover categoria com contas vinculadas

**2. Contas a Pagar:**
- Status automático baseado em data de vencimento:
  - `PENDENTE`: Vencimento futuro
  - `ATRASADO`: Vencimento passado
  - `PAGO`: Conta paga (após dar baixa)
- **Baixa de Conta (Pagar)**:
  - Requer `metodoPagamento` (PIX, DINHEIRO, CARTAO, DEBITO)
  - Se `metodoPagamento === 'DINHEIRO'` e houver `usuarioId`, registra sangria no caixa automaticamente
  - Atualiza `dataPagamento` e `status = PAGO`
- Não permite editar/remover contas já pagas

**3. Contas a Receber:**
- Status automático baseado em data de vencimento:
  - `PENDENTE`: Vencimento futuro
  - `ATRASADO`: Vencimento passado
  - `RECEBIDO`: Conta recebida (após dar baixa)
- **Baixa de Conta (Receber)**:
  - Atualiza `dataRecebimento` e `status = RECEBIDO`
- Não permite editar/remover contas já recebidas

**4. Dashboard Financeiro:**
- Retorna totais de contas a pagar/receber agrupados por:
  - **Vencidas**: Contas com vencimento passado
  - **Hoje**: Contas que vencem hoje
  - **Futuras**: Contas com vencimento futuro
- Útil para planejamento financeiro e DRE (Demonstrativo de Resultados)

#### 🔄 **Módulo: Backup Automatizado**

**1. Sistema de Backup:**
- Backup automático a cada hora (na hora cheia) usando `node-cron`
- Backup manual disponível via comando `npm run backup`
- Cópia segura do banco SQLite para pasta do OneDrive

**2. Configuração:**
- **Pasta de Destino**: `C:/Users/[user]/OneDrive/Backups_CondeFlow` (padrão)
- **Variável de Ambiente**: `BACKUP_DIR` para personalizar destino
- **Retenção**: 7 dias (configurável via `BACKUP_RETENTION_DAYS`)
- Nome do arquivo: `backup-YYYY-MM-DD-HH-mm.db`

**3. Rotação Automática:**
- Remove automaticamente backups com mais de 7 dias
- Evita acúmulo de arquivos no OneDrive
- Logs informativos sobre backups removidos

**4. Integração:**
- Inicia automaticamente quando o servidor sobe
- Não requer configuração externa (Windows Task Scheduler)
- Logs identificados com `[Cron]` para fácil identificação

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
Após executar as migrations, execute o seed para criar os usuários de teste:

```bash
npx tsx prisma/seed.ts
```

Isso criará os seguintes usuários de teste:
- **Administrador** (PIN: 0000) - Cargo: ADMIN
- **João Garçom** (PIN: 1234) - Cargo: WAITER
- **Soares Gerente** (PIN: 5678) - Cargo: MANAGER
- **Maria Limpeza** (PIN: 9999) - Cargo: CLEANER

⚠️ **IMPORTANTE:** Altere os PINs após o primeiro login usando a tela de Equipe no painel administrativo.

**Alternativa (Criar apenas Admin):**
Se preferir criar apenas o administrador:

```bash
npm run criar:admin
```

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

### Caixa

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/caixa/abrir` | Abrir caixa (requer autenticação) - recebe `saldoInicial` |
| `POST` | `/api/caixa/fechar` | Fechar caixa (requer autenticação) - recebe `saldoFinalDinheiro`, `saldoFinalCartao` (opcional) |
| `GET` | `/api/caixa/status` | Status do caixa aberto (autenticação opcional) - retorna resumo com saldo atual |
| `POST` | `/api/caixa/sangria` | Registrar sangria (retirar dinheiro) - recebe `valor`, `observacao` (opcional) |
| `POST` | `/api/caixa/suprimento` | Registrar suprimento (adicionar dinheiro) - recebe `valor`, `observacao` (opcional) |

**Regras de Caixa:**
- Um usuário só pode ter um caixa aberto por vez
- Sangrias validam saldo suficiente antes de permitir
- Fechamento calcula quebra de caixa automaticamente
- Vendas em dinheiro são registradas automaticamente no caixa aberto

### Financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/financeiro/dashboard` | Dashboard financeiro (totais de contas a pagar/receber) |
| `GET` | `/api/financeiro/categorias` | Listar categorias (query: `?tipo=DESPESA`) |
| `POST` | `/api/financeiro/categorias` | Criar categoria |
| `PATCH` | `/api/financeiro/categorias/:id` | Atualizar categoria |
| `DELETE` | `/api/financeiro/categorias/:id` | Remover categoria (bloqueado se houver contas vinculadas) |
| `GET` | `/api/financeiro/contas-pagar` | Listar contas a pagar (query: `?status=PENDENTE&categoriaId=1`) |
| `POST` | `/api/financeiro/contas-pagar` | Criar conta a pagar |
| `PATCH` | `/api/financeiro/contas-pagar/:id` | Atualizar conta a pagar |
| `DELETE` | `/api/financeiro/contas-pagar/:id` | Remover conta a pagar (bloqueado se já paga) |
| `POST` | `/api/financeiro/contas-pagar/:id/pagar` | Dar baixa (pagar conta) - recebe `metodoPagamento` |
| `GET` | `/api/financeiro/contas-receber` | Listar contas a receber (query: `?status=PENDENTE&origem=HOSPEDE`) |
| `POST` | `/api/financeiro/contas-receber` | Criar conta a receber |
| `PATCH` | `/api/financeiro/contas-receber/:id` | Atualizar conta a receber |
| `DELETE` | `/api/financeiro/contas-receber/:id` | Remover conta a receber (bloqueado se já recebida) |
| `POST` | `/api/financeiro/contas-receber/:id/receber` | Dar baixa (receber conta) |

**Regras Financeiras:**
- Status de contas é calculado automaticamente baseado em data de vencimento
- Pagamento de conta em dinheiro registra sangria no caixa automaticamente
- Categorias não podem ser removidas se houver contas vinculadas
- Contas pagas/recebidas não podem ser editadas ou removidas

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

### Telas Disponíveis

O painel administrativo inclui as seguintes telas:

- **Dashboard**: Visão geral do sistema com estatísticas
- **Recepção**: Gestão de check-in/check-out de hóspedes
- **Quartos**: Gestão de quartos e status (LIVRE, OCUPADO, LIMPEZA, MANUTENCAO)
- **Cardápio**: Gestão de produtos do cardápio
- **Estoque**: Controle de estoque e baixas técnicas
- **Caixa**: Controle de caixa físico (abertura, fechamento, sangrias, suprimentos)
- **Financeiro**: Gestão de contas a pagar/receber e categorias financeiras
- **Equipe**: Gestão de usuários (garçons, gerentes, administradores)
- **Relatórios**: Exportação de relatórios em Excel
- **Cozinha (KDS)**: Tela dedicada para exibição de pedidos na cozinha

### Funcionalidades do Frontend

**Tela de Caixa:**
- Abertura de caixa com fundo de troco inicial
- Dashboard em tempo real com saldo atual calculado
- Registro de sangrias e suprimentos
- Fechamento de caixa com cálculo automático de quebra
- Resumo detalhado do fechamento

**Tela de Financeiro:**
- Abas: A Pagar | A Receber | Categorias
- Cards de resumo: Vencidas, Vencem Hoje, A Vencer
- Cadastro de despesas e receitas
- Dar baixa em contas (pagar/receber)
- Integração automática com caixa ao pagar em dinheiro
- Dashboard financeiro com totais consolidados

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
│   │   ├── pedido.routes.ts      # Rotas de pedidos
│   │   ├── hospede.routes.ts      # Rotas de hóspedes
│   │   ├── produto.routes.ts      # Rotas de produtos
│   │   ├── usuario.routes.ts      # Rotas de usuários
│   │   ├── quarto.routes.ts       # Rotas de quartos
│   │   ├── estoque.routes.ts      # Rotas de estoque
│   │   ├── relatorio.routes.ts    # Rotas de relatórios
│   │   ├── upload.routes.ts       # Rotas de upload
│   │   ├── caixa.routes.ts        # Rotas de caixa
│   │   └── financeiro.routes.ts   # Rotas de financeiro
│   ├── services/
│   │   ├── pedido.service.ts     # Lógica de negócio de pedidos
│   │   ├── hospede.service.ts    # Lógica de negócio de hóspedes
│   │   ├── produto.service.ts    # Lógica de negócio de produtos
│   │   ├── usuario.service.ts    # Lógica de negócio de usuários
│   │   ├── quarto.service.ts     # Lógica de negócio de quartos
│   │   ├── estoque.service.ts    # Lógica de negócio de estoque
│   │   ├── relatorio.service.ts  # Lógica de relatórios
│   │   ├── caixa.service.ts      # Lógica de controle de caixa
│   │   ├── financeiro.service.ts # Lógica de contas a pagar/receber
│   │   ├── backup.service.ts     # Lógica de backup do banco
│   │   └── cron.service.ts        # Gerenciamento de agendamentos
│   ├── types/
│   │   └── fastify.d.ts       # Tipos TypeScript customizados
│   └── server.ts              # Arquivo principal do servidor
├── scripts/
│   ├── backup.ts              # Script manual de backup
│   ├── seed-produtos.ts       # Seed de produtos
│   └── criar-admin.ts         # Script para criar admin
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
| Prisma Seed | `npm run prisma:seed` | Executa seed (quartos e categorias financeiras) |
| Seed Produtos | `npm run seed:produtos` | Popula produtos iniciais |
| Criar Admin | `npm run criar:admin` | Cria usuário administrador padrão |
| Backup Manual | `npm run backup` | Executa backup manual do banco de dados |
| Frontend Build | `cd ../web-admin && npm run build` | Compila e copia frontend para public |

## Sistema de Backup Automatizado

O sistema possui backup automatizado integrado que executa a cada hora automaticamente quando o servidor está rodando.

### Funcionamento

- **Agendamento**: Backup executado automaticamente a cada hora (na hora cheia) usando `node-cron`
- **Destino**: Pasta do OneDrive (padrão: `C:/Users/[user]/OneDrive/Backups_CondeFlow`)
- **Rotação**: Remove automaticamente backups com mais de 7 dias
- **Logs**: Logs identificados com `[Cron]` no console do servidor

### Configuração

**Variáveis de Ambiente (opcional):**
- `BACKUP_DIR`: Define pasta de destino personalizada
- `BACKUP_RETENTION_DAYS`: Define dias de retenção (padrão: 7)

**Exemplo de uso:**
```bash
# Definir pasta personalizada
export BACKUP_DIR="D:/Backups/Pousada"

# Definir retenção de 30 dias
export BACKUP_RETENTION_DAYS=30
```

### Backup Manual

Para executar backup manualmente:

```bash
npm run backup
```

### Logs de Backup

Quando o backup automático é executado, você verá logs como:

```
⏰ [Cron] Executando backup agendado...
✅ [Cron] Backup realizado: C:\Users\...\backup-2025-12-16-14-00.db
🗑️  [Cron] Backups antigos removidos: 2
```

## Próximos Passos

Após configurar o backend, você pode:

1. **Testar os endpoints** usando ferramentas como Postman, Insomnia ou cURL
2. **Acessar o painel web** em `http://localhost:3000` para gerenciar dados
3. **Integrar com o app mobile** configurando a URL da API no arquivo de configuração
4. **Monitorar logs** para acompanhar requisições e eventos em tempo real
5. **Abrir caixa** na tela de Caixa para iniciar controle de dinheiro físico
6. **Cadastrar contas a pagar** na tela de Financeiro para gestão financeira completa

## Suporte e Manutenção

Para adicionar novas funcionalidades, siga o padrão estabelecido:

1. Adicione novos modelos em `prisma/schema.prisma`
2. Execute `npm run prisma:push` para atualizar o banco
3. Crie services em `src/services/` com a lógica de negócio
4. Crie rotas em `src/routes/` consumindo os services
5. Registre as rotas em `src/server.ts`

O sistema foi projetado para ser facilmente extensível e manutenível, seguindo princípios de separação de responsabilidades e código limpo.
