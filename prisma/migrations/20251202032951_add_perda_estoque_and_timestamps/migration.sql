-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "dataInicioPreparo" DATETIME;
ALTER TABLE "Pedido" ADD COLUMN "dataPronto" DATETIME;

-- CreateTable
CREATE TABLE "PerdaEstoque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacao" TEXT,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "PerdaEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerdaEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hospede" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'HOSPEDE',
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "quarto" TEXT,
    "uidPulseira" TEXT,
    "limiteGasto" REAL,
    "dividaAtual" REAL NOT NULL DEFAULT 0.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Hospede" ("ativo", "dividaAtual", "documento", "id", "limiteGasto", "nome", "quarto", "tipo", "uidPulseira") SELECT "ativo", "dividaAtual", "documento", "id", "limiteGasto", "nome", "quarto", "tipo", "uidPulseira" FROM "Hospede";
DROP TABLE "Hospede";
ALTER TABLE "new_Hospede" RENAME TO "Hospede";
CREATE UNIQUE INDEX "Hospede_uidPulseira_key" ON "Hospede"("uidPulseira");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
