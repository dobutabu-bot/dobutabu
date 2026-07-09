import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import { Prisma } from "@prisma/client";

import { syncExpenseLedgerEntry, syncIncomeLedgerEntry } from "@/lib/cash/cash-ledger-service";
import { prisma } from "@/lib/prisma";
import {
  createRecordFromBankRow,
  getReconciliationData,
  matchBankStatementRow,
  unmatchBankStatementRow
} from "@/lib/reconciliation/reconciliation-service";

const runId = `reconciliation-safety-${Date.now()}-${process.pid}`;

after(async () => {
  await prisma.$disconnect();
});

test("V3-RC1 mutabakat güvenlik provası", async (t) => {
  await t.test("tek banka girişi tek tahsilata yüksek güvenli öneri üretir, onaysız kalıcı eşleşme yapmaz", async () => {
    await withFixture(async (fixture) => {
      const income = await createIncomeWithLedger(fixture, {
        amount: "12500.00",
        date: "2026-01-02",
        description: `${fixture.clientName} vekalet tahsilatı`
      });
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-01-02",
        description: `${fixture.clientName} tarafından vekalet ödemesi`,
        direction: "IN",
        amount: "12500.00",
        clientSuggestionId: fixture.clientId
      });

      const data = await getReconciliationData({ userId: fixture.userId, importId: fixture.importId });
      const suggestion = data.suggestions.find((item) => item.bankRowId === row.id && item.systemEntryId === income.ledger.id);

      assert.ok(suggestion, "Yüksek güvenli öneri oluşmalı");
      assert.equal(suggestion.requiresUserApproval, true);
      assert.equal(suggestion.confidenceBand, "HIGH");
      assert.ok(suggestion.confidence >= 0.9);
      assert.ok(suggestion.reasons.some((reason) => reason.toLocaleLowerCase("tr-TR").includes("müvekkil")));

      const untouched = await prisma.bankStatementRow.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(untouched.matchType, "NONE");
      assert.equal(untouched.matchedIncomeId, null);
      assert.equal(untouched.matchedCashLedgerEntryId, null);
    });
  });

  await t.test("aynı tutarlı iki tahsilat ambiguous kalır ve sistem otomatik karar vermez", async () => {
    await withFixture(async (fixture) => {
      await createIncomeWithLedger(fixture, {
        amount: "9900.00",
        date: "2026-02-02",
        description: "Anonim tahsilat A"
      });
      await createIncomeWithLedger(fixture, {
        amount: "9900.00",
        date: "2026-02-03",
        description: "Anonim tahsilat B"
      });
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-02-01",
        description: "Açıklamasız EFT girişi",
        direction: "IN",
        amount: "9900.00"
      });

      const data = await getReconciliationData({ userId: fixture.userId, importId: fixture.importId });

      assert.equal(data.suggestions.some((item) => item.bankRowId === row.id), false);
      assert.ok(data.unmatchedBankRows.some((item) => item.id === row.id), "Ambiguous hareket unmatched listesinde kalmalı");

      const persisted = await prisma.bankStatementRow.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(persisted.matchType, "NONE");
      assert.equal(persisted.matchedCashLedgerEntryId, null);
    });
  });

  await t.test("aynı tutar ama ters yön için öneri ve onaylı eşleşme reddedilir", async () => {
    await withFixture(async (fixture) => {
      const expense = await createExpenseWithLedger(fixture, {
        amount: "4500.00",
        date: "2026-03-01",
        description: "Aynı tutarlı sistem gideri"
      });
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-03-01",
        description: "Aynı tutarlı banka girişi",
        direction: "IN",
        amount: "4500.00"
      });

      const data = await getReconciliationData({ userId: fixture.userId, importId: fixture.importId });
      assert.equal(data.suggestions.some((item) => item.bankRowId === row.id), false);

      await assert.rejects(
        () => matchBankStatementRow({ userId: fixture.userId, bankRowId: row.id, targetType: "EXPENSE", targetId: expense.expense.id }),
        /yönü uyumlu değil/
      );
    });
  });

  await t.test("1 gün tarih farkı öneri üretir, 10 gün fark öneri üretmez", async () => {
    await withFixture(async (fixture) => {
      const nearIncome = await createIncomeWithLedger(fixture, {
        amount: "7100.00",
        date: "2026-04-02",
        description: "Yakın tarihli tahsilat"
      });
      const nearRow = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-04-01",
        description: "Yakın tarihli banka girişi",
        direction: "IN",
        amount: "7100.00"
      });

      await createIncomeWithLedger(fixture, {
        amount: "8300.00",
        date: "2026-04-20",
        description: "Uzak tarihli tahsilat"
      });
      const farRow = await createBankRow(fixture, {
        rowNumber: 2,
        date: "2026-04-10",
        description: "Uzak tarihli banka girişi",
        direction: "IN",
        amount: "8300.00"
      });

      const data = await getReconciliationData({ userId: fixture.userId, importId: fixture.importId });
      const nearSuggestion = data.suggestions.find((item) => item.bankRowId === nearRow.id && item.systemEntryId === nearIncome.ledger.id);

      assert.ok(nearSuggestion, "1 gün tarih farkında öneri oluşmalı");
      assert.ok(nearSuggestion.confidence >= 0.68);
      assert.equal(nearSuggestion.dateDiffDays, 1);
      assert.equal(data.suggestions.some((item) => item.bankRowId === farRow.id), false, "10 gün farkta öneri çıkmamalı");
    });
  });

  await t.test("kullanıcı öneriyi onaylayınca linkler, matchType ve audit log güncellenir; geri alma linkleri temizler", async () => {
    await withFixture(async (fixture) => {
      const income = await createIncomeWithLedger(fixture, {
        amount: "15250.00",
        date: "2026-05-01",
        description: "Onaylanacak tahsilat"
      });
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-05-01",
        description: "Onaylanacak banka girişi",
        direction: "IN",
        amount: "15250.00"
      });

      const approved = await matchBankStatementRow({
        userId: fixture.userId,
        bankRowId: row.id,
        targetType: "INCOME",
        targetId: income.income.id,
        matchMode: "AUTO_MATCHED"
      });

      assert.equal(approved.matchType, "AUTO_MATCHED");
      assert.equal(approved.matchedIncomeId, income.income.id);
      assert.equal(approved.matchedCashLedgerEntryId, income.ledger.id);

      const approvalLog = await prisma.auditLog.findFirst({
        where: { userId: fixture.userId, entityType: "BANK_STATEMENT_ROW", entityId: row.id, message: { contains: "eşleştirildi" } }
      });
      assert.ok(approvalLog, "Onay işlemi audit log yazmalı");

      const undone = await unmatchBankStatementRow(fixture.userId, row.id);
      assert.equal(undone.matchType, "NONE");
      assert.equal(undone.matchedIncomeId, null);
      assert.equal(undone.matchedExpenseId, null);
      assert.equal(undone.matchedCashLedgerEntryId, null);

      const undoLog = await prisma.auditLog.findFirst({
        where: { userId: fixture.userId, entityType: "BANK_STATEMENT_ROW", entityId: row.id, message: { contains: "geri alındı" } }
      });
      assert.ok(undoLog, "Geri alma audit log yazmalı");
    });
  });

  await t.test("bankadan tahsilat oluşturma Income + Ledger transaction linklerini kurar, duplicate ve rollback güvenlidir", async () => {
    await withFixture(async (fixture) => {
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-06-01",
        description: "Bankadan tahsilat oluşturma",
        direction: "IN",
        amount: "6400.00",
        clientSuggestionId: fixture.clientId
      });

      const created = await createRecordFromBankRow({
        userId: fixture.userId,
        bankRowId: row.id,
        kind: "INCOME",
        clientId: fixture.clientId,
        cashAccountId: fixture.cashAccountId,
        amount: "6400.00",
        currency: "TRY",
        date: "2026-06-01",
        description: "Bankadan oluşturulan tahsilat",
        incomeCategory: "LEGAL_FEE"
      });

      assert.equal(created.matchType, "CREATED_FROM_BANK");
      assert.ok(created.matchedIncomeId);
      assert.ok(created.matchedCashLedgerEntryId);

      const [income, ledger] = await Promise.all([
        prisma.income.findUniqueOrThrow({ where: { id: created.matchedIncomeId! } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: created.matchedCashLedgerEntryId! } })
      ]);
      assert.equal(income.cashAccountId, fixture.cashAccountId);
      assert.equal(ledger.incomeId, income.id);
      assert.equal(ledger.direction, "IN");

      await assert.rejects(
        () => createRecordFromBankRow({ userId: fixture.userId, bankRowId: row.id, kind: "INCOME", clientId: fixture.clientId }),
        /zaten eşleştirilmiş/
      );

      const undone = await unmatchBankStatementRow(fixture.userId, row.id);
      assert.equal(undone.matchType, "NONE");
      const [softDeletedIncome, softDeletedLedger] = await Promise.all([
        prisma.income.findUniqueOrThrow({ where: { id: income.id } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: ledger.id } })
      ]);
      assert.ok(softDeletedIncome.deletedAt);
      assert.ok(softDeletedLedger.deletedAt);
    });
  });

  await t.test("bankadan gider oluşturma Expense + Ledger transaction linklerini kurar ve rollback destekler", async () => {
    await withFixture(async (fixture) => {
      const row = await createBankRow(fixture, {
        rowNumber: 1,
        date: "2026-07-01",
        description: "Bankadan gider oluşturma",
        direction: "OUT",
        amount: "2750.00"
      });

      const created = await createRecordFromBankRow({
        userId: fixture.userId,
        bankRowId: row.id,
        kind: "EXPENSE",
        cashAccountId: fixture.cashAccountId,
        amount: "2750.00",
        currency: "TRY",
        date: "2026-07-01",
        description: "Bankadan oluşturulan gider",
        expenseCategory: "TAX",
        isClientExpense: false
      });

      assert.equal(created.matchType, "CREATED_FROM_BANK");
      assert.ok(created.matchedExpenseId);
      assert.ok(created.matchedCashLedgerEntryId);

      const [expense, ledger, auditLogs] = await Promise.all([
        prisma.expense.findUniqueOrThrow({ where: { id: created.matchedExpenseId! } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: created.matchedCashLedgerEntryId! } }),
        prisma.auditLog.findMany({
          where: { userId: fixture.userId, entityId: { in: [row.id, created.matchedExpenseId!, created.matchedCashLedgerEntryId!] } }
        })
      ]);

      assert.equal(expense.category, "TAX");
      assert.equal(ledger.expenseId, expense.id);
      assert.equal(ledger.direction, "OUT");
      assert.ok(auditLogs.some((log) => log.entityType === "EXPENSE" && log.action === "CREATE"));
      assert.ok(auditLogs.some((log) => log.entityType === "CASH_LEDGER_ENTRY" && log.action === "CREATE"));
      assert.ok(auditLogs.some((log) => log.entityType === "BANK_STATEMENT_ROW" && log.action === "UPDATE"));

      const undone = await unmatchBankStatementRow(fixture.userId, row.id);
      assert.equal(undone.matchType, "NONE");

      const [softDeletedExpense, softDeletedLedger] = await Promise.all([
        prisma.expense.findUniqueOrThrow({ where: { id: expense.id } }),
        prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: ledger.id } })
      ]);
      assert.ok(softDeletedExpense.deletedAt);
      assert.ok(softDeletedLedger.deletedAt);
    });
  });
});

