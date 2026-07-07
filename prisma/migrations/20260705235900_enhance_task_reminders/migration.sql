-- AlterTable
ALTER TABLE "TaskReminder" ADD COLUMN "reminderType" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "TaskReminder" ADD COLUMN "amount" DECIMAL;
ALTER TABLE "TaskReminder" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE "TaskReminder" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "TaskReminder" ADD COLUMN "notifyBeforeDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "TaskReminder" ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TaskReminder" ADD COLUMN "notifiedAt" DATETIME;
ALTER TABLE "TaskReminder" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "TaskReminder_reminderType_idx" ON "TaskReminder"("reminderType");

-- CreateIndex
CREATE INDEX "TaskReminder_priority_idx" ON "TaskReminder"("priority");

-- CreateIndex
CREATE INDEX "TaskReminder_notificationEnabled_idx" ON "TaskReminder"("notificationEnabled");

-- CreateIndex
CREATE INDEX "TaskReminder_deletedAt_idx" ON "TaskReminder"("deletedAt");
