-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "cargo" TEXT NOT NULL DEFAULT 'WAITER',
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Hospede" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'HOSPEDE',
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "quarto" TEXT,
    "uidPulseira" TEXT NOT NULL,
    "limiteGasto" REAL,
    "dividaAtual" REAL NOT NULL DEFAULT 0.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "foto" TEXT,
    "categoria" TEXT
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hospedeId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valor" REAL NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_hospedeId_fkey" FOREIGN KEY ("hospedeId") REFERENCES "Hospede" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_pin_key" ON "Usuario"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Hospede_uidPulseira_key" ON "Hospede"("uidPulseira");
