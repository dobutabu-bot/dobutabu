-- AlterTable
ALTER TABLE "AssetAccount" ADD COLUMN "sourceDocumentId" TEXT;

-- AlterTable
ALTER TABLE "AssetAccount" ADD COLUMN "capitalImportId" TEXT;

-- AlterTable
ALTER TABLE "AssetValuation" ADD COLUMN "sourceDocumentId" TEXT;

-- AlterTable
ALTER TABLE "AssetValuation" ADD COLUMN "capitalImportId" TEXT;

-- CreateTable
CREATE TABLE "CapitalImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "importType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "originalFileName" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storagePath" TEXT,
    "fileHash" TEXT,
    "columns" JSONB,
    "previewRows" JSONB,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CapitalImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CapitalImport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapitalImportSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "capitalImportId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "assetType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "currency" TEXT,
    "quantity" DECIMAL,
    "unitPrice" DECIMAL,
    "totalValue" DECIMAL NOT NULL,
    "valuationCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "confidence" DECIMAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "note" TEXT,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CapitalImportSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CapitalImportSuggestion_capitalImportId_fkey" FOREIGN KEY ("capitalImportId") REFERENCES "CapitalImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetAccount_sourceDocumentId_idx" ON "AssetAccount"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "AssetAccount_capitalImportId_idx" ON "AssetAccount"("capitalImportId");

-- CreateIndex
CREATE INDEX "AssetValuation_sourceDocumentId_idx" ON "AssetValuation"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "AssetValuation_capitalImportId_idx" ON "AssetValuation"("capitalImportId");

-- CreateIndex
CREATE INDEX "CapitalImport_userId_idx" ON "CapitalImport"("userId");

-- CreateIndex
CREATE INDEX "CapitalImport_documentId_idx" ON "CapitalImport"("documentId");

-- CreateIndex
CREATE INDEX "CapitalImport_importType_idx" ON "CapitalImport"("importType");

-- CreateIndex
CREATE INDEX "CapitalImport_status_idx" ON "CapitalImport"("status");

-- CreateIndex
CREATE INDEX "CapitalImport_fileHash_idx" ON "CapitalImport"("fileHash");

-- CreateIndex
CREATE INDEX "CapitalImport_deletedAt_idx" ON "CapitalImport"("deletedAt");

-- CreateIndex
CREATE INDEX "CapitalImportSuggestion_userId_idx" ON "CapitalImportSuggestion"("userId");

-- CreateIndex
CREATE INDEX "CapitalImportSuggestion_capitalImportId_idx" ON "CapitalImportSuggestion"("capitalImportId");

-- CreateIndex
CREATE INDEX "CapitalImportSuggestion_assetType_idx" ON "CapitalImportSuggestion"("assetType");

-- CreateIndex
CREATE INDEX "CapitalImportSuggestion_status_idx" ON "CapitalImportSuggestion"("status");

-- CreateIndex
CREATE INDEX "CapitalImportSuggestion_confidence_idx" ON "CapitalImportSuggestion"("confidence");
