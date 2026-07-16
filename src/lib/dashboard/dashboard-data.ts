import { cache } from "react";

import { auditActionLabels, auditEntityLabels } from "@/lib/audit";
import { getLedgerEntries } from "@/lib/cash/cash-ledger-service";
import {
  cashLedgerDirectionLabels,
  cashLedgerEntryTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  receiptStatusLabels,
  receiptTypeLabels,
  reminderPriorityLabels,
  reminderTypeLabels
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  dateInputValue,
  formatDate,
  formatDirectionalMoney,
  formatMoney,
  formatSignedMoney,
  monthLabel,
  startOfDay,
  startOfMonth,
  toNumber
} from "@/lib/utils";

export type DashboardFlowPoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net: number;
};

export type DashboardSeriesPoint = {
  label: string;
  value: number;
};

export type DashboardTickerItem = {
  label: string;
  value: string;
  tone: "green" | "rose" | "amber" | "neutral";
};

export type DashboardRecentActivityItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  value?: string;
  badge?: string;
  tone?: "green" | "rose" | "amber" | "neutral";
};

export type DashboardMetricDrilldownItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  value: string;
  tone: "green" | "rose" | "amber" | "neutral";
  href: string;
};

export type DashboardReminderItem = {
  id: string;
  title: string;
  description: string;
  dueDateLabel: string;
  reminderTypeLabel: string;
  amountLabel: string;
  context: string;
  stateLabel: string;
  stateTone: "green" | "rose" | "amber" | "neutral";
};

export type TopBalanceClient = {
  id: string;
  name: string;
  balance: number;
  balanceLabel: string;
  openDocumentTotal: number;
  openDocumentTotalLabel: string;
  clientExpenseTotal: number;
  clientExpenseTotalLabel: string;
  advanceTotal: number;
  advanceTotalLabel: string;
};

export async function getDashboardSummary(userId: string) {
  const core = await getDashboardCoreData(userId);
  const todayFinance = totalsFromAggregates(core.todayCollections, core.todayExpenses);
  const monthlyFinance = totalsFromAggregates(core.monthCollections, core.monthExpenses);
  const openReceivableTotal = toNumber(core.openReceivables._sum.netAmount);
  const unpaidDocumentAmount = toNumber(core.unpaidDocumentTotal._sum.netAmount);
  const monthVatTotal = toNumber(core.monthDocumentTax._sum.vatAmount);
  const monthWithholdingTotal = toNumber(core.monthDocumentTax._sum.withholdingAmount);
  const taxControlTotal = monthVatTotal - monthWithholdingTotal;
  const investableEstimate = Math.max(0, monthlyFinance.net - Math.max(taxControlTotal, 0));

  return {
    todayLabel: formatDate(core.now),
    todayFinance,
    monthlyFinance,
    openReceivableTotal,
    openReceivableTotalLabel: formatMoney(openReceivableTotal),
    unpaidDocumentAmount,
    unpaidDocumentAmountLabel: formatMoney(unpaidDocumentAmount),
    unpaidDocumentCount: core.unpaidDocumentCount,
    monthVatTotal,
    monthVatTotalLabel: formatMoney(monthVatTotal),
    monthWithholdingTotal,
    monthWithholdingTotalLabel: formatMoney(monthWithholdingTotal),
    taxControlTotal,
    taxControlTotalLabel: formatMoney(taxControlTotal),
    investableEstimate,
    investableEstimateLabel: formatMoney(investableEstimate),
    monthReimbursableExpenseTotal: toNumber(core.monthReimbursableExpenses._sum.amount),
    monthReimbursableExpenseTotalLabel: formatMoney(core.monthReimbursableExpenses._sum.amount)
  };
}

export async function getTodayFinance(userId: string) {
  const core = await getDashboardCoreData(userId);
  return totalsFromAggregates(core.todayCollections, core.todayExpenses);
}

export async function getMonthlyFinance(userId: string) {
  const core = await getDashboardCoreData(userId);
  return totalsFromAggregates(core.monthCollections, core.monthExpenses);
}

