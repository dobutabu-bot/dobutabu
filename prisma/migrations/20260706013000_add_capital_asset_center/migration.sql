-- CreateTable
CREATE TABLE "AssetAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "currency" TEXT,
    "symbol" TEXT,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "manualTotalValue" DECIMAL,
    "valuationCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "linkedCashAccountId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AssetAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetAccount_linkedCashAccountId_fkey" FOREIGN KEY ("linkedCashAccountId") REFERENCES "CashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetValuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetAccountId" TEXT NOT NULL,
    "valuationDate" DATETIME NOT NULL,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "totalValue" DECIMAL NOT NULL,
    "valuationCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetValuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetValuation_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "AssetAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetAccountId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "totalAmount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT,
    "linkedCashLedgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AssetTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetTransaction_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "AssetAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetTransaction_linkedCashLedgerEntryId_fkey" FOREIGN KEY ("linkedCashLedgerEntryId") REFERENCES "CashLedgerEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapitalSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "totalAssets" DECIMAL NOT NULL,
    "totalDebts" DECIMAL NOT NULL,
    "netWorth" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "breakdown" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapitalSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetAccount_userId_idx" ON "AssetAccount"("userId");

-- CreateIndex
CREATE INDEX "AssetAccount_assetType_idx" ON "AssetAccount"("assetType");

-- CreateIndex
CREATE INDEX "AssetAccount_symbol_idx" ON "AssetAccount"("symbol");

-- CreateIndex
CREATE INDEX "AssetAccount_valuationCurrency_idx" ON "AssetAccount"("valuationCurrency");

-- CreateIndex
CREATE INDEX "AssetAccount_linkedCashAccountId_idx" ON "AssetAccount"("linkedCashAccountId");

-- CreateIndex
CREATE INDEX "AssetAccount_isActive_idx" ON "AssetAccount"("isActive");

-- CreateIndex
CREATE INDEX "AssetAccount_deletedAt_idx" ON "AssetAccount"("deletedAt");

-- CreateIndex
CREATE INDEX "AssetValuation_userId_idx" ON "AssetValuation"("userId");

-- CreateIndex
CREATE INDEX "AssetValuation_assetAccountId_idx" ON "AssetValuation"("assetAccountId");

-- CreateIndex
CREATE INDEX "AssetValuation_valuationDate_idx" ON "AssetValuation"("valuationDate");

-- CreateIndex
CREATE INDEX "AssetValuation_valuationCurrency_idx" ON "AssetValuation"("valuationCurrency");

-- CreateIndex
CREATE INDEX "AssetValuation_source_idx" ON "AssetValuation"("source");

-- CreateIndex
CREATE INDEX "AssetTransaction_userId_idx" ON "AssetTransaction"("userId");

-- CreateIndex
CREATE INDEX "AssetTransaction_assetAccountId_idx" ON "AssetTransaction"("assetAccountId");

-- CreateIndex
CREATE INDEX "AssetTransaction_transactionType_idx" ON "AssetTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "AssetTransaction_date_idx" ON "AssetTransaction"("date");

-- CreateIndex
CREATE INDEX "AssetTransaction_currency_idx" ON "AssetTransaction"("currency");

-- CreateIndex
CREATE INDEX "AssetTransaction_linkedCashLedgerEntryId_idx" ON "AssetTransaction"("linkedCashLedgerEntryId");

-- CreateIndex
CREATE INDEX "AssetTransaction_deletedAt_idx" ON "AssetTransaction"("deletedAt");

-- CreateIndex
CREATE INDEX "CapitalSnapshot_userId_idx" ON "CapitalSnapshot"("userId");

-- CreateIndex
CREATE INDEX "CapitalSnapshot_snapshotDate_idx" ON "CapitalSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "CapitalSnapshot_currency_idx" ON "CapitalSnapshot"("currency");
