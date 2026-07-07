ALTER TABLE "TaskReminder" ADD COLUMN "cashAccountId" TEXT;

CREATE INDEX "TaskReminder_cashAccountId_idx" ON "TaskReminder"("cashAccountId");