export async function getLast7DaysTrend(userId: string): Promise<DashboardFlowPoint[]> {
  const core = await getDashboardCoreData(userId);
  return buildDailyFlow(core.lastSevenStart, core.today, core.chartIncomes, core.chartExpenses);
}

export async function getCurrentMonthCashFlow(userId: string): Promise<DashboardFlowPoint[]> {
  const core = await getDashboardCoreData(userId);
  return buildDailyFlow(core.month, core.today, core.chartIncomes, core.chartExpenses);
}

export async function getFinanceTickerData(userId: string): Promise<DashboardTickerItem[]> {
  const [summary, reminders] = await Promise.all([getDashboardSummary(userId), getDashboardReminders(userId)]);
  const todayFinance = summary.todayFinance;
  const monthlyFinance = summary.monthlyFinance;

  return [
    { label: "Bugün tahsilat", value: formatSignedMoney(todayFinance.collectionTotal), tone: "green" },
    { label: "Bugün gider", value: formatSignedMoney(-todayFinance.expenseTotal), tone: "rose" },
    { label: "Bu ay net", value: formatSignedMoney(monthlyFinance.net), tone: monthlyFinance.net >= 0 ? "green" : "rose" },
    {
      label: "3 gün içinde gider",
      value: formatSignedMoney(-reminders.upcomingExpenseTotal),
      tone: reminders.upcomingExpenseTotal > 0 ? "rose" : "green"
    },
    {
      label: "Gecikmiş hatırlatma",
      value: `${reminders.overdueCount} adet`,
      tone: reminders.overdueCount > 0 ? "rose" : "green"
    },
    {
      label: "Ödenmemiş belge",
      value: `${formatSignedMoney(summary.unpaidDocumentAmount)} · ${summary.unpaidDocumentCount}`,
      tone: summary.unpaidDocumentAmount > 0 ? "green" : "neutral"
    }
  ];
}

export const getTopBalanceClients = cache(async (userId: string): Promise<TopBalanceClient[]> => {
  const activeCaseWhere = { status: { not: "ARCHIVED" as const }, archivedAt: null, deletedAt: null };
  const [openDocuments, reimbursableExpenses, advanceIncomes] = await Promise.all([
    prisma.invoiceOrReceipt.groupBy({
      by: ["clientId"],
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }],
        status: { in: ["ISSUED", "UNPAID"] }
      },
      _sum: { netAmount: true }
    }),
    prisma.expense.groupBy({
      by: ["clientId"],
      where: {
        userId,
        deletedAt: null,
        clientId: { not: null },
        isClientExpense: true,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }]
      },
      _sum: { amount: true }
    }),
    prisma.income.groupBy({
      by: ["clientId"],
      where: {
        userId,
        deletedAt: null,
        category: "ADVANCE",
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }]
      },
      _sum: { amount: true }
    })
  ]);
  const grouped = new Map<string, { openDocumentTotal: number; clientExpenseTotal: number; advanceTotal: number }>();

  for (const row of openDocuments) {
    grouped.set(row.clientId, {
      ...(grouped.get(row.clientId) ?? emptyClientBalanceParts()),
      openDocumentTotal: toNumber(row._sum.netAmount)
    });
  }

  for (const row of reimbursableExpenses) {
    if (!row.clientId) continue;
    grouped.set(row.clientId, {
      ...(grouped.get(row.clientId) ?? emptyClientBalanceParts()),
      clientExpenseTotal: toNumber(row._sum.amount)
    });
  }

  for (const row of advanceIncomes) {
    grouped.set(row.clientId, {
      ...(grouped.get(row.clientId) ?? emptyClientBalanceParts()),
      advanceTotal: toNumber(row._sum.amount)
    });
  }

  const ranked = [...grouped.entries()]
    .map(([clientId, totals]) => ({
      clientId,
      ...totals,
      balance: totals.openDocumentTotal + totals.clientExpenseTotal - totals.advanceTotal
    }))
    .filter((row) => row.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5);
  const clients = await prisma.client.findMany({
    where: { userId, id: { in: ranked.map((row) => row.clientId) }, archivedAt: null, deletedAt: null },
    select: { id: true, name: true }
  });
  const clientMap = new Map(clients.map((client) => [client.id, client.name]));

  return ranked
    .filter((row) => clientMap.has(row.clientId))
    .map((row) => ({
      id: row.clientId,
      name: clientMap.get(row.clientId) ?? "-",
      balance: row.balance,
      balanceLabel: formatMoney(row.balance),
      openDocumentTotal: row.openDocumentTotal,
      openDocumentTotalLabel: formatMoney(row.openDocumentTotal),
      clientExpenseTotal: row.clientExpenseTotal,
      clientExpenseTotalLabel: formatMoney(row.clientExpenseTotal),
      advanceTotal: row.advanceTotal,
      advanceTotalLabel: formatMoney(row.advanceTotal)
    }));
});

