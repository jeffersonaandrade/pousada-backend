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
    "uidPulseira" TEXT,
    "limiteGasto" REAL,
    "dividaAtual" REAL NOT NULL DEFAULT 0.0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "origem" TEXT NOT NULL DEFAULT 'BALCAO',
    "dataCheckout" DATETIME
);
INSERT INTO "new_Hospede" ("ativo", "dividaAtual", "documento", "id", "limiteGasto", "nome", "quarto", "tipo", "uidPulseira") SELECT "ativo", "dividaAtual", "documento", "id", "limiteGasto", "nome", "quarto", "tipo", "uidPulseira" FROM "Hospede";
DROP TABLE "Hospede";
ALTER TABLE "new_Hospede" RENAME TO "Hospede";
CREATE UNIQUE INDEX "Hospede_uidPulseira_key" ON "Hospede"("uidPulseira");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
