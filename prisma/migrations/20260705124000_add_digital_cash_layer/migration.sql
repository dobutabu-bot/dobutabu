-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CASH',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CashAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "referenceNo" TEXT,
    "incomeId" TEXT,
    "expenseId" TEXT,
    "invoiceOrReceiptId" TEXT,
    "clientId" TEXT,
    "caseFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CashLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_invoiceOrReceiptId_fkey" FOREIGN KEY ("invoiceOrReceiptId") REFERENCES "InvoiceOrReceipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CashTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "CashAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "balance" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceSnapshot_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Income" ADD COLUMN "cashAccountId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "cashAccountId" TEXT;

-- CreateIndex
CREATE INDEX "CashAccount_userId_idx" ON "CashAccount"("userId");

-- CreateIndex
CREATE INDEX "CashAccount_type_idx" ON "CashAccount"("type");

-- CreateIndex
CREATE INDEX "CashAccount_isDefault_idx" ON "CashAccount"("isDefault");

-- CreateIndex
CREATE INDEX "CashAccount_isActive_idx" ON "CashAccount"("isActive");

-- CreateIndex
CREATE INDEX "CashAccount_deletedAt_idx" ON "CashAccount"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedgerEntry_incomeId_key" ON "CashLedgerEntry"("incomeId");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedgerEntry_expenseId_key" ON "CashLedgerEntry"("expenseId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_userId_idx" ON "CashLedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_cashAccountId_idx" ON "CashLedgerEntry"("cashAccountId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_direction_idx" ON "CashLedgerEntry"("direction");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_entryType_idx" ON "CashLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_date_idx" ON "CashLedgerEntry"("date");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_invoiceOrReceiptId_idx" ON "CashLedgerEntry"("invoiceOrReceiptId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_clientId_idx" ON "CashLedgerEntry"("clientId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_caseFileId_idx" ON "CashLedgerEntry"("caseFileId");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_deletedAt_idx" ON "CashLedgerEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "CashTransfer_userId_idx" ON "CashTransfer"("userId");

-- CreateIndex
CREATE INDEX "CashTransfer_fromAccountId_idx" ON "CashTransfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "CashTransfer_toAccountId_idx" ON "CashTransfer"("toAccountId");

-- CreateIndex
CREATE INDEX "CashTransfer_date_idx" ON "CashTransfer"("date");

-- CreateIndex
CREATE INDEX "CashTransfer_deletedAt_idx" ON "CashTransfer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSnapshot_cashAccountId_date_key" ON "BalanceSnapshot"("cashAccountId", "date");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_userId_idx" ON "BalanceSnapshot"("userId");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_cashAccountId_idx" ON "BalanceSnapshot"("cashAccountId");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_date_idx" ON "BalanceSnapshot"("date");

-- CreateIndex
CREATE INDEX "Income_cashAccountId_idx" ON "Income"("cashAccountId");

-- CreateIndex
CREATE INDEX "Expense_cashAccountId_idx" ON "Expense"("cashAccountId");

-- Backfill default cash account per user.
INSERT INTO "CashAccount" (
    "id",
    "userId",
    "name",
    "type",
    "currency",
    "openingBalance",
    "description",
    "color",
    "icon",
    "isDefault",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'cash-account-main-' || "User"."id",
    "User"."id",
    'Ana Kasa',
    'CASH',
    'TRY',
    0,
    'V2 dijital kasa varsayılan hesabı',
    '#16a34a',
    'wallet',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL
FROM "User"
WHERE NOT EXISTS (
    SELECT 1
    FROM "CashAccount"
    WHERE "CashAccount"."userId" = "User"."id"
      AND "CashAccount"."name" = 'Ana Kasa'
      AND "CashAccount"."deletedAt" IS NULL
);

-- Link existing income and expense rows to the default cash account.
UPDATE "Income"
SET "cashAccountId" = (
    SELECT "CashAccount"."id"
    FROM "CashAccount"
    WHERE "CashAccount"."userId" = "Income"."userId"
      AND "CashAccount"."isDefault" = true
      AND "CashAccount"."deletedAt" IS NULL
    ORDER BY "CashAccount"."createdAt" ASC
    LIMIT 1
)
WHERE "cashAccountId" IS NULL;

UPDATE "Expense"
SET "cashAccountId" = (
    SELECT "CashAccount"."id"
    FROM "CashAccount"
    WHERE "CashAccount"."userId" = "Expense"."userId"
      AND "CashAccount"."isDefault" = true
      AND "CashAccount"."deletedAt" IS NULL
    ORDER BY "CashAccount"."createdAt" ASC
    LIMIT 1
)
WHERE "cashAccountId" IS NULL;

-- Backfill income ledger entries without duplicates.
INSERT INTO "CashLedgerEntry" (
    "id",
    "userId",
    "cashAccountId",
    "direction",
    "entryType",
    "amount",
    "currency",
    "date",
    "description",
    "referenceNo",
    "incomeId",
    "expenseId",
    "invoiceOrReceiptId",
    "clientId",
    "caseFileId",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'cash-ledger-income-' || "Income"."id",
    "Income"."userId",
    "Income"."cashAccountId",
    'IN',
    'INCOME',
    "Income"."amount",
    "Income"."currency",
    "Income"."date",
    "Income"."description",
    "Income"."receiptNumber",
    "Income"."id",
    NULL,
    NULL,
    "Income"."clientId",
    "Income"."caseFileId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "Income"."deletedAt"
FROM "Income"
WHERE "Income"."cashAccountId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "CashLedgerEntry"
      WHERE "CashLedgerEntry"."incomeId" = "Income"."id"
  );

-- Backfill expense ledger entries without duplicates.
INSERT INTO "CashLedgerEntry" (
    "id",
    "userId",
    "cashAccountId",
    "direction",
    "entryType",
    "amount",
    "currency",
    "date",
    "description",
    "referenceNo",
    "incomeId",
    "expenseId",
    "invoiceOrReceiptId",
    "clientId",
    "caseFileId",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    'cash-ledger-expense-' || "Expense"."id",
    "Expense"."userId",
    "Expense"."cashAccountId",
    'OUT',
    'EXPENSE',
    "Expense"."amount",
    "Expense"."currency",
    "Expense"."date",
    "Expense"."description",
    NULL,
    NULL,
    "Expense"."id",
    NULL,
    "Expense"."clientId",
    "Expense"."caseFileId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "Expense"."deletedAt"
FROM "Expense"
WHERE "Expense"."cashAccountId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "CashLedgerEntry"
      WHERE "CashLedgerEntry"."expenseId" = "Expense"."id"
  );