export async function getRecentTransactions(userId: string) {
  const core = await getDashboardCoreData(userId);

  return {
    incomeActivityItems: core.latestIncomes.map((income) => ({
      id: income.id,
      title: income.client.name,
      description: `${incomeCategoryLabels[income.category]}${income.caseFile ? ` · ${income.caseFile.title}` : ""}`,
      meta: formatDate(income.date),
      value: formatDirectionalMoney(income.amount, "IN", income.currency),
      tone: "green" as const
    })),
    expenseActivityItems: core.latestExpenses.map((expense) => ({
      id: expense.id,
      title: expense.client?.name ?? "Genel gider",
      description: `${expenseCategoryLabels[expense.category]}${expense.caseFile ? ` · ${expense.caseFile.title}` : ""}`,
      meta: formatDate(expense.date),
      value: formatDirectionalMoney(expense.amount, "OUT", expense.currency),
      tone: "rose" as const
    })),
    auditActivityItems: core.latestAuditLogs.map((log) => ({
      id: log.id,
      title: auditEntityLabels[log.entityType],
      description: log.message ?? "İşlem kaydı oluşturuldu",
      meta: formatDate(log.createdAt),
      badge: auditActionLabels[log.action],
      tone: "neutral" as const
    }))
  };
}

export async function getDashboardMetricDrilldowns(userId: string) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const month = startOfMonth(today);
  const todayInput = dateInputValue(today);
  const monthInput = dateInputValue(month);
  const activeCaseWhere = { status: { not: "ARCHIVED" as const }, archivedAt: null, deletedAt: null };
  const activeClientWhere = { archivedAt: null, deletedAt: null };
  const [
    todayIncomes,
    todayExpenses,
    todayCashMovements,
    monthCashMovements,
    upcomingExpenseReminders,
    overdueReminders,
    openReceivableDocuments
  ] = await Promise.all([
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        client: activeClientWhere,
        OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }],
        date: { gte: today, lt: tomorrow }
      },
      take: 5,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        createdAt: true,
        category: true,
        client: { select: { name: true } },
        caseFile: { select: { title: true } }
      }
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: activeClientWhere }] },
          { OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }] }
        ],
        date: { gte: today, lt: tomorrow }
      },
      take: 5,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        createdAt: true,
        category: true,
        client: { select: { name: true } },
        caseFile: { select: { title: true } }
      }
    }),
    getLedgerEntries({ userId, startDate: todayInput, endDate: todayInput, take: 10 }),
    getLedgerEntries({ userId, startDate: monthInput, endDate: todayInput, take: 10 }),
    prisma.taskReminder.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "OPEN",
        notificationEnabled: true,
        reminderType: "EXPENSE",
        dueDate: { gte: today, lte: addDays(today, 3) },
        AND: [
          { OR: [{ relatedClientId: null }, { relatedClient: activeClientWhere }] },
          { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: activeCaseWhere }] }
        ]
      },
      include: {
        relatedClient: { select: { name: true } },
        relatedCaseFile: { select: { title: true } },
        cashAccount: { select: { name: true } }
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 5
    }),
    prisma.taskReminder.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "OPEN",
        dueDate: { lt: today },
        AND: [
          { OR: [{ relatedClientId: null }, { relatedClient: activeClientWhere }] },
          { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: activeCaseWhere }] }
        ]
      },
      include: {
        relatedClient: { select: { name: true } },
        relatedCaseFile: { select: { title: true } },
        cashAccount: { select: { name: true } }
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 5
    }),
    prisma.invoiceOrReceipt.findMany({
      where: {
        userId,
        deletedAt: null,
        client: activeClientWhere,
        OR: [{ caseFileId: null }, { caseFile: activeCaseWhere }],
        status: { in: ["ISSUED", "UNPAID"] }
      },
      include: {
        client: { select: { name: true } },
        caseFile: { select: { title: true } }
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 5
    })
  ]);

  const incomeItems = todayIncomes.map((income): DashboardMetricDrilldownItem => ({
    id: income.id,
    title: income.client.name,
    description: `${incomeCategoryLabels[income.category]}${income.caseFile ? ` · ${income.caseFile.title}` : ""}`,
    meta: formatDate(income.date),
    value: formatDirectionalMoney(income.amount, "IN", income.currency),
    tone: "green",
    href: "/collections"
  }));
  const expenseItems = todayExpenses.map((expense): DashboardMetricDrilldownItem => ({
    id: expense.id,
    title: expense.client?.name ?? "Genel gider",
    description: `${expenseCategoryLabels[expense.category]}${expense.caseFile ? ` · ${expense.caseFile.title}` : ""}`,
    meta: formatDate(expense.date),
    value: formatDirectionalMoney(expense.amount, "OUT", expense.currency),
    tone: "rose",
    href: "/expenses"
  }));
  const netItems = [
    ...todayIncomes.map((income) => ({
      sortDate: income.date.getTime(),
      sortCreatedAt: income.createdAt.getTime(),
      item: {
        id: `income-${income.id}`,
        title: income.client.name,
        description: `Tahsilat · ${incomeCategoryLabels[income.category]}${income.caseFile ? ` · ${income.caseFile.title}` : ""}`,
        meta: formatDate(income.date),
        value: `+${formatMoney(income.amount, income.currency)}`,
        tone: "green" as const,
        href: "/collections"
      }
    })),
    ...todayExpenses.map((expense) => ({
      sortDate: expense.date.getTime(),
      sortCreatedAt: expense.createdAt.getTime(),
      item: {
        id: `expense-${expense.id}`,
        title: expense.client?.name ?? "Genel gider",
        description: `Gider · ${expenseCategoryLabels[expense.category]}${expense.caseFile ? ` · ${expense.caseFile.title}` : ""}`,
        meta: formatDate(expense.date),
        value: `-${formatMoney(expense.amount, expense.currency)}`,
        tone: "rose" as const,
        href: "/expenses"
      }
    }))
  ]
    .sort((a, b) => b.sortDate - a.sortDate || b.sortCreatedAt - a.sortCreatedAt)
    .slice(0, 5)
    .map((row) => row.item);
  const cashMovementItems = todayCashMovements.map((entry): DashboardMetricDrilldownItem => ({
    id: entry.id,
    title: entry.description || cashLedgerEntryTypeLabels[entry.entryType],
    description: [
      cashLedgerEntryTypeLabels[entry.entryType],
      cashLedgerDirectionLabels[entry.direction],
      entry.cashAccountName,
      entry.clientName,
      entry.caseFileTitle
    ]
      .filter(Boolean)
      .join(" · "),
    meta: entry.date,
    value: entry.signedAmountLabel,
    tone: entry.tone,
    href: "/cash/ledger"
  }));
  const monthCashMovementItems = monthCashMovements.map((entry): DashboardMetricDrilldownItem => ({
    id: entry.id,
    title: entry.description || cashLedgerEntryTypeLabels[entry.entryType],
    description: [
      cashLedgerEntryTypeLabels[entry.entryType],
      cashLedgerDirectionLabels[entry.direction],
      entry.cashAccountName,
      entry.clientName,
      entry.caseFileTitle
    ]
      .filter(Boolean)
      .join(" · "),
    meta: entry.date,
    value: entry.signedAmountLabel,
    tone: entry.tone,
    href: "/cash/ledger"
  }));
  const upcomingExpenseItems = upcomingExpenseReminders.map((reminder): DashboardMetricDrilldownItem => {
    const context = [reminder.relatedClient?.name, reminder.relatedCaseFile?.title, reminder.cashAccount?.name]
      .filter(Boolean)
      .join(" · ");

    return {
      id: reminder.id,
      title: reminder.title,
      description: [
        reminder.dueDate < tomorrow ? "Bugün ödenecek" : "Yaklaşan gider",
        reminderPriorityLabels[reminder.priority],
        context
      ]
        .filter(Boolean)
        .join(" · "),
      meta: formatDate(reminder.dueDate),
      value: reminder.amount ? formatDirectionalMoney(reminder.amount, "OUT", reminder.currency) : "-",
      tone: "rose",
      href: "/reminders"
    };
  });
  const overdueReminderItems = overdueReminders.map((reminder): DashboardMetricDrilldownItem => {
    const context = [reminder.relatedClient?.name, reminder.relatedCaseFile?.title, reminder.cashAccount?.name]
      .filter(Boolean)
      .join(" · ");
    const flowTone = reminderFinancialTone(reminder.reminderType);

    return {
      id: reminder.id,
      title: reminder.title,
      description: [reminderTypeLabels[reminder.reminderType], reminderPriorityLabels[reminder.priority], context]
        .filter(Boolean)
        .join(" · "),
      meta: formatDate(reminder.dueDate),
      value: reminder.amount ? formatReminderFlowValue(reminder.amount, reminder.currency, flowTone) : "Gecikti",
      tone: reminder.amount ? flowTone : "rose",
      href: "/reminders"
    };
  });
  const openReceivableItems = openReceivableDocuments.map((document): DashboardMetricDrilldownItem => ({
    id: document.id,
    title: document.client.name,
    description: [
      receiptTypeLabels[document.type],
      receiptStatusLabels[document.status],
      document.number,
      document.caseFile?.title ?? ""
    ]
      .filter(Boolean)
      .join(" · "),
    meta: formatDate(document.issueDate),
    value: formatDirectionalMoney(document.netAmount, "IN"),
    tone: "green",
    href: "/receipts"
  }));

  return {
    todayIncomes: incomeItems,
    todayExpenses: expenseItems,
    todayNet: netItems,
    todayCashMovements: cashMovementItems,
    upcomingExpenses: upcomingExpenseItems,
    overdueReminders: overdueReminderItems,
    monthCashNet: monthCashMovementItems,
    openReceivables: openReceivableItems
  };
}

