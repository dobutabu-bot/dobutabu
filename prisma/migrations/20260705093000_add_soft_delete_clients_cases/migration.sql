-- Add soft-delete metadata to client and case records without touching existing data.
ALTER TABLE "Client" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "CaseFile" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "CaseFile" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");
CREATE INDEX "CaseFile_archivedAt_idx" ON "CaseFile"("archivedAt");
CREATE INDEX "CaseFile_deletedAt_idx" ON "CaseFile"("deletedAt");
