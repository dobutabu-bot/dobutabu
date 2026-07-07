-- CreateTable
CREATE TABLE "TransactionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ANY',
    "category" TEXT NOT NULL,
    "targetGroup" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "confidence" DECIMAL NOT NULL DEFAULT 0.9,
    "clientId" TEXT,
    "caseFileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TransactionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransactionRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransactionRule_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransactionRule_userId_idx" ON "TransactionRule"("userId");

-- CreateIndex
CREATE INDEX "TransactionRule_direction_idx" ON "TransactionRule"("direction");

-- CreateIndex
CREATE INDEX "TransactionRule_category_idx" ON "TransactionRule"("category");

-- CreateIndex
CREATE INDEX "TransactionRule_priority_idx" ON "TransactionRule"("priority");

-- CreateIndex
CREATE INDEX "TransactionRule_isActive_idx" ON "TransactionRule"("isActive");

-- CreateIndex
CREATE INDEX "TransactionRule_clientId_idx" ON "TransactionRule"("clientId");

-- CreateIndex
CREATE INDEX "TransactionRule_caseFileId_idx" ON "TransactionRule"("caseFileId");

-- CreateIndex
CREATE INDEX "TransactionRule_deletedAt_idx" ON "TransactionRule"("deletedAt");
