import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { prisma } from "@/lib/prisma";
import { CLOSED_BANK_MATCH_TYPES } from "@/lib/reconciliation/match-status";
import { addDays, addMonths, formatDate, formatMoney, startOfDay, startOfMonth, toNumber } from "@/lib/utils";

export type DashboardV3Data = {
  smartAlerts: {
    unmatchedBankRows: number;
    balanceDifference: number;
    balanceDifferenceLabel: string;
    balanceDifferenceStatus: "ok" | "warning" | "danger";
    balanceDifferenceDetail: string;
    upcomingExpenseReminderCount: number;
    upcomingExpenseReminderTotal: number;
    upcomingExpenseReminderTotalLabel: string;
    highExpenseCount: number;
    highExpenseTotal: number;
    highExpenseTotalLabel: string;
    undocumentedExpenseCount: number;
    undocumentedIncomeCount: number;
    pendingReconciliationCount: number;
  };
  documentStatus: {
    total: number;
    uploadedThisMonth: number;
    waitingProcessing: number;
    linkedToIncomes: number;
    linkedToExpenses: number;
    unlinked: number;
  };
  bankAnalysis: {
    lastImportLabel: string;
    lastImportDetail: string;
    totalIn: number;
    totalInLabel: string;
    totalOut: number;
    totalOutLabel: string;
    net: number;
    netLabel: string;
    unmatchedCount: number;
  };
  capitalSummary: {
    netWorth: number;
    netWorthLabel: string;
    cashBankTotal: number;
    cashBankTotalLabel: string;
    fxTotal: number;
    fxTotalLabel: string;
    goldTotal: number;
    goldTotalLabel: string;
    stockTotal: number;
    stockTotalLabel: string;
    cryptoTotal: number;
    cryptoTotalLabel: string;
    totalDebts: number;
    totalDebtsLabel: string;
    assetTypeDistribution: { label: string; value: number; valueLabel: string; percent: number }[];
  };
};

const HIGH_EXPENSE_THRESHOLD = 10000;

