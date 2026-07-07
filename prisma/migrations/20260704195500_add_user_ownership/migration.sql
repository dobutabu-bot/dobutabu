-- Add owner columns for future multi-user isolation.
-- Existing single-user rows are assigned to the first created user.

ALTER TABLE "Client" ADD COLUMN "userId" TEXT;
UPDATE "Client"
SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "userId" IS NULL;
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

ALTER TABLE "CaseFile" ADD COLUMN "userId" TEXT;
UPDATE "CaseFile"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Client" WHERE "Client"."id" = "CaseFile"."clientId"),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;
CREATE INDEX "CaseFile_userId_idx" ON "CaseFile"("userId");

ALTER TABLE "Income" ADD COLUMN "userId" TEXT;
UPDATE "Income"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Client" WHERE "Client"."id" = "Income"."clientId"),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;
CREATE INDEX "Income_userId_idx" ON "Income"("userId");

ALTER TABLE "Expense" ADD COLUMN "userId" TEXT;
UPDATE "Expense"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Client" WHERE "Client"."id" = "Expense"."clientId"),
  (SELECT "userId" FROM "CaseFile" WHERE "CaseFile"."id" = "Expense"."caseFileId"),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");

ALTER TABLE "InvoiceOrReceipt" ADD COLUMN "userId" TEXT;
UPDATE "InvoiceOrReceipt"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Client" WHERE "Client"."id" = "InvoiceOrReceipt"."clientId"),
  (SELECT "userId" FROM "CaseFile" WHERE "CaseFile"."id" = "InvoiceOrReceipt"."caseFileId"),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;
CREATE INDEX "InvoiceOrReceipt_userId_idx" ON "InvoiceOrReceipt"("userId");
DROP INDEX IF EXISTS "InvoiceOrReceipt_type_number_key";
CREATE UNIQUE INDEX "InvoiceOrReceipt_userId_type_number_key" ON "InvoiceOrReceipt"("userId", "type", "number");

ALTER TABLE "TaskReminder" ADD COLUMN "userId" TEXT;
UPDATE "TaskReminder"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Client" WHERE "Client"."id" = "TaskReminder"."relatedClientId"),
  (SELECT "userId" FROM "CaseFile" WHERE "CaseFile"."id" = "TaskReminder"."relatedCaseFileId"),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;
CREATE INDEX "TaskReminder_userId_idx" ON "TaskReminder"("userId");

ALTER TABLE "AppSetting" ADD COLUMN "userId" TEXT;
UPDATE "AppSetting"
SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "userId" IS NULL;
CREATE INDEX "AppSetting_userId_idx" ON "AppSetting"("userId");
DROP INDEX IF EXISTS "AppSetting_key_key";
CREATE UNIQUE INDEX "AppSetting_userId_key_key" ON "AppSetting"("userId", "key");
