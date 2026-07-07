-- Soft delete flags for financial records. Existing rows remain active because the fields are nullable.
ALTER TABLE "Income" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "InvoiceOrReceipt" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Income_deletedAt_idx" ON "Income"("deletedAt");
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");
CREATE INDEX "InvoiceOrReceipt_deletedAt_idx" ON "InvoiceOrReceipt"("deletedAt");
