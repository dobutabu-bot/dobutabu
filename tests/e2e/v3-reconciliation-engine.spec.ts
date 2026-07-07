import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import {
  createRecordFromBankRow,
  getReconciliationData,
  matchBankStatementRow,
  unmatchBankStatementRow
} from "../../src/lib/reconciliation/reconciliation-service";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 approval-based reconciliation engine", () => {
  test("suggests a near-date match, persists only after approval and supports undo", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Mutabakat motoru testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let cashAccountId: string | null = null;
    let importId: string | null = null;
    let bankRowId: string | null = null;
    let ledgerEntryId: string | null = null;

    try {
      const cashAccount = await prisma.cashAccount.create({
        data: {
          userId: user!.id,
          name: `Mutabakat Test Kasa ${stamp}`,
          type: "BANK",
          currency: "TRY"
        }
      });
      cashAccountId = cashAccount.id;

      const bankImport = await createBankImport(user!.id, cashAccount.id, stamp, "near-date");
      importId = bankImport.id;

      const bankRow = await prisma.bankStatementRow.create({
        data: bankRowData(user!.id, bankImport.id, cashAccount.id, 1, "2026-07-02", "Delta Teknoloji vekalet ödemesi", "IN", 12500)
      });
      bankRowId = bankRow.id;

      const ledgerEntry = await prisma.cashLedgerEntry.create({
        data: {
          userId: user!.id,
          cashAccountId: cashAccount.id,
          direction: "IN",
          entryType: "INCOME",
          amount: 12500,
          currency: "TRY",
          date: new Date("2026-07-03T00:00:00+03:00"),
          description: "Delta Teknoloji vekalet tahsilatı"
        }
      });
      ledgerEntryId = ledgerEntry.id;

      const beforeApproval = await getReconciliationData({ userId: user!.id, importId: bankImport.id });
      const suggestion = beforeApproval.suggestions.find((item) => item.bankRowId === bankRow.id && item.systemEntryId === ledgerEntry.id);
      expect(suggestion).toBeTruthy();
      expect(suggestion?.confidence).toBeGreaterThanOrEqual(0.68);
      expect(suggestion?.requiresUserApproval).toBe(true);

      const untouchedRow = await prisma.bankStatementRow.findUniqueOrThrow({ where: { id: bankRow.id } });
      expect(untouchedRow.matchType).toBe("NONE");
      expect(untouchedRow.matchedCashLedgerEntryId).toBeNull();

      const approved = await matchBankStatementRow({
        userId: user!.id,
        bankRowId: bankRow.id,
        targetType: "LEDGER",
        targetId: ledgerEntry.id,
        matchMode: "AUTO_MATCHED"
      });
      expect(approved.matchType).toBe("AUTO_MATCHED");
      expect(approved.matchedCashLedgerEntryId).toBe(ledgerEntry.id);

      const afterApproval = await getReconciliationData({ userId: user!.id, importId: bankImport.id });
      expect(afterApproval.counts.matched).toBe(1);
      expect(afterApproval.suggestions.some((item) => item.bankRowId === bankRow.id)).toBe(false);

      const undone = await unmatchBankStatementRow(user!.id, bankRow.id);
      expect(undone.matchType).toBe("NONE");
      expect(undone.matchedCashLedgerEntryId).toBeNull();

      const ledgerStillActive = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: ledgerEntry.id } });
      expect(ledgerStillActive.deletedAt).toBeNull();
    } finally {
      await cleanup({
        cashAccountId,
        importId,
        bankRowIds: [bankRowId],
        ledgerEntryIds: [ledgerEntryId]
      });
    }
  });

  test("does not auto-suggest when two close system movements are ambiguous", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Mutabakat motoru testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let cashAccountId: string | null = null;
    let importId: string | null = null;
    let bankRowId: string | null = null;
    const ledgerEntryIds: string[] = [];

    try {
      const cashAccount = await prisma.cashAccount.create({
        data: {
          userId: user!.id,
          name: `Ambiguous Test Kasa ${stamp}`,
          type: "BANK",
          currency: "TRY"
        }
      });
      cashAccountId = cashAccount.id;

      const bankImport = await createBankImport(user!.id, cashAccount.id, stamp, "ambiguous");
      importId = bankImport.id;
      const bankRow = await prisma.bankStatementRow.create({
        data: bankRowData(user!.id, bankImport.id, cashAccount.id, 1, "2026-07-02", "Kart ödeme açıklamasız", "OUT", -9900)
      });
      bankRowId = bankRow.id;

      for (const [index, description] of ["Ofis genel ödeme A", "Banka ödeme kalemi B"].entries()) {
        const entry = await prisma.cashLedgerEntry.create({
          data: {
            userId: user!.id,
            cashAccountId: cashAccount.id,
            direction: "OUT",
            entryType: "EXPENSE",
            amount: 9900,
            currency: "TRY",
            date: new Date(`2026-07-0${index + 3}T00:00:00+03:00`),
            description
          }
        });
        ledgerEntryIds.push(entry.id);
      }

      const data = await getReconciliationData({ userId: user!.id, importId: bankImport.id });
      expect(data.suggestions.some((item) => item.bankRowId === bankRow.id)).toBe(false);
      expect(data.unmatchedBankRows.some((item) => item.id === bankRow.id)).toBe(true);

      const persisted = await prisma.bankStatementRow.findUniqueOrThrow({ where: { id: bankRow.id } });
      expect(persisted.matchType).toBe("NONE");
      expect(persisted.matchedCashLedgerEntryId).toBeNull();
    } finally {
      await cleanup({
        cashAccountId,
        importId,
        bankRowIds: [bankRowId],
        ledgerEntryIds
      });
    }
  });

  test("creates an expense from a bank row with ledger linkage, audit logs and rollback", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Mutabakat motoru testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let cashAccountId: string | null = null;
    let importId: string | null = null;
    let bankRowId: string | null = null;
    let expenseId: string | null = null;
    let ledgerEntryId: string | null = null;

    try {
      const cashAccount = await prisma.cashAccount.create({
        data: {
          userId: user!.id,
          name: `Create From Bank Kasa ${stamp}`,
          type: "BANK",
          currency: "TRY"
        }
      });
      cashAccountId = cashAccount.id;
      const bankImport = await createBankImport(user!.id, cashAccount.id, stamp, "create-expense");
      importId = bankImport.id;
      const bankRow = await prisma.bankStatementRow.create({
        data: bankRowData(user!.id, bankImport.id, cashAccount.id, 1, "2026-07-04", "VERGI E2E stopaj ödemesi", "OUT", -987654.32)
      });
      bankRowId = bankRow.id;

      const created = await createRecordFromBankRow({
        userId: user!.id,
        bankRowId: bankRow.id,
        kind: "EXPENSE",
        cashAccountId: cashAccount.id,
        amount: "987654.32",
        currency: "TRY",
        date: "2026-07-04",
        description: "Banka hareketinden vergi gideri",
        expenseCategory: "TAX",
        isClientExpense: false
      });

      expect(created.matchType).toBe("CREATED_FROM_BANK");
      expect(created.matchedExpenseId).toBeTruthy();
      expect(created.matchedCashLedgerEntryId).toBeTruthy();
      expenseId = created.matchedExpenseId;
      ledgerEntryId = created.matchedCashLedgerEntryId;

      const [expense, ledger, auditLogs] = await Promise.all([
        prisma.expense.findUniqueOrThrow({ where: { id: expenseId! } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: ledgerEntryId! } }),
        prisma.auditLog.findMany({ where: { entityId: { in: [bankRow.id, expenseId!, ledgerEntryId!] } } })
      ]);
      expect(expense.category).toBe("TAX");
      expect(expense.cashAccountId).toBe(cashAccount.id);
      expect(ledger.direction).toBe("OUT");
      expect(ledger.expenseId).toBe(expense.id);
      expect(auditLogs.some((log) => log.entityType === "BANK_STATEMENT_ROW" && log.action === "UPDATE")).toBeTruthy();
      expect(auditLogs.some((log) => log.entityType === "EXPENSE" && log.action === "CREATE")).toBeTruthy();
      expect(auditLogs.some((log) => log.entityType === "CASH_LEDGER_ENTRY" && log.action === "CREATE")).toBeTruthy();

      const undone = await unmatchBankStatementRow(user!.id, bankRow.id);
      expect(undone.matchType).toBe("NONE");
      expect(undone.matchedExpenseId).toBeNull();
      expect(undone.matchedCashLedgerEntryId).toBeNull();

      const [softDeletedExpense, softDeletedLedger] = await Promise.all([
        prisma.expense.findUniqueOrThrow({ where: { id: expenseId! } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: ledgerEntryId! } })
      ]);
      expect(softDeletedExpense.deletedAt).not.toBeNull();
      expect(softDeletedLedger.deletedAt).not.toBeNull();
    } finally {
      await cleanup({
        cashAccountId,
        importId,
        bankRowIds: [bankRowId],
        ledgerEntryIds: [ledgerEntryId],
        expenseIds: [expenseId]
      });
    }
  });

  test("prevents duplicate record creation when a close ledger movement already exists", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Mutabakat motoru testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let cashAccountId: string | null = null;
    let importId: string | null = null;
    let bankRowId: string | null = null;
    let ledgerEntryId: string | null = null;

    try {
      const cashAccount = await prisma.cashAccount.create({
        data: {
          userId: user!.id,
          name: `Duplicate Test Kasa ${stamp}`,
          type: "BANK",
          currency: "TRY"
        }
      });
      cashAccountId = cashAccount.id;
      const bankImport = await createBankImport(user!.id, cashAccount.id, stamp, "duplicate");
      importId = bankImport.id;
      const bankRow = await prisma.bankStatementRow.create({
        data: bankRowData(user!.id, bankImport.id, cashAccount.id, 1, "2026-07-05", "Mevcut kayda benzer ödeme", "OUT", -4400)
      });
      bankRowId = bankRow.id;
      const ledger = await prisma.cashLedgerEntry.create({
        data: {
          userId: user!.id,
          cashAccountId: cashAccount.id,
          direction: "OUT",
          entryType: "EXPENSE",
          amount: 4400,
          currency: "TRY",
          date: new Date("2026-07-06T00:00:00+03:00"),
          description: "Önceden girilmiş gider hareketi"
        }
      });
      ledgerEntryId = ledger.id;
      const expenseCountBefore = await prisma.expense.count({ where: { userId: user!.id, description: `Duplicate should not create ${stamp}` } });

      await expect(
        createRecordFromBankRow({
          userId: user!.id,
          bankRowId: bankRow.id,
          kind: "EXPENSE",
          cashAccountId: cashAccount.id,
          amount: "4400",
          currency: "TRY",
          date: "2026-07-05",
          description: `Duplicate should not create ${stamp}`,
          expenseCategory: "OTHER",
          isClientExpense: false
        })
      ).rejects.toThrow(/zaten var/);

      const [rowAfter, expenseCountAfter] = await Promise.all([
        prisma.bankStatementRow.findUniqueOrThrow({ where: { id: bankRow.id } }),
        prisma.expense.count({ where: { userId: user!.id, description: `Duplicate should not create ${stamp}` } })
      ]);
      expect(rowAfter.matchType).toBe("NONE");
      expect(rowAfter.matchedExpenseId).toBeNull();
      expect(expenseCountAfter).toBe(expenseCountBefore);
    } finally {
      await cleanup({
        cashAccountId,
        importId,
        bankRowIds: [bankRowId],
        ledgerEntryIds: [ledgerEntryId]
      });
    }
  });
});

