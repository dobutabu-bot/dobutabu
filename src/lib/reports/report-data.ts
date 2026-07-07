import { Prisma } from "@prisma/client";
import { cache } from "react";

import { expenseCategoryLabels, incomeCategoryLabels, reminderPriorityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  dateInputValue,
  endOfDateInput,
  formatDate,
  formatDirectionalMoney,
  formatSignedMoney,
  parseDateInput,
  startOfDay,
  startOfMonth,
  toNumber
} from "@/lib/utils";

export type ReportDataFilters = {
  userId: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  caseFileId?: string;
};

export type ReportSummaryData = {
  totalIncome: number;
  totalExpense: number;
  net: number;
  outstandingReceivables: number;
  reimbursableExpenses: number;
  unpaidInvoices: number;
  incomeCount: number;
  expenseCount: number;
  unpaidInvoiceCount: number;
  formatted: {
    totalIncome: string;
    totalExpense: string;
    net: string;
    outstandingReceivables: string;
    reimbursableExpenses: string;
    unpaidInvoices: string;
  };
};

export type ReportTrendPoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net: number;
};

export type ReportSeriesPoint = {
  label: string;
  value: number;
};

export type CaseFileFinancialSummaryPoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net: number;
};

export type OutstandingInvoiceRow = {
  id: string;
  issueDate: string;
  client: string;
  caseFile: string;
  number: string;
  status: string;
  netAmount: number;
  netAmountLabel: string;
};

export type OutstandingInvoicesData = {
  count: number;
  total: number;
  totalLabel: string;
  rows: OutstandingInvoiceRow[];
};

export type UpcomingExpenseReminderRow = {
  id: string;
  dueDate: string;
  title: string;
  client: string;
  caseFile: string;
  priority: string;
  amount: number;
  amountLabel: string;
};

