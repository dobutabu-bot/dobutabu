-- CreateTable
CREATE TABLE "BankImportMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankNameKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "cashAccountId" TEXT,
    "columnsFingerprint" TEXT NOT NULL,
    "detectedColumns" JSONB,
    "columnMapping" JSONB NOT NULL,
    "dateFormat" TEXT,
    "decimalSeparator" TEXT,
    "thousandSeparator" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BankImportMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankImportMapping_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BankImportMapping_userId_bankNameKey_sourceType_columnsFingerprint_key" ON "BankImportMapping"("userId", "bankNameKey", "sourceType", "columnsFingerprint");

-- CreateIndex
CREATE INDEX "BankImportMapping_userId_idx" ON "BankImportMapping"("userId");

-- CreateIndex
CREATE INDEX "BankImportMapping_bankNameKey_idx" ON "BankImportMapping"("bankNameKey");

-- CreateIndex
CREATE INDEX "BankImportMapping_sourceType_idx" ON "BankImportMapping"("sourceType");

-- CreateIndex
CREATE INDEX "BankImportMapping_cashAccountId_idx" ON "BankImportMapping"("cashAccountId");

-- CreateIndex
CREATE INDEX "BankImportMapping_columnsFingerprint_idx" ON "BankImportMapping"("columnsFingerprint");

-- CreateIndex
CREATE INDEX "BankImportMapping_isActive_idx" ON "BankImportMapping"("isActive");

-- CreateIndex
CREATE INDEX "BankImportMapping_lastUsedAt_idx" ON "BankImportMapping"("lastUsedAt");

-- CreateIndex
CREATE INDEX "BankImportMapping_deletedAt_idx" ON "BankImportMapping"("deletedAt");
