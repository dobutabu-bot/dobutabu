import { access, unlink } from "node:fs/promises";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import { documentStorageDirectory } from "@/lib/documents/local-storage";

const prisma = new PrismaClient();
const markers = ["V3RC1-REALISTIC", "FINAL-RUNTIME-TEST", "RUNTIME-CRUD-TEST"] as const;
const execute = process.argv.includes("--execute");

type Target = { id: string };
type DemoTargets = Awaited<ReturnType<typeof collectTargets>>;

async function main() {
  const targets = await collectTargets();
  const ambiguous = await collectAmbiguousTestCounts();
  const activeCashAccountsBefore = await prisma.cashAccount.count({ where: { deletedAt: null, isActive: true } });

  const report = {
    mode: execute ? "EXECUTE" : "DRY_RUN",
    markers,
    databaseProvider: "sqlite",
    targetCounts: counts(targets),
    ambiguousTestOnlyCounts: ambiguous,
    physicalDocumentCandidates: targets.physicalDocuments.map((document) => ({ id: document.id, fileName: document.fileName })),
    activeCashAccountsBefore
  };

  if (!execute) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const deletedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: markerAuditWhere(targets) });

    await tx.documentProcessingLog.updateMany({ where: { documentId: { in: ids(targets.documents) } }, data: { deletedAt } });
    await tx.bankStatementRow.updateMany({ where: { id: { in: ids(targets.bankRows) } }, data: { deletedAt } });
    await tx.bankStatementImport.updateMany({ where: { id: { in: ids(targets.bankImports) } }, data: { deletedAt } });
    await tx.bankImportMapping.updateMany({ where: { id: { in: ids(targets.bankMappings) } }, data: { deletedAt, isActive: false } });
    await tx.capitalImport.updateMany({ where: { id: { in: ids(targets.capitalImports) } }, data: { deletedAt, status: "CANCELLED" } });
    await tx.assetTransaction.updateMany({ where: { id: { in: ids(targets.assetTransactions) } }, data: { deletedAt } });
    await tx.assetValuation.updateMany({ where: { id: { in: ids(targets.assetValuations) } }, data: { deletedAt } });
    await tx.assetAccount.updateMany({ where: { id: { in: ids(targets.assets) } }, data: { deletedAt, isActive: false } });
    await tx.cashLedgerEntry.updateMany({ where: { id: { in: ids(targets.ledgerEntries) } }, data: { deletedAt } });
    await tx.cashTransfer.updateMany({ where: { id: { in: ids(targets.cashTransfers) } }, data: { deletedAt } });
    await tx.document.updateMany({ where: { id: { in: ids(targets.documents) } }, data: { deletedAt } });
    await tx.invoiceOrReceipt.updateMany({ where: { id: { in: ids(targets.receipts) } }, data: { deletedAt } });
    await tx.taskReminder.updateMany({ where: { id: { in: ids(targets.reminders) } }, data: { deletedAt } });
    await tx.income.updateMany({ where: { id: { in: ids(targets.incomes) } }, data: { deletedAt } });
    await tx.expense.updateMany({ where: { id: { in: ids(targets.expenses) } }, data: { deletedAt } });
    await tx.caseFile.updateMany({
      where: { id: { in: ids(targets.caseFiles) } },
      data: { deletedAt, archivedAt: deletedAt, status: "ARCHIVED" }
    });
    await tx.client.updateMany({ where: { id: { in: ids(targets.clients) } }, data: { deletedAt, archivedAt: deletedAt } });
    await tx.cashAccount.updateMany({
      where: { id: { in: ids(targets.cashAccounts) } },
      data: { deletedAt, isActive: false, isDefault: false }
    });
    await tx.transactionRule.updateMany({ where: { id: { in: ids(targets.rules) } }, data: { deletedAt, isActive: false } });
    await tx.transactionCategory.updateMany({
      where: { id: { in: ids(targets.categories) }, isSystem: false },
      data: { deletedAt, isActive: false }
    });
    await tx.documentTag.updateMany({ where: { id: { in: ids(targets.tags) } }, data: { deletedAt } });

    const usersWithoutActiveCash = await tx.user.findMany({
      where: { cashAccounts: { none: { deletedAt: null, isActive: true } } },
      select: { id: true }
    });

    for (const user of usersWithoutActiveCash) {
      await tx.cashAccount.create({
        data: {
          userId: user.id,
          name: "Ana Kasa",
          type: "CASH",
          currency: "TRY",
          openingBalance: new Prisma.Decimal(0),
          isDefault: true,
          isActive: true
        }
      });
    }
  });

  const physicalDeletion = await deleteReferenceFreeDemoFiles(targets.physicalDocuments);
  const activeCashAccountsAfter = await prisma.cashAccount.count({ where: { deletedAt: null, isActive: true } });
  process.stdout.write(`${JSON.stringify({ ...report, activeCashAccountsAfter, physicalDeletion }, null, 2)}\n`);
}