function reminderFinancialTone(reminderType: keyof typeof reminderTypeLabels): DashboardMetricDrilldownItem["tone"] {
  if (reminderType === "COLLECTION" || reminderType === "INVOICE") {
    return "green";
  }

  if (reminderType === "EXPENSE" || reminderType === "TAX") {
    return "rose";
  }

  return "neutral";
}

function formatReminderFlowValue(
  amount: unknown,
  currency: string,
  tone: DashboardMetricDrilldownItem["tone"]
) {
  if (tone === "green") {
    return formatDirectionalMoney(amount, "IN", currency);
  }

  if (tone === "rose") {
    return formatDirectionalMoney(amount, "OUT", currency);
  }

  return formatMoney(amount, currency);
}

export async function getDashboardReminders(userId: string) {
  const core = await getDashboardCoreData(userId);
  const todayDueReminders = core.reminderCandidates.filter((reminder) => reminder.dueDate >= core.today && reminder.dueDate < core.tomorrow);
  const threeDayExpenseReminders = core.reminderCandidates.filter(
    (reminder) =>
      reminder.reminderType === "EXPENSE" && reminder.dueDate >= core.today && reminder.dueDate <= addDays(core.today, 3)
  );
  const overdueReminders = core.reminderCandidates.filter((reminder) => reminder.dueDate < core.today);
  const criticalReminders = core.reminderCandidates.filter((reminder) => reminder.priority === "CRITICAL");
  const upcomingExpenseTotal = threeDayExpenseReminders.reduce((sum, reminder) => sum + toNumber(reminder.amount), 0);
  const alarmReminders = uniqueById([
    ...overdueReminders,
    ...todayDueReminders,
    ...threeDayExpenseReminders,
    ...criticalReminders
  ])
    .slice(0, 8)
    .map((reminder) => {
      const context = [
        reminder.relatedClient?.name,
        reminder.relatedCaseFile?.title,
        reminder.reminderType === "EXPENSE" ? reminder.cashAccount?.name ?? "Varsayılan kasa" : null
      ]
        .filter(Boolean)
        .join(" · ");
      const state = reminderState(reminder.dueDate, reminder.notifyBeforeDays, reminder.priority, reminder.reminderType, core.today);

      return {
        id: reminder.id,
        title: reminder.title,
        description: reminder.description ?? "",
        dueDateLabel: formatDate(reminder.dueDate),
        reminderTypeLabel: reminderTypeLabels[reminder.reminderType],
        amountLabel: reminder.amount
          ? formatReminderFlowValue(reminder.amount, reminder.currency, reminderFinancialTone(reminder.reminderType))
          : "",
        context,
        stateLabel: state.label,
        stateTone: state.tone
      };
    });

  return {
    todayDueCount: todayDueReminders.length,
    overdueCount: overdueReminders.length,
    criticalCount: criticalReminders.length,
    upcomingExpenseTotal,
    upcomingExpenseTotalLabel: formatSignedMoney(-upcomingExpenseTotal),
    alarmCount: alarmReminders.length,
    alarmReminders
  };
}

