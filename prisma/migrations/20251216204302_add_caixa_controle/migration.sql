-- CreateTable
CREATE TABLE "Caixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "dataAbertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFechamento" DATETIME,
    "saldoInicial" REAL NOT NULL,
    "saldoFinalDinheiro" REAL,
    "saldoFinalCartao" REAL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "observacao" TEXT,
    CONSTRAINT "Caixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LancamentoCaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caixaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "observacao" TEXT,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LancamentoCaixa_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