type Fixture = Awaited<ReturnType<typeof createFixture>>;

type BankRowInput = {
  rowNumber: number;
  date: string;
  description: string;
  direction: "IN" | "OUT";
  amount: string;
  clientSuggestionId?: string | null;
};

async function withFixture(run: (fixture: Fixture) => Promise<void>) {
  const fixture = await createFixture();
  try {
    await run(fixture);
  } finally {
    await cleanupFixture(fixture.userId);
  }
}

async function createFixture() {
  const user = await prisma.user.create({
    data: {
      name: `Reconciliation Safety ${runId}`,
      email: `${runId}-${randomUUID()}@example.test`,
      passwordHash: "test-only-password-hash"
    }
  });
  const clientName = `Anonim Müvekkil ${randomUUID().slice(0, 8)}`;
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: clientName,
      type: "COMPANY"
    }
  });
  const cashAccount = await prisma.cashAccount.create({
    data: {
      userId: user.id,
      name: `Mutabakat Banka Hesabı ${randomUUID().slice(0, 8)}`,
      type: "BANK",
      currency: "TRY",
      openingBalance: new Prisma.Decimal("0"),
      isDefault: true,
      isActive: true
    }
  });
  const bankImport = await prisma.bankStatementImport.create({
    data: {
      userId: user.id,
      cashAccountId: cashAccount.id,
      bankName: "RC1 Mutabakat Test Bankası",
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `${runId}.csv`,
      originalFileName: `${runId}.csv`,
      mimeType: "text/csv",
      fileSize: 512,
      storagePath: `storage/test/${runId}.csv`,
      fileHash: `${runId}-${randomUUID()}`,
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      duplicateRows: 0
    }
  });

  return {
    userId: user.id,
    clientId: client.id,
    clientName,
    cashAccountId: cashAccount.id,
    importId: bankImport.id
  };
}