export async function getDashboardCharts(userId: string) {
  const core = await getDashboardCoreData(userId);
  const topBalanceClients = await getTopBalanceClients(userId);

  return {
    sevenDayFlow: await getLast7DaysTrend(userId),
    monthDailyFlow: await getCurrentMonthCashFlow(userId),
    monthlyComparison: core.months.map((item) => ({
      label: item.label,
      tahsilat: sumRowsInRange(core.chartIncomes, item.date, item.next),
      gider: sumRowsInRange(core.chartExpenses, item.date, item.next)
    })),
    expenseCategories: buildExpenseCategories(core.chartExpenses, core.month, core.monthEnd),
    clientBalances: topBalanceClients.map((client) => ({ label: client.name, value: client.balance }))
  };
}

const getDashboardCoreData = cache(async (userId: string) => {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const month = startOfMonth(now);
  const monthEnd = addMonths(month, 1);
  const lastSevenStart = addDays(today, -6);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(month, -(5 - index));
    return {
      date,
      label: monthLabel(date),
      next: addMonths(date, 1)
    };
  });

  const [
    todayCollections,
    todayExpenses,
    monthCollections,
    monthExpenses,
    openReceivables,
    unpaidDocumentTotal,
    chartIncomes,
    chartExpenses,
    latestIncomes,
    latestExpenses,
    reminderCandidates,
    latestAuditLogs,
    monthDocumentTax,
    monthReimbursableExpenses,
    unpaidDocumentCount
  ] = await Promise.all([
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        date: { gte: today, lt: tomorrow }
      }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        date: { gte: today, lt: tomorrow }
      }
    }),
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        date: { gte: month, lt: monthEnd }
      }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        date: { gte: month, lt: monthEnd }
      }
    }),
    prisma.invoiceOrReceipt.aggregate({
      _sum: { netAmount: true },
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: { in: ["ISSUED", "UNPAID"] }
      }
    }),
    prisma.invoiceOrReceipt.aggregate({
      _sum: { netAmount: true },
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: "UNPAID"
      }
    }),
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        date: { gte: months[0].date, lt: monthEnd }
      },
      select: { amount: true, date: true }
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        date: { gte: months[0].date, lt: monthEnd }
      },
      select: { amount: true, date: true, category: true }
    }),
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
      },
      take: 10,
      orderBy: { date: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        category: true,
        client: { select: { name: true } },
        caseFile: { select: { title: true } }
      }
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      take: 10,
      orderBy: { date: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        category: true,
        client: { select: { name: true } },
        caseFile: { select: { title: true } }
      }
    }),
    prisma.taskReminder.findMany({
      where: {
        userId,
        status: "OPEN",
        deletedAt: null,
        dueDate: { lte: addDays(today, 15) },
        AND: [
          { OR: [{ relatedClientId: null }, { relatedClient: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      include: {
        relatedClient: { select: { name: true } },
        relatedCaseFile: { select: { title: true } },
        cashAccount: { select: { name: true } }
      }
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        entityType: true,
        action: true,
        message: true,
        createdAt: true
      }
    }),
    prisma.invoiceOrReceipt.aggregate({
      _sum: { vatAmount: true, withholdingAmount: true },
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: { not: "CANCELLED" },
        issueDate: { gte: month, lt: monthEnd }
      }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        deletedAt: null,
        isClientExpense: true,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        date: { gte: month, lt: monthEnd }
      }
    }),
    prisma.invoiceOrReceipt.count({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: "UNPAID"
      }
    })
  ]);

  return {
    now,
    today,
    tomorrow,
    month,
    monthEnd,
    lastSevenStart,
    months,
    todayCollections,
    todayExpenses,
    monthCollections,
    monthExpenses,
    openReceivables,
    unpaidDocumentTotal,
    chartIncomes,
    chartExpenses,
    latestIncomes,
    latestExpenses,
    reminderCandidates,
    latestAuditLogs,
    monthDocumentTax,
    monthReimbursableExpenses,
    unpaidDocumentCount
  };
});

