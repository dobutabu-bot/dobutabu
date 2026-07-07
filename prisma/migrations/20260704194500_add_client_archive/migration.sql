-- AlterTable
ALTER TABLE "Client" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");
