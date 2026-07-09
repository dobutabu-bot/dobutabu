import assert from "node:assert/strict";
import { after, test } from "node:test";
import { rm } from "node:fs/promises";

import { Prisma } from "@prisma/client";

import { createBankStatementImport } from "@/lib/bank-statements";
import { getCashAccountBalance, getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import {
  createCashTransfer,
  softDeleteLedgerEntryFromExpense,
  softDeleteLedgerEntryFromIncome,
  syncExpenseLedgerEntry,
  syncIncomeLedgerEntry
} from "@/lib/cash/cash-ledger-service";
import { createAssetAccount, createAssetValuation } from "@/lib/capital/asset-service";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { LocalDocumentStorage } from "@/lib/documents/local-storage";
import { getDashboardSummary } from "@/lib/dashboard/dashboard-data";
import { prisma } from "@/lib/prisma";
import { getReportSummary } from "@/lib/reports/report-data";
import {
  createRecordFromBankRow,
  matchBankStatementRow,
  unmatchBankStatementRow
} from "@/lib/reconciliation/reconciliation-service";

const runId = `financial-rc1-${Date.now()}-${process.pid}`;
const today = new Date();
const todayInput = isoDate(today);
const storage = new LocalDocumentStorage();

let userId: string | null = null;
let clientId: string | null = null;
let caseFileId: string | null = null;
let mainCashAccountId: string | null = null;
let transferCashAccountId: string | null = null;

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("V3-RC1 financial invariants", async (t) => {
  await t.test("test datası izole kurulur", async () => {
    const user = await prisma.user.create({
      data: {
        name: `Financial Accuracy ${runId}`,
        email: `${runId}@example.test`,
        passwordHash: "test-only-password-hash"
      }
    });
    userId = user.id;

    const client = await prisma.client.create({
      data: {
        userId,
        name: `Finans Test Müvekkili ${runId}`,
        type: "COMPANY",
        taxNo: `TEST-${process.pid}`
      }
    });
    clientId = client.id;

    const caseFile = await prisma.caseFile.create({
      data: {
        userId,
        clientId,
        title: `Finans Doğruluk Dosyası ${runId}`,
        fileNumber: `RC1/${process.pid}`,
        status: "ACTIVE"
      }
    });
    caseFileId = caseFile.id;

    const mainCash = await prisma.cashAccount.create({
      data: {
        userId,
        name: `Ana Kasa ${runId}`,
        type: "CASH",
        currency: "TRY",
        openingBalance: decimal("1000.00"),
        isDefault: true,
        isActive: true
      }
    });
    mainCashAccountId = mainCash.id;

    const transferCash = await prisma.cashAccount.create({
      data: {
        userId,
        name: `Banka Kasa ${runId}`,
        type: "BANK",
        currency: "TRY",
        openingBalance: decimal("250.00"),
        isDefault: false,
        isActive: true
      }
    });
    transferCashAccountId = transferCash.id;

    assert.equal(await balance(mainCash.id), "1000.00");
    assert.equal(await balance(transferCash.id), "250.00");
  });

  await t.test("tahsilat create/update/delete ledger ve rapor toplamlarını doğru etkiler", async () => {
    const ids = requireFixtureIds();

    const income = await prisma.$transaction(async (tx) => {
      const created = await tx.income.create({
        data: {
          userId: ids.userId,
          clientId: ids.clientId,
          caseFileId: ids.caseFileId,
          cashAccountId: ids.mainCashAccountId,
          amount: decimal("123.45"),
          currency: "TRY",
          date: today,
          paymentMethod: "BANK_TRANSFER",
          category: "LEGAL_FEE",
          description: "RC1 finans doğruluk tahsilatı"
        }
      });
      await syncIncomeLedgerEntry(ids.userId, created, tx);
      return created;
    });

    let incomeLedger = await prisma.cashLedgerEntry.findFirstOrThrow({
      where: { userId: ids.userId, incomeId: income.id, deletedAt: null }
    });
    assert.equal(incomeLedger.direction, "IN");
    assert.equal(incomeLedger.entryType, "INCOME");
    assert.equal(decimalString(incomeLedger.amount), "123.45");
    assert.equal(await balance(ids.mainCashAccountId), "1123.45");

    const updatedIncome = await prisma.$transaction(async (tx) => {
      const updated = await tx.income.update({
        where: { id: income.id },
        data: { amount: decimal("200.10"), description: "RC1 finans doğruluk tahsilatı güncellendi" }
      });
      await syncIncomeLedgerEntry(ids.userId, updated, tx);
      return updated;
    });

    incomeLedger = await prisma.cashLedgerEntry.findFirstOrThrow({
      where: { userId: ids.userId, incomeId: updatedIncome.id, deletedAt: null }
    });
    assert.equal(decimalString(updatedIncome.amount), "200.10");
    assert.equal(decimalString(incomeLedger.amount), "200.10");
    assert.equal(
      await prisma.cashLedgerEntry.count({ where: { userId: ids.userId, incomeId: income.id, deletedAt: null } }),
      1,
      "Tahsilat düzenlenince duplicate ledger oluşmamalı."
    );
    assert.equal(await balance(ids.mainCashAccountId), "1200.10");

    await prisma.$transaction(async (tx) => {
      await tx.income.update({ where: { id: income.id }, data: { deletedAt: new Date() } });
      await softDeleteLedgerEntryFromIncome(ids.userId, income.id, tx);
    });

    const deletedIncome = await prisma.income.findUniqueOrThrow({ where: { id: income.id } });
    const deletedLedger = await prisma.cashLedgerEntry.findFirstOrThrow({ where: { userId: ids.userId, incomeId: income.id } });
    assert.ok(deletedIncome.deletedAt);
    assert.ok(deletedLedger.deletedAt);
    assert.equal(await balance(ids.mainCashAccountId), "1000.00");

    const dashboard = await getDashboardSummary(ids.userId);
    const report = await getReportSummary({ userId: ids.userId, startDate: todayInput, endDate: todayInput });
    assert.equal(dashboard.todayFinance.collectionTotal, 0);
    assert.equal(report.totalIncome, 0);
  });

  await t.test("gider create/update/delete ledger ve rapor toplamlarını doğru etkiler", async () => {
    const ids = requireFixtureIds();

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          userId: ids.userId,
          clientId: ids.clientId,
          caseFileId: ids.caseFileId,
          cashAccountId: ids.mainCashAccountId,
          amount: decimal("80.25"),
          currency: "TRY",
          date: today,
          paymentMethod: "BANK_TRANSFER",
          category: "OFFICE",
          isClientExpense: true,
          description: "RC1 finans doğruluk gideri"
        }
      });
      await syncExpenseLedgerEntry(ids.userId, created, tx);
      return created;
    });

    let expenseLedger = await prisma.cashLedgerEntry.findFirstOrThrow({
      where: { userId: ids.userId, expenseId: expense.id, deletedAt: null }
    });
    assert.equal(expenseLedger.direction, "OUT");
    assert.equal(expenseLedger.entryType, "EXPENSE");
    assert.equal(decimalString(expenseLedger.amount), "80.25");
    assert.equal(await balance(ids.mainCashAccountId), "919.75");

    const updatedExpense = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: { amount: decimal("120.75"), description: "RC1 finans doğruluk gideri güncellendi" }
      });
      await syncExpenseLedgerEntry(ids.userId, updated, tx);
      return updated;
    });

    expenseLedger = await prisma.cashLedgerEntry.findFirstOrThrow({
      where: { userId: ids.userId, expenseId: updatedExpense.id, deletedAt: null }
    });
    assert.equal(decimalString(updatedExpense.amount), "120.75");
    assert.equal(decimalString(expenseLedger.amount), "120.75");
    assert.equal(
      await prisma.cashLedgerEntry.count({ where: { userId: ids.userId, expenseId: expense.id, deletedAt: null } }),
      1,
      "Gider düzenlenince duplicate ledger oluşmamalı."
    );
    assert.equal(await balance(ids.mainCashAccountId), "879.25");

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } });
      await softDeleteLedgerEntryFromExpense(ids.userId, expense.id, tx);
    });

    const deletedExpense = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
    const deletedLedger = await prisma.cashLedgerEntry.findFirstOrThrow({ where: { userId: ids.userId, expenseId: expense.id } });
    assert.ok(deletedExpense.deletedAt);
    assert.ok(deletedLedger.deletedAt);
    assert.equal(await balance(ids.mainCashAccountId), "1000.00");

    const dashboard = await getDashboardSummary(ids.userId);
    const report = await getReportSummary({ userId: ids.userId, startDate: todayInput, endDate: todayInput });
    assert.equal(dashboard.todayFinance.expenseTotal, 0);
    assert.equal(report.totalExpense, 0);
  });

  await t.test("kasa transferi gelir/gideri şişirmez ve toplam kasa değişmez", async () => {
    const ids = requireFixtureIds();
    const totalBefore = await totalCashBalance(ids.userId);
    const mainBefore = await balance(ids.mainCashAccountId);
    const transferBefore = await balance(ids.transferCashAccountId);

    const transfer = await createCashTransfer(ids.userId, {
      fromAccountId: ids.mainCashAccountId,
      toAccountId: ids.transferCashAccountId,
      amount: "75.50",
      currency: "TRY",
      date: today,
      description: "RC1 transfer doğruluk testi"
    });

    const transferEntries = await prisma.cashLedgerEntry.findMany({
      where: { userId: ids.userId, referenceNo: transfer.id, entryType: "TRANSFER", deletedAt: null },
      orderBy: { direction: "asc" }
    });
    assert.equal(transferEntries.length, 2);
    assert.ok(transferEntries.some((entry) => entry.direction === "OUT" && entry.cashAccountId === ids.mainCashAccountId));
    assert.ok(transferEntries.some((entry) => entry.direction === "IN" && entry.cashAccountId === ids.transferCashAccountId));
    assert.equal(await balance(ids.mainCashAccountId), decimal(mainBefore).minus("75.50").toFixed(2));
    assert.equal(await balance(ids.transferCashAccountId), decimal(transferBefore).plus("75.50").toFixed(2));
    assert.equal(await totalCashBalance(ids.userId), totalBefore);

    const report = await getReportSummary({ userId: ids.userId, startDate: todayInput, endDate: todayInput });
    assert.equal(report.totalIncome, 0);
    assert.equal(report.totalExpense, 0);
  });

  await t.test("banka import staging yazar, onaysız finans kaydı oluşturmaz ve duplicate import engeller", async () => {
    const ids = requireFixtureIds();
    const beforeIncomeCount = await prisma.income.count({ where: { userId: ids.userId } });
    const beforeExpenseCount = await prisma.expense.count({ where: { userId: ids.userId } });
    const file = createBankCsvFile("import");

    const result = await createBankStatementImport(ids.userId, file, {
      bankName: `RC1 Banka ${runId}`,
      cashAccountId: ids.mainCashAccountId,
      currency: "TRY",
      periodStart: todayInput,
      periodEnd: todayInput,
      mapping: {
        date: "Tarih",
        description: "Açıklama",
        debit: "Borç",
        credit: "Alacak",
        balance: "Bakiye"
      },
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      thousandSeparator: ",",
      delimiter: ","
    });

    const bankImport = await prisma.bankStatementImport.findUniqueOrThrow({ where: { id: result.id } });
    const rows = await prisma.bankStatementRow.findMany({ where: { userId: ids.userId, importId: bankImport.id }, orderBy: { rowNumber: "asc" } });
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.status === "SUCCESS").length, 2);
    assert.equal(await prisma.income.count({ where: { userId: ids.userId } }), beforeIncomeCount);
    assert.equal(await prisma.expense.count({ where: { userId: ids.userId } }), beforeExpenseCount);

    await assert.rejects(
      () =>
        createBankStatementImport(ids.userId, createBankCsvFile("import"), {
          bankName: `RC1 Banka ${runId}`,
          cashAccountId: ids.mainCashAccountId,
          currency: "TRY",
          mapping: {
            date: "Tarih",
            description: "Açıklama",
            debit: "Borç",
            credit: "Alacak",
            balance: "Bakiye"
          },
          dateFormat: "YYYY-MM-DD",
          decimalSeparator: ".",
          thousandSeparator: ",",
          delimiter: ","
        }),
      /daha önce içe aktarılmış olabilir/
    );

    const rowHashCount = await prisma.bankStatementRow.count({ where: { userId: ids.userId, rawHash: rows[0].rawHash } });
    assert.equal(rowHashCount, 1);
  });

  await t.test("mutabakat tekrar eşleştirmez, geri alır ve bankadan oluşturulan kaydı rollback yapar", async () => {
    const ids = requireFixtureIds();
    const bankImport = await latestBankImport(ids.userId);
    const inRow = await prisma.bankStatementRow.findFirstOrThrow({
      where: { userId: ids.userId, importId: bankImport.id, direction: "IN" },
      orderBy: { rowNumber: "asc" }
    });
    const outRow = await prisma.bankStatementRow.findFirstOrThrow({
      where: { userId: ids.userId, importId: bankImport.id, direction: "OUT" },
      orderBy: { rowNumber: "asc" }
    });

    const candidateLedger = await prisma.cashLedgerEntry.create({
      data: {
        userId: ids.userId,
        cashAccountId: ids.transferCashAccountId,
        direction: "IN",
        entryType: "ADJUSTMENT",
        amount: decimal("333.33"),
        currency: "TRY",
        date: today,
        description: "RC1 mutabakat aday hareketi"
      }
    });

    const matched = await matchBankStatementRow({
      userId: ids.userId,
      bankRowId: inRow.id,
      targetType: "LEDGER",
      targetId: candidateLedger.id,
      matchMode: "MANUALLY_MATCHED"
    });
    assert.equal(matched.matchType, "MANUALLY_MATCHED");
    assert.equal(matched.matchedCashLedgerEntryId, candidateLedger.id);

    await assert.rejects(
      () =>
        matchBankStatementRow({
          userId: ids.userId,
          bankRowId: inRow.id,
          targetType: "LEDGER",
          targetId: candidateLedger.id,
          matchMode: "MANUALLY_MATCHED"
        }),
      /zaten eşleştirilmiş/
    );

    const unmatched = await unmatchBankStatementRow(ids.userId, inRow.id);
    assert.equal(unmatched.matchType, "NONE");
    assert.equal(unmatched.matchedCashLedgerEntryId, null);
    const candidateAfterUndo = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: candidateLedger.id } });
    assert.equal(candidateAfterUndo.deletedAt, null);

    const createdFromBank = await createRecordFromBankRow({
      userId: ids.userId,
      bankRowId: outRow.id,
      kind: "EXPENSE",
      cashAccountId: ids.mainCashAccountId,
      amount: "50.00",
      currency: "TRY",
      date: todayInput,
      description: "Bankadan oluşturulan RC1 gideri",
      expenseCategory: "OFFICE",
      isClientExpense: false
    });
    assert.equal(createdFromBank.matchType, "CREATED_FROM_BANK");
    assert.ok(createdFromBank.matchedExpenseId);
    assert.ok(createdFromBank.matchedCashLedgerEntryId);

    const rollback = await unmatchBankStatementRow(ids.userId, outRow.id);
    assert.equal(rollback.matchType, "NONE");

    const rolledBackExpense = await prisma.expense.findUniqueOrThrow({ where: { id: createdFromBank.matchedExpenseId ?? "" } });
    const rolledBackLedger = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: createdFromBank.matchedCashLedgerEntryId ?? "" } });
    assert.ok(rolledBackExpense.deletedAt);
    assert.ok(rolledBackLedger.deletedAt);
  });

  await t.test("sermaye hesabı borcu negatif sayar, değerleme geçmişini korur ve bağlı kasayı çift saymaz", async () => {
    const ids = requireFixtureIds();
    const linkedCashBalance = await balance(ids.mainCashAccountId);

    const linkedAsset = await createAssetAccount(ids.userId, {
      name: `Bağlı kasa varlığı ${runId}`,
      assetType: "CASH",
      currency: "TRY",
      symbol: "TRY",
      manualTotalValue: "999999.00",
      valuationCurrency: "TRY",
      linkedCashAccountId: ids.mainCashAccountId,
      description: "Manuel değer kasa bakiyesiyle override edilmelidir."
    });
    const goldAsset = await createAssetAccount(ids.userId, {
      name: `Altın varlığı ${runId}`,
      assetType: "GOLD",
      currency: "TRY",
      symbol: "XAU",
      manualTotalValue: "1000.00",
      valuationCurrency: "TRY"
    });
    const debtAsset = await createAssetAccount(ids.userId, {
      name: `Borç varlığı ${runId}`,
      assetType: "DEBT",
      currency: "TRY",
      symbol: "BORC",
      manualTotalValue: "500.00",
      valuationCurrency: "TRY"
    });

    const goldValuationsBefore = await prisma.assetValuation.count({ where: { userId: ids.userId, assetAccountId: goldAsset.id } });
    await createAssetValuation(ids.userId, {
      assetAccountId: goldAsset.id,
      valuationDate: todayInput,
      totalValue: "1200.00",
      valuationCurrency: "TRY",
      source: "MANUAL",
      note: "RC1 değerleme güncellemesi"
    });
    const goldValuationsAfter = await prisma.assetValuation.count({ where: { userId: ids.userId, assetAccountId: goldAsset.id } });
    assert.equal(goldValuationsAfter, goldValuationsBefore + 1);

    const capital = await getCapitalCenterData(ids.userId, "TRY");
    const linkedAssetRow = capital.assets.find((asset) => asset.id === linkedAsset.id);
    const goldAssetRow = capital.assets.find((asset) => asset.id === goldAsset.id);
    const debtAssetRow = capital.assets.find((asset) => asset.id === debtAsset.id);
    assert.ok(linkedAssetRow);
    assert.ok(goldAssetRow);
    assert.ok(debtAssetRow);
    assert.equal(linkedAssetRow.currentValue.toFixed(2), linkedCashBalance);
    assert.notEqual(linkedAssetRow.currentValue.toFixed(2), "999999.00");
    assert.equal(goldAssetRow.currentValue, 1200);
    assert.equal(debtAssetRow.currentValue, -500);
    assert.equal(capital.summary.totalAssets, decimal(linkedCashBalance).plus("1200.00").toNumber());
    assert.equal(capital.summary.totalDebts, 500);
    assert.equal(capital.summary.netWorth, decimal(linkedCashBalance).plus("1200.00").minus("500.00").toNumber());
    assert.equal(
      capital.cashAccountSuggestions.some((item) => item.cashAccountId === ids.mainCashAccountId),
      false,
      "Bağlı CashAccount sermaye önerilerinde ikinci kez gösterilmemeli."
    );
  });
});