function emptyClientBalanceParts() {
  return {
    openDocumentTotal: 0,
    clientExpenseTotal: 0,
    advanceTotal: 0
  };
}

function totalsFromAggregates(
  collectionAggregate: { _sum: { amount: unknown } },
  expenseAggregate: { _sum: { amount: unknown } }
) {
  const collectionTotal = toNumber(collectionAggregate._sum.amount);
  const expenseTotal = toNumber(expenseAggregate._sum.amount);
  const net = collectionTotal - expenseTotal;

  return {
    collectionTotal,
    collectionTotalLabel: formatMoney(collectionTotal),
    expenseTotal,
    expenseTotalLabel: formatMoney(expenseTotal),
    net,
    netLabel: formatMoney(net)
  };
}

function buildDailyFlow(
  startDate: Date,
  endDate: Date,
  incomes: { amount: unknown; date: Date }[],
  expenses: { amount: unknown; date: Date }[]
): DashboardFlowPoint[] {
  const days: DashboardFlowPoint[] = [];

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const next = addDays(date, 1);
    const tahsilat = sumRowsInRange(incomes, date, next);
    const gider = sumRowsInRange(expenses, date, next);
    days.push({
      label: shortDateLabel(date),
      tahsilat,
      gider,
      net: tahsilat - gider
    });
  }

  return days;
}

