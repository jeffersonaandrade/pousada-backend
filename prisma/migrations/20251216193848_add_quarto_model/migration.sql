-- CreateTable
CREATE TABLE "Quarto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "andar" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVRE'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hospede" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'HOSPEDE',
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "quarto" TEXT,
    "quartoId" INTEGER,
    "uidPulseira" TEXT,
    "limiteGasto" REAL,
    "dividaAtual" REAL NOT NULL DEFAULT 0.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "origem" TEXT NOT NULL DEFAULT 'BALCAO',
    "dataCheckout" DATETIME,
    CONSTRAINT "Hospede_quartoId_fkey" FOREIGN KEY ("quartoId") REFERENCES "Quarto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hospede" ("ativo", "dataCheckout", "dividaAtual", "documento", "email", "id", "limiteGasto", "nome", "origem", "quarto", "telefone", "tipo", "uidPulseira") SELECT "ativo", "dataCheckout", "dividaAtual", "documento", "email", "id", "limiteGasto", "nome", "origem", "quarto", "telefone", "tipo", "uidPulseira" FROM "Hospede";
DROP TABLE "Hospede";
ALTER TABLE "new_Hospede" RENAME TO "Hospede";
CREATE UNIQUE INDEX "Hospede_uidPulseira_key" ON "Hospede"("uidPulseira");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Quarto_numero_key" ON "Quarto"("numero");
