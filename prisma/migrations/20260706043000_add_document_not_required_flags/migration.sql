-- Belgesiz finans kaydı tespitinde kullanıcı "belge gerekmiyor" işareti verebilsin.
-- Mevcut kayıtlar korunur; varsayılan olarak tüm kayıtlar belge gerektirir kabul edilir.
ALTER TABLE "Income" ADD COLUMN "documentNotRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "documentNotRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InvoiceOrReceipt" ADD COLUMN "documentNotRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CashLedgerEntry" ADD COLUMN "documentNotRequired" BOOLEAN NOT NULL DEFAULT false;
