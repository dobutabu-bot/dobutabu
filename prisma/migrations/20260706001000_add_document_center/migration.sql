-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentDate" DATETIME,
    "amount" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "extractedText" TEXT,
    "extractionStatus" TEXT NOT NULL DEFAULT 'NOT_PROCESSED',
    "linkedClientId" TEXT,
    "linkedCaseFileId" TEXT,
    "linkedIncomeId" TEXT,
    "linkedExpenseId" TEXT,
    "linkedInvoiceOrReceiptId" TEXT,
    "linkedCashLedgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedCaseFileId_fkey" FOREIGN KEY ("linkedCaseFileId") REFERENCES "CaseFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedIncomeId_fkey" FOREIGN KEY ("linkedIncomeId") REFERENCES "Income" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedExpenseId_fkey" FOREIGN KEY ("linkedExpenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedInvoiceOrReceiptId_fkey" FOREIGN KEY ("linkedInvoiceOrReceiptId") REFERENCES "InvoiceOrReceipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_linkedCashLedgerEntryId_fkey" FOREIGN KEY ("linkedCashLedgerEntryId") REFERENCES "CashLedgerEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentTagOnDocument" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("documentId", "tagId"),
    CONSTRAINT "DocumentTagOnDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentTagOnDocument_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "DocumentTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentProcessingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentProcessingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentProcessingLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- CreateIndex
CREATE INDEX "Document_fileHash_idx" ON "Document"("fileHash");

-- CreateIndex
CREATE INDEX "Document_userId_fileHash_idx" ON "Document"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "Document_uploadedAt_idx" ON "Document"("uploadedAt");

-- CreateIndex
CREATE INDEX "Document_documentDate_idx" ON "Document"("documentDate");

-- CreateIndex
CREATE INDEX "Document_linkedClientId_idx" ON "Document"("linkedClientId");

-- CreateIndex
CREATE INDEX "Document_linkedCaseFileId_idx" ON "Document"("linkedCaseFileId");

-- CreateIndex
CREATE INDEX "Document_linkedIncomeId_idx" ON "Document"("linkedIncomeId");

-- CreateIndex
CREATE INDEX "Document_linkedExpenseId_idx" ON "Document"("linkedExpenseId");

-- CreateIndex
CREATE INDEX "Document_linkedInvoiceOrReceiptId_idx" ON "Document"("linkedInvoiceOrReceiptId");

-- CreateIndex
CREATE INDEX "Document_linkedCashLedgerEntryId_idx" ON "Document"("linkedCashLedgerEntryId");

-- CreateIndex
CREATE INDEX "Document_extractionStatus_idx" ON "Document"("extractionStatus");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTag_userId_name_key" ON "DocumentTag"("userId", "name");

-- CreateIndex
CREATE INDEX "DocumentTag_userId_idx" ON "DocumentTag"("userId");

-- CreateIndex
CREATE INDEX "DocumentTag_name_idx" ON "DocumentTag"("name");

-- CreateIndex
CREATE INDEX "DocumentTagOnDocument_tagId_idx" ON "DocumentTagOnDocument"("tagId");

-- CreateIndex
CREATE INDEX "DocumentProcessingLog_userId_idx" ON "DocumentProcessingLog"("userId");

-- CreateIndex
CREATE INDEX "DocumentProcessingLog_documentId_idx" ON "DocumentProcessingLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentProcessingLog_status_idx" ON "DocumentProcessingLog"("status");

-- CreateIndex
CREATE INDEX "DocumentProcessingLog_createdAt_idx" ON "DocumentProcessingLog"("createdAt");
