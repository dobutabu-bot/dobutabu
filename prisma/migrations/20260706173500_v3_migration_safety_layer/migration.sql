-- V3 migration safety layer.
-- Additive-only migration: no DROP TABLE, no table redefinition, no data rewrite.

CREATE TABLE "TransactionCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'OTHER',
    "direction" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "color" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "TransactionCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TransactionCategory_userId_slug_key" ON "TransactionCategory"("userId", "slug");
CREATE INDEX "TransactionCategory_userId_idx" ON "TransactionCategory"("userId");
CREATE INDEX "TransactionCategory_group_idx" ON "TransactionCategory"("group");
CREATE INDEX "TransactionCategory_direction_idx" ON "TransactionCategory"("direction");
CREATE INDEX "TransactionCategory_isSystem_idx" ON "TransactionCategory"("isSystem");
CREATE INDEX "TransactionCategory_isActive_idx" ON "TransactionCategory"("isActive");
CREATE INDEX "TransactionCategory_deletedAt_idx" ON "TransactionCategory"("deletedAt");

ALTER TABLE "DocumentProcessingLog" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "DocumentProcessingLog" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "DocumentProcessingLog_deletedAt_idx" ON "DocumentProcessingLog"("deletedAt");

ALTER TABLE "DocumentTag" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "DocumentTag" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "DocumentTag_deletedAt_idx" ON "DocumentTag"("deletedAt");

ALTER TABLE "AssetValuation" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "AssetValuation" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "AssetValuation_deletedAt_idx" ON "AssetValuation"("deletedAt");

ALTER TABLE "CapitalSnapshot" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "CapitalSnapshot" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "CapitalSnapshot_deletedAt_idx" ON "CapitalSnapshot"("deletedAt");