export async function getDashboardV3Data(userId: string): Promise<DashboardV3Data> {
  const today = startOfDay();
  const threeDaysLater = addDays(today, 3);
  const monthStart = startOfMonth(today);
  const last12MonthsStart = addMonths(monthStart, -11);

  const [
    documentStatus,
    bankInAggregate,
    bankOutAggregate,
    bankUnmatchedLast12Months,
    lastImport,
    latestImportsWithBalances,
    cashBalances,
    upcomingExpenseReminderAggregate,
    highExpenses,
    undocumentedExpenseCount,
    undocumentedIncomeCount,
    pendingReconciliationCount,
    unmatchedBankRows,
    capitalCenter
  ] = await Promise.all([
    getDocumentStatus(userId, monthStart),
    prisma.bankStatementRow.aggregate({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        transactionDate: { gte: last12MonthsStart },
        direction: "IN",
        import: { deletedAt: null }
      },
      _sum: {
        amount: true,
        creditAmount: true
      }
    }),
    prisma.bankStatementRow.aggregate({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        transactionDate: { gte: last12MonthsStart },
        direction: "OUT",
        import: { deletedAt: null }
      },
      _sum: {
        amount: true,
        debitAmount: true
      }
    }),
    prisma.bankStatementRow.count({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        transactionDate: { gte: last12MonthsStart },
        import: { deletedAt: null },
        matchType: { notIn: [...CLOSED_BANK_MATCH_TYPES] }
      }
    }),
    prisma.bankStatementImport.findFirst({
      where: { userId, deletedAt: null },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: { bankName: true, originalFileName: true, periodEnd: true, createdAt: true }
    }),
    prisma.bankStatementImport.findMany({
      where: {
        userId,
        deletedAt: null,
        cashAccountId: { not: null },
        closingBalance: { not: null }
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: { cashAccountId: true, closingBalance: true, currency: true, periodEnd: true, createdAt: true },
      take: 200
    }),
    getAllCashAccountBalances(userId),
    prisma.taskReminder.aggregate({
      where: {
        userId,
        deletedAt: null,
        status: "OPEN",
        reminderType: { in: ["EXPENSE", "TAX", "INVOICE"] },
        dueDate: { gte: today, lte: threeDaysLater }
      },
      _count: { _all: true },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: {
        userId,
        deletedAt: null,
        date: { gte: monthStart },
        amount: { gte: HIGH_EXPENSE_THRESHOLD }
      },
      _count: { _all: true },
      _sum: { amount: true }
    }),
    prisma.expense.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } }
      }
    }),
    prisma.income.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } }
      }
    }),
    prisma.bankStatementRow.count({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        import: { deletedAt: null },
        matchType: { notIn: [...CLOSED_BANK_MATCH_TYPES] }
      }
    }),
    prisma.bankStatementRow.count({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        import: { deletedAt: null },
        matchType: { notIn: [...CLOSED_BANK_MATCH_TYPES] }
      }
    }),
    getCapitalCenterData(userId)
  ]);

  const bankAnalysis = summarizeBankAggregates(bankInAggregate, bankOutAggregate, bankUnmatchedLast12Months);
  const balanceDifference = calculateLatestBalanceDifference(latestImportsWithBalances, cashBalances);
  const upcomingExpenseReminderTotal = toNumber(upcomingExpenseReminderAggregate._sum.amount);
  const highExpenseTotal = toNumber(highExpenses._sum.amount);

  return {
    smartAlerts: {
      unmatchedBankRows,
      balanceDifference: balanceDifference.value,
      balanceDifferenceLabel: formatMoney(balanceDifference.value, balanceDifference.currency),
      balanceDifferenceStatus: balanceDifferenceStatus(balanceDifference.value),
      balanceDifferenceDetail: balanceDifference.detail,
      upcomingExpenseReminderCount: upcomingExpenseReminderAggregate._count._all,
      upcomingExpenseReminderTotal,
      upcomingExpenseReminderTotalLabel: formatMoney(upcomingExpenseReminderTotal),
      highExpenseCount: highExpenses._count._all,
      highExpenseTotal,
      highExpenseTotalLabel: formatMoney(highExpenseTotal),
      undocumentedExpenseCount,
      undocumentedIncomeCount,
      pendingReconciliationCount
    },
    documentStatus,
    bankAnalysis: {
      lastImportLabel: lastImport ? formatDate(lastImport.periodEnd ?? lastImport.createdAt) : "Henüz import yok",
      lastImportDetail: lastImport ? `${lastImport.bankName} · ${lastImport.originalFileName}` : "Banka ekstresi yüklendiğinde burada görünür.",
      totalIn: bankAnalysis.totalIn,
      totalInLabel: formatMoney(bankAnalysis.totalIn),
      totalOut: bankAnalysis.totalOut,
      totalOutLabel: formatMoney(bankAnalysis.totalOut),
      net: bankAnalysis.net,
      netLabel: formatMoney(bankAnalysis.net),
      unmatchedCount: bankAnalysis.unmatchedCount
    },
    capitalSummary: {
      netWorth: capitalCenter.summary.netWorth,
      netWorthLabel: capitalCenter.summary.netWorthLabel,
      cashBankTotal: capitalCenter.summary.cashBankTotal,
      cashBankTotalLabel: capitalCenter.summary.cashBankTotalLabel,
      fxTotal: capitalCenter.summary.fxTotal,
      fxTotalLabel: capitalCenter.summary.fxTotalLabel,
      goldTotal: capitalCenter.summary.goldTotal,
      goldTotalLabel: capitalCenter.summary.goldTotalLabel,
      stockTotal: capitalCenter.summary.stockTotal,
      stockTotalLabel: capitalCenter.summary.stockTotalLabel,
      cryptoTotal: capitalCenter.summary.cryptoTotal,
      cryptoTotalLabel: capitalCenter.summary.cryptoTotalLabel,
      totalDebts: capitalCenter.summary.totalDebts,
      totalDebtsLabel: capitalCenter.summary.totalDebtsLabel,
      assetTypeDistribution: serializeCapitalDistribution(capitalCenter.assetTypeDistribution, capitalCenter.currency)
    }
  };
}

