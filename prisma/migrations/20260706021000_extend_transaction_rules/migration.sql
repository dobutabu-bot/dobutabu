-- AlterTable
ALTER TABLE "TransactionRule" ADD COLUMN "matchType" TEXT NOT NULL DEFAULT 'DESCRIPTION_CONTAINS';

-- AlterTable
ALTER TABLE "TransactionRule" ADD COLUMN "amountMin" DECIMAL;

-- AlterTable
ALTER TABLE "TransactionRule" ADD COLUMN "amountMax" DECIMAL;

-- AlterTable
ALTER TABLE "TransactionRule" ADD COLUMN "cashAccountId" TEXT;

-- CreateIndex
CREATE INDEX "TransactionRule_matchType_idx" ON "TransactionRule"("matchType");

-- CreateIndex
CREATE INDEX "TransactionRule_cashAccountId_idx" ON "TransactionRule"("cashAccountId");