function requireFixtureIds() {
  assert.ok(userId, "Test kullanıcısı oluşturulmadı.");
  assert.ok(clientId, "Test müvekkili oluşturulmadı.");
  assert.ok(caseFileId, "Test dosyası oluşturulmadı.");
  assert.ok(mainCashAccountId, "Ana kasa oluşturulmadı.");
  assert.ok(transferCashAccountId, "Transfer kasası oluşturulmadı.");

  return {
    userId,
    clientId,
    caseFileId,
    mainCashAccountId,
    transferCashAccountId
  };
}

async function balance(cashAccountId: string) {
  const ids = requireFixtureIds();
  const result = await getCashAccountBalance(ids.userId, cashAccountId);
  return decimal(result.balance).toFixed(2);
}

async function totalCashBalance(userId: string) {
  const balances = await getAllCashAccountBalances(userId);
  return balances.reduce((total, item) => total.plus(decimal(item.balance)), decimal("0")).toFixed(2);
}

async function latestBankImport(userId: string) {
  return prisma.bankStatementImport.findFirstOrThrow({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

function createBankCsvFile(suffix: string) {
  const rows = [
    "Tarih,Açıklama,Borç,Alacak,Bakiye",
    `${todayInput},RC1 müvekkil banka tahsilatı,,333.33,1333.33`,
    `${todayInput},RC1 ofis banka gideri,50.00,,1283.33`
  ];
  return new File([`\uFEFF${rows.join("\n")}`], `${runId}-${suffix}.csv`, { type: "text/csv" });
}

async function cleanup() {
  if (!userId) return;

  const documents = await prisma.document.findMany({
    where: { userId },
    select: { storagePath: true }
  });
  await Promise.all(
    documents.map(async (document) => {
      try {
        await rm(storage.resolvePhysicalPath(document.storagePath), { force: true });
      } catch {
        // Test temizliği dosya zaten yoksa ana sonucu etkilememeli.
      }
    })
  );

  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function decimal(value: string | number | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function decimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