async function createIncomeWithLedger(fixture: Fixture, input: { amount: string; date: string; description: string }) {
  const income = await prisma.income.create({
    data: {
      userId: fixture.userId,
      clientId: fixture.clientId,
      cashAccountId: fixture.cashAccountId,
      amount: new Prisma.Decimal(input.amount),
      currency: "TRY",
      date: toDate(input.date),
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: input.description
    }
  });
  const ledger = await syncIncomeLedgerEntry(fixture.userId, income);
  return { income, ledger };
}

async function createExpenseWithLedger(fixture: Fixture, input: { amount: string; date: string; description: string }) {
  const expense = await prisma.expense.create({
    data: {
      userId: fixture.userId,
      cashAccountId: fixture.cashAccountId,
      amount: new Prisma.Decimal(input.amount),
      currency: "TRY",
      date: toDate(input.date),
      paymentMethod: "BANK_TRANSFER",
      category: "OTHER",
      description: input.description,
      isClientExpense: false
    }
  });
  const ledger = await syncExpenseLedgerEntry(fixture.userId, expense);
  return { expense, ledger };
}

function createBankRow(fixture: Fixture, input: BankRowInput) {
  const amount = new Prisma.Decimal(input.amount).abs();
  const signedAmount = input.direction === "IN" ? amount : amount.negated();

  return prisma.bankStatementRow.create({
    data: {
      userId: fixture.userId,
      importId: fixture.importId,
      cashAccountId: fixture.cashAccountId,
      rowNumber: input.rowNumber,
      transactionDate: toDate(input.date),
      description: input.description,
      debitAmount: input.direction === "OUT" ? amount : null,
      creditAmount: input.direction === "IN" ? amount : null,
      amount: signedAmount,
      currency: "TRY",
      direction: input.direction,
      status: "SUCCESS",
      rawData: { date: input.date, description: input.description, amount: input.amount },
      rawHash: `${fixture.importId}-${input.rowNumber}-${input.direction}-${input.amount}`,
      clientSuggestionId: input.clientSuggestionId ?? null
    }
  });
}

async function cleanupFixture(userId: string) {
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.bankStatementRow.deleteMany({ where: { userId } });
  await prisma.bankStatementImport.deleteMany({ where: { userId } });
  await prisma.cashLedgerEntry.deleteMany({ where: { userId } });
  await prisma.income.deleteMany({ where: { userId } });
  await prisma.expense.deleteMany({ where: { userId } });
  await prisma.cashAccount.deleteMany({ where: { userId } });
  await prisma.client.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00+03:00`);
}
