import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { prisma } from "@/lib/prisma";
import { CLOSED_BANK_MATCH_TYPES } from "@/lib/reconciliation/match-status";
import { addDays, addMonths, dateInputValue, formatDate, formatMoney, startOfDay, startOfMonth, toNumber } from "@/lib/utils";

export type DashboardV5Period = "7d" | "30d" | "3m" | "6m" | "year";

export type DashboardV5Point = {
  date: string;
  label: string;
  value: number;
};

export type DashboardV5DailyPoint = {
  date: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  receivable: number;
  unmatched: number;
};

export type DashboardV5Data = {
  referenceDate: string;
  referenceDateLabel: string;
  netWorth: number;
  netWorthLabel: string;
  netWorthPeriod: DashboardV5Period;
  netWorthTrend: DashboardV5Point[];
  controls: Array<{ label: string; detail: string; value: number; valueLabel: string; tone: "green" | "rose" | "amber" | "neutral" }>;
  today: { income: number; expense: number; net: number };
  month: { income: number; expense: number; net: number };
  openReceivable: number;
  unmatchedBankCount: number;
  daily: DashboardV5DailyPoint[];
  monthDaily: DashboardV5DailyPoint[];
};

export async function getDashboardV5Data(userId: string, netWorthPeriod: DashboardV5Period = "30d"): Promise<DashboardV5Data> {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const monthStart = startOfMonth(today);
  const monthEnd = addMonths(monthStart, 1);
  const dailyStart = addDays(today, -29);
  const snapshotStart = netWorthPeriodStart(today, netWorthPeriod);
  const activeClient = { archivedAt: null, deletedAt: null };
  const activeCase = { status: { not: "ARCHIVED" as const }, archivedAt: null, deletedAt: null };
  const incomeWhere = {
    userId,
    deletedAt: null,
    client: activeClient,
    OR: [{ caseFileId: null }, { caseFile: activeCase }]
  };
  const expenseWhere = {
    userId,
    deletedAt: null,
    AND: [
      { OR: [{ clientId: null }, { client: activeClient }] },
      { OR: [{ caseFileId: null }, { caseFile: activeCase }] }
    ]
  };
  const openDocumentWhere = {
    userId,
    deletedAt: null,
    client: activeClient,
    OR: [{ caseFileId: null }, { caseFile: activeCase }],
    status: { in: ["ISSUED" as const, "UNPAID" as const] }
  };
  const unmatchedBankWhere = {
    userId,
    deletedAt: null,
    status: "SUCCESS" as const,
    import: { deletedAt: null },
    matchType: { notIn: [...CLOSED_BANK_MATCH_TYPES] }
  };

  const [
    todayIncome,
    todayExpense,
    monthIncome,
    monthExpense,
    monthTax,
    monthReimbursable,
    openReceivable,
    dailyIncomes,
    dailyExpenses,
    recentOpenDocuments,
    unmatchedBankCount,
    recentUnmatchedRows,
    capitalSnapshots,
    capitalCenter
  ] = await Promise.all([
    prisma.income.aggregate({ where: { ...incomeWhere, date: { gte: today, lt: tomorrow } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...expenseWhere, date: { gte: today, lt: tomorrow } }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { ...incomeWhere, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...expenseWhere, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.invoiceOrReceipt.aggregate({
      where: { ...openDocumentWhere, status: { not: "CANCELLED" }, issueDate: { gte: monthStart, lt: monthEnd } },
      _sum: { vatAmount: true, withholdingAmount: true }
    }),
    prisma.expense.aggregate({ where: { ...expenseWhere, isClientExpense: true, date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.invoiceOrReceipt.aggregate({ where: openDocumentWhere, _sum: { netAmount: true } }),
    prisma.income.findMany({ where: { ...incomeWhere, date: { gte: dailyStart, lt: tomorrow } }, select: { date: true, amount: true } }),
    prisma.expense.findMany({ where: { ...expenseWhere, date: { gte: dailyStart, lt: tomorrow } }, select: { date: true, amount: true } }),
    prisma.invoiceOrReceipt.findMany({
      where: { ...openDocumentWhere, issueDate: { gte: dailyStart, lt: tomorrow } },
      select: { issueDate: true, netAmount: true }
    }),
    prisma.bankStatementRow.count({ where: unmatchedBankWhere }),
    prisma.bankStatementRow.findMany({
      where: { ...unmatchedBankWhere, transactionDate: { gte: dailyStart, lt: tomorrow } },
      select: { transactionDate: true }
    }),
    prisma.capitalSnapshot.findMany({
      where: { userId, deletedAt: null, snapshotDate: { gte: snapshotStart, lt: tomorrow } },
      orderBy: { snapshotDate: "desc" },
      take: 60,
      select: { snapshotDate: true, netWorth: true }
    }),
    getCapitalCenterData(userId, "TRY", { page: 1, pageSize: 1 })
  ]);

  const todayIncomeTotal = toNumber(todayIncome._sum.amount);
  const todayExpenseTotal = toNumber(todayExpense._sum.amount);
  const monthIncomeTotal = toNumber(monthIncome._sum.amount);
  const monthExpenseTotal = toNumber(monthExpense._sum.amount);
  const monthNet = round(monthIncomeTotal - monthExpenseTotal);
  const openReceivableTotal = toNumber(openReceivable._sum.netAmount);
  const vatTotal = toNumber(monthTax._sum.vatAmount);
  const withholdingTotal = toNumber(monthTax._sum.withholdingAmount);
  const taxControlTotal = round(vatTotal - withholdingTotal);
  const reimbursableTotal = toNumber(monthReimbursable._sum.amount);
  const investableTotal = round(Math.max(0, monthNet - Math.max(taxControlTotal, 0)));
  const currentNetWorth = capitalCenter.summary.netWorth;
  const daily = buildDailySeries({
    start: dailyStart,
    today,
    incomes: dailyIncomes,
    expenses: dailyExpenses,
    openDocuments: recentOpenDocuments,
    openReceivableTotal,
    unmatchedRows: recentUnmatchedRows,
    unmatchedBankCount
  });

  return {
    referenceDate: dateInputValue(today),
    referenceDateLabel: formatDate(today),
    netWorth: currentNetWorth,
    netWorthLabel: formatMoney(currentNetWorth),
    netWorthPeriod,
    netWorthTrend: buildNetWorthTrend(capitalSnapshots.reverse(), snapshotStart, today, currentNetWorth),
    controls: [
      {
        label: "KDV Kontrol",
        detail: `KDV ${formatMoney(vatTotal)} · Stopaj ${formatMoney(withholdingTotal)}`,
        value: taxControlTotal,
        valueLabel: formatMoney(taxControlTotal),
        tone: taxControlTotal > 0 ? "amber" : "neutral"
      },
      {
        label: "Yansıtılabilir Masraf",
        detail: "Bu ay müvekkile aktarılabilir",
        value: reimbursableTotal,
        valueLabel: formatMoney(reimbursableTotal),
        tone: reimbursableTotal > 0 ? "green" : "neutral"
      },
      {
        label: "Yatırıma Ayrılabilir",
        detail: "Aylık netten vergi kontrolü çıkarıldı",
        value: investableTotal,
        valueLabel: formatMoney(investableTotal),
        tone: investableTotal > 0 ? "green" : monthNet < 0 ? "rose" : "neutral"
      }
    ],
    today: { income: round(todayIncomeTotal), expense: round(todayExpenseTotal), net: round(todayIncomeTotal - todayExpenseTotal) },
    month: { income: round(monthIncomeTotal), expense: round(monthExpenseTotal), net: monthNet },
    openReceivable: round(openReceivableTotal),
    unmatchedBankCount,
    daily,
    monthDaily: daily.filter((point) => point.date >= dateInputValue(monthStart))
  };
}

function buildDailySeries({
  start,
  today,
  incomes,
  expenses,
  openDocuments,
  openReceivableTotal,
  unmatchedRows,
  unmatchedBankCount
}: {
  start: Date;
  today: Date;
  incomes: Array<{ date: Date; amount: unknown }>;
  expenses: Array<{ date: Date; amount: unknown }>;
  openDocuments: Array<{ issueDate: Date; netAmount: unknown }>;
  openReceivableTotal: number;
  unmatchedRows: Array<{ transactionDate: Date | null }>;
  unmatchedBankCount: number;
}) {
  const incomeByDay = sumByDay(incomes.map((row) => ({ date: row.date, value: toNumber(row.amount) })));
  const expenseByDay = sumByDay(expenses.map((row) => ({ date: row.date, value: toNumber(row.amount) })));
  const receivableByDay = sumByDay(openDocuments.map((row) => ({ date: row.issueDate, value: toNumber(row.netAmount) })));
  const unmatchedByDay = countByDay(unmatchedRows.flatMap((row) => (row.transactionDate ? [row.transactionDate] : [])));
  let receivableRunning = Math.max(0, openReceivableTotal - [...receivableByDay.values()].reduce((sum, value) => sum + value, 0));
  let unmatchedRunning = Math.max(0, unmatchedBankCount - [...unmatchedByDay.values()].reduce((sum, value) => sum + value, 0));
  const days = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1);

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const key = dateInputValue(date);
    const income = round(incomeByDay.get(key) ?? 0);
    const expense = round(expenseByDay.get(key) ?? 0);
    receivableRunning = round(receivableRunning + (receivableByDay.get(key) ?? 0));
    unmatchedRunning += unmatchedByDay.get(key) ?? 0;
    return {
      date: key,
      label: date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
      income,
      expense,
      net: round(income - expense),
      receivable: receivableRunning,
      unmatched: unmatchedRunning
    };
  });
}

function buildNetWorthTrend(snapshots: Array<{ snapshotDate: Date; netWorth: unknown }>, periodStart: Date, today: Date, currentNetWorth: number) {
  const points = snapshots.map((row) => ({
    date: dateInputValue(row.snapshotDate),
    label: formatDate(row.snapshotDate),
    value: round(toNumber(row.netWorth))
  }));
  const todayKey = dateInputValue(today);
  const withoutToday = points.filter((point) => point.date !== todayKey);
  const selected = [...withoutToday, { date: todayKey, label: formatDate(today), value: round(currentNetWorth) }].slice(-60);
  if (selected.length > 1) return selected;
  const point = selected[0] ?? { date: todayKey, label: formatDate(today), value: round(currentNetWorth) };
  return [{ date: dateInputValue(periodStart), label: formatDate(periodStart), value: point.value }, point];
}

function netWorthPeriodStart(today: Date, period: DashboardV5Period) {
  if (period === "7d") return addDays(today, -6);
  if (period === "30d") return addDays(today, -29);
  if (period === "3m") return addMonths(today, -3);
  if (period === "6m") return addMonths(today, -6);
  return startOfDay(new Date(today.getFullYear(), 0, 1));
}

export function parseDashboardV5Period(value?: string): DashboardV5Period {
  return value === "7d" || value === "3m" || value === "6m" || value === "year" ? value : "30d";
}

function sumByDay(rows: Array<{ date: Date; value: number }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = dateInputValue(row.date);
    map.set(key, round((map.get(key) ?? 0) + row.value));
  }
  return map;
}

function countByDay(rows: Date[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = dateInputValue(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