async function collectTargets() {
  const [clients, caseFiles, cashAccounts, incomes, expenses, receipts, documents, bankImports, assets, reminders, tags, categories, rules, bankMappings, capitalImports] =
    await Promise.all([
      prisma.client.findMany({ where: { OR: markerOr(["name", "notes"]) as Prisma.ClientWhereInput["OR"] }, select: { id: true } }),
      prisma.caseFile.findMany({ where: { OR: markerOr(["title", "notes"]) as Prisma.CaseFileWhereInput["OR"] }, select: { id: true } }),
      prisma.cashAccount.findMany({ where: { OR: markerOr(["name", "description"]) as Prisma.CashAccountWhereInput["OR"] }, select: { id: true } }),
      prisma.income.findMany({ where: { OR: markerOr(["description", "receiptNumber"]) as Prisma.IncomeWhereInput["OR"] }, select: { id: true } }),
      prisma.expense.findMany({ where: { OR: markerOr(["description"]) as Prisma.ExpenseWhereInput["OR"] }, select: { id: true } }),
      prisma.invoiceOrReceipt.findMany({ where: { OR: markerOr(["number", "notes"]) as Prisma.InvoiceOrReceiptWhereInput["OR"] }, select: { id: true } }),
      prisma.document.findMany({
        where: { OR: markerOr(["title", "description", "originalFileName"]) as Prisma.DocumentWhereInput["OR"] },
        select: {
          id: true,
          fileName: true,
          storagePath: true,
          linkedClientId: true,
          linkedCaseFileId: true,
          linkedIncomeId: true,
          linkedExpenseId: true,
          linkedInvoiceOrReceiptId: true,
          linkedCashLedgerEntryId: true,
          _count: { select: { bankStatementImports: true, capitalImports: true, sourcedAssetAccounts: true, sourcedAssetValuations: true } }
        }
      }),
      prisma.bankStatementImport.findMany({ where: { OR: markerOr(["bankName", "originalFileName", "notes"]) as Prisma.BankStatementImportWhereInput["OR"] }, select: { id: true } }),
      prisma.assetAccount.findMany({ where: { OR: markerOr(["name", "description"]) as Prisma.AssetAccountWhereInput["OR"] }, select: { id: true } }),
      prisma.taskReminder.findMany({ where: { OR: markerOr(["title", "description"]) as Prisma.TaskReminderWhereInput["OR"] }, select: { id: true } }),
      prisma.documentTag.findMany({ where: { OR: markerOr(["name"]) as Prisma.DocumentTagWhereInput["OR"] }, select: { id: true } }),
      prisma.transactionCategory.findMany({ where: { isSystem: false, OR: markerOr(["name", "description"]) as Prisma.TransactionCategoryWhereInput["OR"] }, select: { id: true } }),
      prisma.transactionRule.findMany({ where: { OR: markerOr(["name", "keyword"]) as Prisma.TransactionRuleWhereInput["OR"] }, select: { id: true } }),
      prisma.bankImportMapping.findMany({ where: { OR: markerOr(["bankName"]) as Prisma.BankImportMappingWhereInput["OR"] }, select: { id: true } }),
      prisma.capitalImport.findMany({ where: { OR: markerOr(["originalFileName", "fileName"]) as Prisma.CapitalImportWhereInput["OR"] }, select: { id: true } })
    ]);

  const bankRows = await prisma.bankStatementRow.findMany({
    where: {
      OR: [
        { importId: { in: ids(bankImports) } },
        ...(markerOr(["description", "rawHash"]) as Prisma.BankStatementRowWhereInput[])
      ]
    },
    select: { id: true }
  });
  const ledgerEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      OR: [
        { incomeId: { in: ids(incomes) } },
        { expenseId: { in: ids(expenses) } },
        { cashAccountId: { in: ids(cashAccounts) } },
        ...(markerOr(["description", "referenceNo"]) as Prisma.CashLedgerEntryWhereInput[])
      ]
    },
    select: { id: true }
  });
  const cashTransfers = await prisma.cashTransfer.findMany({
    where: {
      OR: [
        { fromAccountId: { in: ids(cashAccounts) } },
        { toAccountId: { in: ids(cashAccounts) } },
        ...(markerOr(["description"]) as Prisma.CashTransferWhereInput[])
      ]
    },
    select: { id: true }
  });
  const assetValuations = await prisma.assetValuation.findMany({
    where: { OR: [{ assetAccountId: { in: ids(assets) } }, ...(markerOr(["note"]) as Prisma.AssetValuationWhereInput[])] },
    select: { id: true }
  });
  const assetTransactions = await prisma.assetTransaction.findMany({
    where: { OR: [{ assetAccountId: { in: ids(assets) } }, ...(markerOr(["description"]) as Prisma.AssetTransactionWhereInput[])] },
    select: { id: true }
  });
  const physicalDocuments = documents.filter(
    (document) =>
      !document.linkedClientId &&
      !document.linkedCaseFileId &&
      !document.linkedIncomeId &&
      !document.linkedExpenseId &&
      !document.linkedInvoiceOrReceiptId &&
      !document.linkedCashLedgerEntryId &&
      document._count.bankStatementImports === 0 &&
      document._count.capitalImports === 0 &&
      document._count.sourcedAssetAccounts === 0 &&
      document._count.sourcedAssetValuations === 0
  );

  return {
    clients,
    caseFiles,
    cashAccounts,
    incomes,
    expenses,
    receipts,
    documents,
    bankImports,
    bankRows,
    bankMappings,
    ledgerEntries,
    cashTransfers,
    assets,
    assetValuations,
    assetTransactions,
    capitalImports,
    reminders,
    tags,
    categories,
    rules,
    physicalDocuments
  };
}

