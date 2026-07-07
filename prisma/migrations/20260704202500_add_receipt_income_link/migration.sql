-- Placeholder link for future receipt/invoice to collection matching.
-- This first version does not expose the relation in the UI.
ALTER TABLE "InvoiceOrReceipt" ADD COLUMN "relatedIncomeId" TEXT;

CREATE INDEX "InvoiceOrReceipt_relatedIncomeId_idx" ON "InvoiceOrReceipt"("relatedIncomeId");
