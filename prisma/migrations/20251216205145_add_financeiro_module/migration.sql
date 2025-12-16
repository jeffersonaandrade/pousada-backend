-- CreateTable
CREATE TABLE "CategoriaFinanceira" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "dataVencimento" DATETIME NOT NULL,
    "dataPagamento" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "categoriaId" INTEGER NOT NULL,
    "fornecedor" TEXT,
    "metodoPagamento" TEXT,
    "observacao" TEXT,
    CONSTRAINT "ContaPagar_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContaReceber" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "dataVencimento" DATETIME NOT NULL,
    "dataRecebimento" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "origem" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "observacao" TEXT,
    CONSTRAINT "ContaReceber_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