async function collectAmbiguousTestCounts() {
  const notMarkers = { NOT: { OR: markerOr(["name"]) as Prisma.ClientWhereInput["OR"] } };
  const [clients, caseFiles, incomes, expenses, receipts, documents, cashAccounts, reminders, assets, bankImports] = await Promise.all([
    prisma.client.count({ where: { name: { contains: "Test" }, ...notMarkers } }),
    prisma.caseFile.count({ where: { title: { contains: "Test" }, NOT: { OR: markerOr(["title"]) as Prisma.CaseFileWhereInput["OR"] } } }),
    prisma.income.count({ where: { description: { contains: "Test" }, NOT: { OR: markerOr(["description"]) as Prisma.IncomeWhereInput["OR"] } } }),
    prisma.expense.count({ where: { description: { contains: "Test" }, NOT: { OR: markerOr(["description"]) as Prisma.ExpenseWhereInput["OR"] } } }),
    prisma.invoiceOrReceipt.count({ where: { number: { contains: "Test" }, NOT: { OR: markerOr(["number"]) as Prisma.InvoiceOrReceiptWhereInput["OR"] } } }),
    prisma.document.count({ where: { title: { contains: "Test" }, NOT: { OR: markerOr(["title"]) as Prisma.DocumentWhereInput["OR"] } } }),
    prisma.cashAccount.count({ where: { name: { contains: "Test" }, NOT: { OR: markerOr(["name"]) as Prisma.CashAccountWhereInput["OR"] } } }),
    prisma.taskReminder.count({ where: { title: { contains: "Test" }, NOT: { OR: markerOr(["title"]) as Prisma.TaskReminderWhereInput["OR"] } } }),
    prisma.assetAccount.count({ where: { name: { contains: "Test" }, NOT: { OR: markerOr(["name"]) as Prisma.AssetAccountWhereInput["OR"] } } }),
    prisma.bankStatementImport.count({ where: { bankName: { contains: "Test" }, NOT: { OR: markerOr(["bankName"]) as Prisma.BankStatementImportWhereInput["OR"] } } })
  ]);
  return { clients, caseFiles, incomes, expenses, receipts, documents, cashAccounts, reminders, assets, bankImports };
}

function markerOr(fields: readonly string[]) {
  return markers.flatMap((marker) => fields.map((field) => ({ [field]: { contains: marker } })));
}

function ids(rows: readonly Target[]) {
  return rows.map((row) => row.id);
}

function counts(targets: DemoTargets) {
  return Object.fromEntries(
    Object.entries(targets).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
  );
}

function markerAuditWhere(targets: DemoTargets): Prisma.AuditLogWhereInput {
  const entityIds = Object.values(targets).flatMap((value) =>
    Array.isArray(value) ? value.map((row) => (typeof row === "object" && row && "id" in row ? String(row.id) : "")).filter(Boolean) : []
  );
  return {
    OR: [
      { entityId: { in: entityIds } },
      ...(markerOr(["message"]) as Prisma.AuditLogWhereInput[])
    ]
  };
}

async function deleteReferenceFreeDemoFiles(documents: Array<{ id: string; fileName: string; storagePath: string }>) {
  const storageRoot = documentStorageDirectory();
  const results: Array<{ id: string; status: "deleted" | "missing" | "blocked" }> = [];

  for (const document of documents) {
    const normalizedPath = (document.storagePath || document.fileName).replace(/\\/g, "/");
    const relativeName = normalizedPath.startsWith("documents/") ? normalizedPath.slice("documents/".length) : normalizedPath;
    const candidate = path.resolve(storageRoot, relativeName);
    const insideStorage = candidate.startsWith(`${storageRoot}${path.sep}`);
    const isSingleFile = relativeName === path.posix.basename(relativeName) && path.basename(candidate) === document.fileName;
    if (!insideStorage || !isSingleFile) {
      results.push({ id: document.id, status: "blocked" });
      continue;
    }
    try {
      await access(candidate);
      await unlink(candidate);
      results.push({ id: document.id, status: "deleted" });
    } catch {
      results.push({ id: document.id, status: "missing" });
    }
  }

  return results;
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Bilinmeyen demo temizleme hatası";
    process.stderr.write(`Demo temizleme başarısız: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
