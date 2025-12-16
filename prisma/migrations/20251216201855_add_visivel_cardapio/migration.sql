-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "foto" TEXT,
    "categoria" TEXT,
    "descricao" TEXT,
    "setor" TEXT NOT NULL DEFAULT 'COZINHA',
    "visivelCardapio" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Produto" ("categoria", "descricao", "estoque", "foto", "id", "nome", "preco", "setor") SELECT "categoria", "descricao", "estoque", "foto", "id", "nome", "preco", "setor" FROM "Produto";
DROP TABLE "Produto";
ALTER TABLE "new_Produto" RENAME TO "Produto";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