async function createBankImport(userId: string, cashAccountId: string, stamp: string, suffix: string) {
  return prisma.bankStatementImport.create({
    data: {
      userId,
      cashAccountId,
      bankName: `Mutabakat Banka ${stamp}`,
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `reconciliation-${suffix}-${stamp}.csv`,
      originalFileName: `reconciliation-${suffix}-${stamp}.csv`,
      mimeType: "text/csv",
      fileSize: 256,
      storagePath: `storage/test/reconciliation-${suffix}-${stamp}.csv`,
      fileHash: `reconciliation-${suffix}-${stamp}`,
      totalRows: 1,
      successfulRows: 1,
      failedRows: 0,
      duplicateRows: 0
    }
  });
}

function bankRowData(
  userId: string,
  importId: string,
  cashAccountId: string,
  rowNumber: number,
  date: string,
  description: string,
  direction: "IN" | "OUT",
  amount: number
) {
  return {
    userId,
    importId,
    cashAccountId,
    rowNumber,
    transactionDate: new Date(`${date}T00:00:00+03:00`),
    description,
    debitAmount: direction === "OUT" ? Math.abs(amount) : null,
    creditAmount: direction === "IN" ? Math.abs(amount) : null,
    amount,
    currency: "TRY",
    direction,
    status: "SUCCESS" as const,
    rawData: { date, description, amount: String(amount) },
    rawHash: `${importId}-${rowNumber}-${amount}`
  };
}

async function cleanup({
  cashAccountId,
  importId,
  bankRowIds,
  ledgerEntryIds,
  expenseIds = []
}: {
  cashAccountId: string | null;
  importId: string | null;
  bankRowIds: Array<string | null>;
  ledgerEntryIds: Array<string | null>;
  expenseIds?: Array<string | null>;
}) {
  const bankIds = bankRowIds.filter(Boolean) as string[];
  const ledgerIds = ledgerEntryIds.filter(Boolean) as string[];
  const expenseIdsToDelete = expenseIds.filter(Boolean) as string[];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...bankIds, ...ledgerIds, ...expenseIdsToDelete] } } });
  if (importId) {
    await prisma.bankStatementRow.deleteMany({ where: { importId } });
    await prisma.bankStatementImport.deleteMany({ where: { id: importId } });
  }
  if (ledgerIds.length) await prisma.cashLedgerEntry.deleteMany({ where: { id: { in: ledgerIds } } });
  if (expenseIdsToDelete.length) await prisma.expense.deleteMany({ where: { id: { in: expenseIdsToDelete } } });
  if (cashAccountId) await prisma.cashAccount.deleteMany({ where: { id: cashAccountId } });
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