export async function getReportSummary(filters: ReportDataFilters): Promise<ReportSummaryData> {
  const context = await getReportContext(filters);
  const totalIncome = sum(context.incomes.map((row) => row.amount));
  const totalExpense = sum(context.expenses.map((row) => row.amount));
  const net = totalIncome.minus(totalExpense);
  const outstandingReceivables = sum(
    context.documents.filter((row) => ["ISSUED", "UNPAID"].includes(row.status)).map((row) => row.netAmount)
  );
  const reimbursableExpenses = sum(context.expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
  const unpaidInvoices = sum(context.documents.filter((row) => row.status === "UNPAID").map((row) => row.netAmount));

  return {
    totalIncome: toNumber(totalIncome),
    totalExpense: toNumber(totalExpense),
    net: toNumber(net),
    outstandingReceivables: toNumber(outstandingReceivables),
    reimbursableExpenses: toNumber(reimbursableExpenses),
    unpaidInvoices: toNumber(unpaidInvoices),
    incomeCount: context.incomes.length,
    expenseCount: context.expenses.length,
    unpaidInvoiceCount: context.documents.filter((row) => row.status === "UNPAID").length,
    formatted: {
      totalIncome: formatDirectionalMoney(totalIncome, "IN"),
      totalExpense: formatDirectionalMoney(totalExpense, "OUT"),
      net: formatSignedMoney(net),
      outstandingReceivables: formatDirectionalMoney(outstandingReceivables, "IN"),
      reimbursableExpenses: formatDirectionalMoney(reimbursableExpenses, "IN"),
      unpaidInvoices: formatDirectionalMoney(unpaidInvoices, "IN")
    }
  };
}

export async function getIncomeExpenseTrend(filters: ReportDataFilters): Promise<ReportTrendPoint[]> {
  const context = await getReportContext(filters);
  const bounds = reportDateBounds(filters);
  const grouped = new Map<string, { label: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (let date = startOfMonth(bounds.start); date <= startOfMonth(bounds.end); date = addMonths(date, 1)) {
    grouped.set(monthKey(date), {
      label: longMonthLabel(date),
      income: decimalZero(),
      expense: decimalZero()
    });
  }

  for (const income of context.incomes) {
    const key = monthKey(income.date);
    const current = grouped.get(key) ?? { label: longMonthLabel(income.date), income: decimalZero(), expense: decimalZero() };
    current.income = current.income.plus(income.amount);
    grouped.set(key, current);
  }

  for (const expense of context.expenses) {
    const key = monthKey(expense.date);
    const current = grouped.get(key) ?? { label: longMonthLabel(expense.date), income: decimalZero(), expense: decimalZero() };
    current.expense = current.expense.plus(expense.amount);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => ({
      label: row.label,
      tahsilat: toNumber(row.income),
      gider: toNumber(row.expense),
      net: toNumber(row.income.minus(row.expense))
    }));
}

export async function getIncomeByCategory(filters: ReportDataFilters): Promise<ReportSeriesPoint[]> {
  const context = await getReportContext(filters);
  const grouped = new Map<string, Prisma.Decimal>();

  for (const income of context.incomes) {
    addToGroup(grouped, incomeCategoryLabels[income.category], income.amount);
  }

  return moneySeries(grouped, 8);
}

export async function getExpenseByCategory(filters: ReportDataFilters): Promise<ReportSeriesPoint[]> {
  const context = await getReportContext(filters);
  const grouped = new Map<string, Prisma.Decimal>();

  for (const expense of context.expenses) {
    addToGroup(grouped, expenseCategoryLabels[expense.category], expense.amount);
  }

  return moneySeries(grouped, 8);
}

export async function getTopClientsByIncome(filters: ReportDataFilters): Promise<ReportSeriesPoint[]> {
  const context = await getReportContext(filters);
  const grouped = new Map<string, Prisma.Decimal>();

  for (const income of context.incomes) {
    addToGroup(grouped, income.client.name, income.amount);
  }

  return moneySeries(grouped, 8);
}

export async function getTopClientsByBalance(filters: ReportDataFilters): Promise<ReportSeriesPoint[]> {
  const context = await getReportContext(filters);

  return context.clients
    .map((client) => {
      const openDocuments = sum(
        context.documents
          .filter((row) => row.clientId === client.id && ["ISSUED", "UNPAID"].includes(row.status))
          .map((row) => row.netAmount)
      );
      const reimbursableExpenses = sum(
        context.expenses.filter((row) => row.clientId === client.id && row.isClientExpense).map((row) => row.amount)
      );
      const advances = sum(
        context.incomes.filter((row) => row.clientId === client.id && row.category === "ADVANCE").map((row) => row.amount)
      );
      const balance = openDocuments.plus(reimbursableExpenses).minus(advances);

      return { label: client.name, value: toNumber(balance) };
    })
    .filter((row) => row.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);
}

export async function getCaseFileFinancialSummary(filters: ReportDataFilters): Promise<CaseFileFinancialSummaryPoint[]> {
  const context = await getReportContext(filters);

  return context.cases
    .map((caseFile) => {
      const incomeTotal = sum(context.incomes.filter((row) => row.caseFileId === caseFile.id).map((row) => row.amount));
      const expenseTotal = sum(context.expenses.filter((row) => row.caseFileId === caseFile.id).map((row) => row.amount));
      const net = incomeTotal.minus(expenseTotal);

      return {
        label: caseFile.title,
        tahsilat: toNumber(incomeTotal),
        gider: toNumber(expenseTotal),
        net: toNumber(net)
      };
    })
    .filter((row) => row.tahsilat !== 0 || row.gider !== 0 || row.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 8);
}

export async function getOutstandingInvoices(filters: ReportDataFilters): Promise<OutstandingInvoicesData> {
  const context = await getReportContext(filters);
  const documents = context.documents.filter((row) => ["ISSUED", "UNPAID"].includes(row.status));
  const total = sum(documents.map((row) => row.netAmount));

  return {
    count: documents.length,
    total: toNumber(total),
    totalLabel: formatDirectionalMoney(total, "IN"),
    rows: documents.slice(0, 20).map((row) => ({
      id: row.id,
      issueDate: formatDate(row.issueDate),
      client: row.client.name,
      caseFile: row.caseFile?.title ?? "-",
      number: row.number,
      status: row.status,
      netAmount: toNumber(row.netAmount),
      netAmountLabel: formatDirectionalMoney(row.netAmount, "IN")
    }))
  };
}

export async function getUpcomingExpenseReminders(filters: ReportDataFilters): Promise<UpcomingExpenseReminderRow[]> {
  const today = startOfDay(new Date());
  const reminders = await prisma.taskReminder.findMany({
    where: {
      userId: filters.userId,
      deletedAt: null,
      status: "OPEN",
      reminderType: "EXPENSE",
      dueDate: { gte: today, lte: addDays(today, 30) },
      ...(filters.clientId ? { relatedClientId: filters.clientId } : {}),
      ...(filters.caseFileId ? { relatedCaseFileId: filters.caseFileId } : {}),
      AND: [
        { OR: [{ relatedClientId: null }, { relatedClient: { archivedAt: null, deletedAt: null } }] },
        { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
      ]
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 20,
    include: {
      relatedClient: { select: { name: true } },
      relatedCaseFile: { select: { title: true } }
    }
  });

  return reminders.map((row) => ({
    id: row.id,
    dueDate: formatDate(row.dueDate),
    title: row.title,
    client: row.relatedClient?.name ?? "-",
    caseFile: row.relatedCaseFile?.title ?? "-",
    priority: reminderPriorityLabels[row.priority],
    amount: toNumber(row.amount),
    amountLabel: row.amount ? formatDirectionalMoney(row.amount, "OUT", row.currency) : "-"
  }));
}

export async function getReportContext(filters: ReportDataFilters) {
  return getReportContextFromKey(reportContextKey(filters));
}

const getReportContextFromKey = cache(async (key: string) => {
  const filters = JSON.parse(key) as Required<ReportDataFilters>;
  const date = dateWhere(filters);
  const issueDate = dateWhere(filters, "issueDate");

  const [incomes, expenses, documents, clients, cases] = await Promise.all([
    prisma.income.findMany({
      where: {
        userId: filters.userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        ...clientCaseFilter(filters),
        ...date
      },
      include: { client: true, caseFile: true },
      orderBy: { date: "desc" }
    }),
    prisma.expense.findMany({
      where: {
        userId: filters.userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        ...clientCaseFilter(filters),
        ...date
      },
      include: { client: true, caseFile: true },
      orderBy: { date: "desc" }
    }),
    prisma.invoiceOrReceipt.findMany({
      where: {
        userId: filters.userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        ...clientCaseFilter(filters),
        ...issueDate
      },
      include: { client: true, caseFile: true },
      orderBy: { issueDate: "desc" }
    }),
    prisma.client.findMany({
      where: {
        userId: filters.userId,
        archivedAt: null,
        deletedAt: null,
        ...(filters.clientId ? { id: filters.clientId } : {})
      },
      orderBy: { name: "asc" }
    }),
    prisma.caseFile.findMany({
      where: {
        userId: filters.userId,
        deletedAt: null,
        archivedAt: null,
        status: { not: "ARCHIVED" },
        client: { archivedAt: null, deletedAt: null },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.caseFileId ? { id: filters.caseFileId } : {})
      },
      include: { client: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return { incomes, expenses, documents, clients, cases };
});

function reportContextKey(filters: ReportDataFilters) {
  return JSON.stringify({
    userId: filters.userId,
    startDate: clean(filters.startDate),
    endDate: clean(filters.endDate),
    clientId: clean(filters.clientId),
    caseFileId: clean(filters.caseFileId)
  });
}

function reportDateBounds(filters: ReportDataFilters) {
  const today = startOfDay(new Date());
  return {
    start: filters.startDate ? parseDateInput(filters.startDate) : startOfMonth(today),
    end: filters.endDate ? endOfDateInput(filters.endDate) : endOfDateInput(dateInputValue(today))
  };
}

function dateWhere(filters: ReportDataFilters, field: "date" | "issueDate" = "date") {
  const value: Prisma.DateTimeFilter = {};

  if (filters.startDate) {
    value.gte = parseDateInput(filters.startDate);
  }

  if (filters.endDate) {
    value.lte = endOfDateInput(filters.endDate);
  }

  return value.gte || value.lte ? { [field]: value } : {};
}

function clientCaseFilter(filters: ReportDataFilters) {
  return {
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {})
  };
}

function moneySeries(grouped: Map<string, Prisma.Decimal>, limit: number): ReportSeriesPoint[] {
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value: toNumber(value) }))
    .filter((row) => row.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function addToGroup(grouped: Map<string, Prisma.Decimal>, label: string, amount: Prisma.Decimal) {
  grouped.set(label, (grouped.get(label) ?? decimalZero()).plus(amount));
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), decimalZero());
}

function decimalZero() {
  return new Prisma.Decimal(0);
}

function monthKey(date: Date) {
  return dateInputValue(date).slice(0, 7);
}

function longMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}