async function getDocumentStatus(userId: string, monthStart: Date) {
  const [total, uploadedThisMonth, waitingProcessing, linkedToIncomes, linkedToExpenses, unlinked] = await Promise.all([
    prisma.document.count({ where: { userId, deletedAt: null } }),
    prisma.document.count({ where: { userId, deletedAt: null, uploadedAt: { gte: monthStart } } }),
    prisma.document.count({
      where: {
        userId,
        deletedAt: null,
        extractionStatus: { in: ["NOT_PROCESSED", "PROCESSING"] }
      }
    }),
    prisma.document.count({ where: { userId, deletedAt: null, linkedIncomeId: { not: null } } }),
    prisma.document.count({ where: { userId, deletedAt: null, linkedExpenseId: { not: null } } }),
    prisma.document.count({
      where: {
        userId,
        deletedAt: null,
        linkedClientId: null,
        linkedCaseFileId: null,
        linkedIncomeId: null,
        linkedExpenseId: null,
        linkedInvoiceOrReceiptId: null,
        linkedCashLedgerEntryId: null
      }
    })
  ]);

  return {
    total,
    uploadedThisMonth,
    waitingProcessing,
    linkedToIncomes,
    linkedToExpenses,
    unlinked
  };
}

function summarizeBankAggregates(
  bankInAggregate: { _sum: { amount: unknown; creditAmount: unknown } },
  bankOutAggregate: { _sum: { amount: unknown; debitAmount: unknown } },
  unmatchedCount: number
) {
  const totalIn = round(sumPreferredAmount(bankInAggregate._sum.creditAmount, bankInAggregate._sum.amount));
  const totalOut = round(sumPreferredAmount(bankOutAggregate._sum.debitAmount, bankOutAggregate._sum.amount));

  return {
    totalIn,
    totalOut,
    net: round(totalIn - totalOut),
    unmatchedCount
  };
}

function sumPreferredAmount(primary: unknown, fallback: unknown) {
  const primaryValue = Math.abs(toNumber(primary));
  if (primaryValue > 0) return primaryValue;
  return Math.abs(toNumber(fallback));
}

function calculateLatestBalanceDifference(
  imports: { cashAccountId: string | null; closingBalance: unknown; currency: string; periodEnd: Date | null; createdAt: Date }[],
  cashBalances: { accountId: string; balance: number; currency: string }[]
) {
  const balanceMap = new Map(cashBalances.map((balance) => [balance.accountId, balance]));
  const latestByAccount = new Map<string, (typeof imports)[number]>();

  for (const item of imports) {
    if (!item.cashAccountId || latestByAccount.has(item.cashAccountId)) continue;
    latestByAccount.set(item.cashAccountId, item);
  }

  const currency = latestPreferredCurrency([...latestByAccount.values()], cashBalances);
  let bankBalance = 0;
  let systemBalance = 0;
  let comparedAccountCount = 0;

  for (const item of latestByAccount.values()) {
    const accountBalance = item.cashAccountId ? balanceMap.get(item.cashAccountId) : null;
    if (!accountBalance || item.currency.toUpperCase() !== currency || accountBalance.currency.toUpperCase() !== currency) {
      continue;
    }

    bankBalance += toNumber(item.closingBalance);
    systemBalance += accountBalance.balance;
    comparedAccountCount += 1;
  }

  const value = round(bankBalance - systemBalance);
  return {
    value,
    currency,
    detail:
      comparedAccountCount > 0
        ? `${comparedAccountCount} kasa hesabının son ekstre kapanış bakiyesiyle karşılaştırıldı.`
        : "Kapanış bakiyesi olan banka ekstresi bulununca fark hesaplanır."
  };
}

function latestPreferredCurrency(
  imports: { currency: string }[],
  cashBalances: { currency: string }[]
) {
  const importCurrencies = new Set(imports.map((item) => item.currency.toUpperCase()));
  if (importCurrencies.has("TRY")) return "TRY";
  const balanceCurrencies = new Set(cashBalances.map((item) => item.currency.toUpperCase()));
  if (balanceCurrencies.has("TRY")) return "TRY";
  return imports[0]?.currency.toUpperCase() ?? cashBalances[0]?.currency.toUpperCase() ?? "TRY";
}

function balanceDifferenceStatus(value: number): DashboardV3Data["smartAlerts"]["balanceDifferenceStatus"] {
  const absoluteValue = Math.abs(value);
  if (absoluteValue < 1) return "ok";
  if (absoluteValue < 1000) return "warning";
  return "danger";
}

function serializeCapitalDistribution(items: { label: string; value: number }[], currency: string) {
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  return items
    .filter((item) => item.value > 0)
    .slice(0, 6)
    .map((item) => ({
      label: item.label,
      value: round(item.value),
      valueLabel: formatMoney(item.value, currency),
      percent: total > 0 ? round((item.value / total) * 100) : 0
    }));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
