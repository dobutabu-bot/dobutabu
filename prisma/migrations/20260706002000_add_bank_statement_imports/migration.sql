-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "cashAccountId" TEXT,
    "bankName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "detectedColumns" JSONB,
    "columnMapping" JSONB,
    "dateFormat" TEXT,
    "decimalSeparator" TEXT,
    "thousandSeparator" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL,
    "closingBalance" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BankStatementImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankStatementImport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementImport_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankStatementRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "cashAccountId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "transactionDate" DATETIME,
    "description" TEXT NOT NULL,
    "debitAmount" DECIMAL,
    "creditAmount" DECIMAL,
    "amount" DECIMAL,
    "balance" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "direction" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "rawData" JSONB,
    "rawHash" TEXT NOT NULL,
    "categorySuggestion" TEXT,
    "clientSuggestionId" TEXT,
    "caseFileSuggestionId" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'NONE',
    "matchedIncomeId" TEXT,
    "matchedExpenseId" TEXT,
    "matchedCashLedgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BankStatementRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_clientSuggestionId_fkey" FOREIGN KEY ("clientSuggestionId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_caseFileSuggestionId_fkey" FOREIGN KEY ("caseFileSuggestionId") REFERENCES "CaseFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_matchedIncomeId_fkey" FOREIGN KEY ("matchedIncomeId") REFERENCES "Income" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_matchedExpenseId_fkey" FOREIGN KEY ("matchedExpenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankStatementRow_matchedCashLedgerEntryId_fkey" FOREIGN KEY ("matchedCashLedgerEntryId") REFERENCES "CashLedgerEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BankStatementImport_userId_idx" ON "BankStatementImport"("userId");

-- CreateIndex
CREATE INDEX "BankStatementImport_documentId_idx" ON "BankStatementImport"("documentId");

-- CreateIndex
CREATE INDEX "BankStatementImport_cashAccountId_idx" ON "BankStatementImport"("cashAccountId");

-- CreateIndex
CREATE INDEX "BankStatementImport_bankName_idx" ON "BankStatementImport"("bankName");

-- CreateIndex
CREATE INDEX "BankStatementImport_sourceType_idx" ON "BankStatementImport"("sourceType");

-- CreateIndex
CREATE INDEX "BankStatementImport_status_idx" ON "BankStatementImport"("status");

-- CreateIndex
CREATE INDEX "BankStatementImport_fileHash_idx" ON "BankStatementImport"("fileHash");

-- CreateIndex
CREATE INDEX "BankStatementImport_periodStart_idx" ON "BankStatementImport"("periodStart");

-- CreateIndex
CREATE INDEX "BankStatementImport_periodEnd_idx" ON "BankStatementImport"("periodEnd");

-- CreateIndex
CREATE INDEX "BankStatementImport_deletedAt_idx" ON "BankStatementImport"("deletedAt");

-- CreateIndex
CREATE INDEX "BankStatementRow_userId_idx" ON "BankStatementRow"("userId");

-- CreateIndex
CREATE INDEX "BankStatementRow_userId_rawHash_idx" ON "BankStatementRow"("userId", "rawHash");

-- CreateIndex
CREATE INDEX "BankStatementRow_importId_idx" ON "BankStatementRow"("importId");

-- CreateIndex
CREATE INDEX "BankStatementRow_cashAccountId_idx" ON "BankStatementRow"("cashAccountId");

-- CreateIndex
CREATE INDEX "BankStatementRow_rowNumber_idx" ON "BankStatementRow"("rowNumber");

-- CreateIndex
CREATE INDEX "BankStatementRow_transactionDate_idx" ON "BankStatementRow"("transactionDate");

-- CreateIndex
CREATE INDEX "BankStatementRow_direction_idx" ON "BankStatementRow"("direction");

-- CreateIndex
CREATE INDEX "BankStatementRow_status_idx" ON "BankStatementRow"("status");

-- CreateIndex
CREATE INDEX "BankStatementRow_clientSuggestionId_idx" ON "BankStatementRow"("clientSuggestionId");

-- CreateIndex
CREATE INDEX "BankStatementRow_caseFileSuggestionId_idx" ON "BankStatementRow"("caseFileSuggestionId");

-- CreateIndex
CREATE INDEX "BankStatementRow_matchedIncomeId_idx" ON "BankStatementRow"("matchedIncomeId");

-- CreateIndex
CREATE INDEX "BankStatementRow_matchedExpenseId_idx" ON "BankStatementRow"("matchedExpenseId");

-- CreateIndex
CREATE INDEX "BankStatementRow_matchedCashLedgerEntryId_idx" ON "BankStatementRow"("matchedCashLedgerEntryId");

-- CreateIndex
CREATE INDEX "BankStatementRow_deletedAt_idx" ON "BankStatementRow"("deletedAt");