function buildExpenseCategories(
  expenses: { amount: unknown; date: Date; category: keyof typeof expenseCategoryLabels }[],
  startDate: Date,
  endDate: Date
): DashboardSeriesPoint[] {
  const grouped = new Map<string, number>();

  for (const expense of expenses) {
    if (expense.date < startDate || expense.date >= endDate) {
      continue;
    }

    const label = expenseCategoryLabels[expense.category];
    grouped.set(label, (grouped.get(label) ?? 0) + toNumber(expense.amount));
  }

  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((row) => row.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function sumRowsInRange(rows: { amount: unknown; date: Date }[], startDate: Date, endDate: Date) {
  return rows
    .filter((row) => row.date >= startDate && row.date < endDate)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
}

function reminderState(
  dueDate: Date,
  notifyBeforeDays: number,
  priority: keyof typeof reminderPriorityLabels,
  reminderType: keyof typeof reminderTypeLabels,
  today: Date
) {
  if (dueDate < today) {
    return { label: "Gecikti", tone: "rose" as const };
  }

  if (dueDate < addDays(today, 1)) {
    return { label: reminderType === "EXPENSE" ? "Bugün Ödenecek" : "Bugün", tone: "amber" as const };
  }

  if (priority === "CRITICAL") {
    return { label: "Kritik", tone: "rose" as const };
  }

  if (reminderType === "EXPENSE" && dueDate <= addDays(today, 3)) {
    return { label: "Yaklaşan Gider", tone: "amber" as const };
  }

  if (dueDate <= addDays(today, notifyBeforeDays)) {
    return { label: "Yaklaşıyor", tone: "amber" as const };
  }

  return { label: "Planlı", tone: "neutral" as const };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function shortDateLabel(date: Date) {
  return formatDate(date).slice(0, 5);
}
