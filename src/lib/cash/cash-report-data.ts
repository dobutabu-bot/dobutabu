import { Prisma, type CashLedgerEntryType } from "@prisma/client";

import { cashLedgerWhere, signedDecimal } from "@/lib/cash/cash-ledger-service";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dateInputValue,
  endOfDateInput,
  formatDate,
  formatMoney,
  formatSignedMoney,
  parseDateInput,
  startOfDay,
  startOfMonth,
  toNumber
} from "@/lib/utils";

export type CashReportFilters = {
  userId: string;
  startDate?: string;
  endDate?: string;
  cashAccountId?: string;
  clientId?: string;
  caseFileId?: string;
};

export type CashReportSummary = {
  cashIn: number;
  cashOut: number;
  net: number;
  cashInLabel: string;
  cashOutLabel: string;
  netLabel: string;
  tone: "green" | "rose" | "neutral";
};

export type CashReportRow = {
  id: string;
  date: string;
  account: string;
  entryType: string;
  direction: "IN" | "OUT";
  client: string;
  caseFile: string;
  description: string;
  amount: number;
  signedAmount: number;
  amountLabel: string;
  signedAmountLabel: string;
  tone: "green" | "rose" | "neutral";
};

export type CashFlowReportData = {
  summary: CashReportSummary;
  dailyFlow: Array<{ date: string; label: string; giris: number; cikis: number; net: number }>;
  rows: CashReportRow[];
};

export type AccountBasedReportRow = {
  accountId: string;
  account: string;
  cashIn: number;
  cashOut: number;
  net: number;
  cashInLabel: string;
  cashOutLabel: string;
  netLabel: string;
  movementCount: number;
  tone: "green" | "rose" | "neutral";
};

export type IncomeExpenseByAccountRow = {
  accountId: string;
  account: string;
  income: number;
  expense: number;
  net: number;
};

export type ProfitabilityReportRow = {
  id: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  incomeLabel: string;
  expenseLabel: string;
  netLabel: string;
  tone: "green" | "rose" | "neutral";
};

const cashEntrySelect = {
  id: true,
  direction: true,
  entryType: true,
  amount: true,
  currency: true,
  date: true,
  description: true,
  cashAccountId: true,
  clientId: true,
  caseFileId: true,
  cashAccount: { select: { name: true } },
  client: { select: { name: true } },
  caseFile: { select: { title: true } }
} satisfies Prisma.CashLedgerEntrySelect;

type CashEntryRow = Prisma.CashLedgerEntryGetPayload<{ select: typeof cashEntrySelect }>;

const entryTypeLabels: Record<CashLedgerEntryType, string> = {
  INCOME: "Tahsilat",
  EXPENSE: "Gider",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Düzeltme",
  OPENING_BALANCE: "Açılış bakiyesi"
};

export async function getCashFlowReport(filters: CashReportFilters): Promise<CashFlowReportData> {
  const entries = await loadCashReportEntries(filters);

  return {
    summary: summarizeEntries(entries),
    dailyFlow: buildDailyFlow(entries, filters),
    rows: entries.map(serializeCashReportRow)
  };
}

export async function getAccountBasedReport(filters: CashReportFilters): Promise<AccountBasedReportRow[]> {
  const entries = await loadCashReportEntries(filters);
  const grouped = new Map<string, { account: string; cashIn: Prisma.Decimal; cashOut: Prisma.Decimal; count: number }>();

  for (const entry of entries) {
    const key = entry.cashAccountId;
    const current = grouped.get(key) ?? {
      account: entry.cashAccount.name,
      cashIn: decimalZero(),
      cashOut: decimalZero(),
      count: 0
    };

    if (entry.direction === "IN") {
      current.cashIn = current.cashIn.plus(entry.amount);
    } else {
      current.cashOut = current.cashOut.plus(entry.amount);
    }
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([accountId, row]) => {
      const net = row.cashIn.minus(row.cashOut);
      const netNumber = toNumber(net);
      return {
        accountId,
        account: row.account,
        cashIn: toNumber(row.cashIn),
        cashOut: toNumber(row.cashOut),
        net: netNumber,
        cashInLabel: formatSignedMoney(row.cashIn),
        cashOutLabel: formatSignedMoney(-row.cashOut),
        netLabel: formatSignedMoney(net),
        movementCount: row.count,
        tone: moneyTone(netNumber)
      };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export async function getIncomeExpenseByAccount(filters: CashReportFilters): Promise<IncomeExpenseByAccountRow[]> {
  const entries = (await loadCashReportEntries(filters)).filter((entry) => ["INCOME", "EXPENSE"].includes(entry.entryType));
  const grouped = new Map<string, { account: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (const entry of entries) {
    const current = grouped.get(entry.cashAccountId) ?? {
      account: entry.cashAccount.name,
      income: decimalZero(),
      expense: decimalZero()
    };

    if (entry.entryType === "INCOME") {
      current.income = current.income.plus(entry.amount);
    } else {
      current.expense = current.expense.plus(entry.amount);
    }
    grouped.set(entry.cashAccountId, current);
  }

  return Array.from(grouped.entries())
    .map(([accountId, row]) => ({
      accountId,
      account: row.account,
      income: toNumber(row.income),
      expense: toNumber(row.expense),
      net: toNumber(row.income.minus(row.expense))
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export async function getClientProfitabilityReport(filters: CashReportFilters): Promise<ProfitabilityReportRow[]> {
  const entries = (await loadCashReportEntries(filters)).filter((entry) => entry.clientId && ["INCOME", "EXPENSE"].includes(entry.entryType));
  const grouped = new Map<string, { label: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (const entry of entries) {
    if (!entry.clientId) continue;
    const current = grouped.get(entry.clientId) ?? {
      label: entry.client?.name ?? "Müvekkil",
      income: decimalZero(),
      expense: decimalZero()
    };

    if (entry.entryType === "INCOME") {
      current.income = current.income.plus(entry.amount);
    } else {
      current.expense = current.expense.plus(entry.amount);
    }
    grouped.set(entry.clientId, current);
  }

  return profitabilityRows(grouped);
}

export async function getCaseFileProfitabilityReport(filters: CashReportFilters): Promise<ProfitabilityReportRow[]> {
  const entries = (await loadCashReportEntries(filters)).filter(
    (entry) => entry.caseFileId && ["INCOME", "EXPENSE"].includes(entry.entryType)
  );
  const grouped = new Map<string, { label: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (const entry of entries) {
    if (!entry.caseFileId) continue;
    const current = grouped.get(entry.caseFileId) ?? {
      label: entry.caseFile?.title ?? "Dosya",
      income: decimalZero(),
      expense: decimalZero()
    };

    if (entry.entryType === "INCOME") {
      current.income = current.income.plus(entry.amount);
    } else {
      current.expense = current.expense.plus(entry.amount);
    }
    grouped.set(entry.caseFileId, current);
  }

  return profitabilityRows(grouped);
}

async function loadCashReportEntries(filters: CashReportFilters) {
  const bounds = reportDateBounds(filters);

  return prisma.cashLedgerEntry.findMany({
    where: {
      ...cashLedgerWhere({
        ...filters,
        startDate: dateInputValue(bounds.start),
        endDate: dateInputValue(bounds.end)
      }),
      AND: [
        { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
        { OR: [{ caseFileId: null }, { caseFile: { archivedAt: null, deletedAt: null, status: { not: "ARCHIVED" } } }] }
      ]
    },
    select: cashEntrySelect,
    orderBy: [{ date: "desc" }, { id: "desc" }]
  });
}

function summarizeEntries(entries: CashEntryRow[]): CashReportSummary {
  const totals = entries.reduce(
    (current, entry) => {
      if (entry.direction === "IN") {
        current.cashIn = current.cashIn.plus(entry.amount);
      } else {
        current.cashOut = current.cashOut.plus(entry.amount);
      }
      return current;
    },
    { cashIn: decimalZero(), cashOut: decimalZero() }
  );
  const net = totals.cashIn.minus(totals.cashOut);
  const netNumber = toNumber(net);

  return {
    cashIn: toNumber(totals.cashIn),
    cashOut: toNumber(totals.cashOut),
    net: netNumber,
    cashInLabel: formatSignedMoney(totals.cashIn),
    cashOutLabel: formatSignedMoney(-totals.cashOut),
    netLabel: formatSignedMoney(net),
    tone: netNumber > 0 ? "green" : netNumber < 0 ? "rose" : "neutral"
  };
}

function buildDailyFlow(entries: CashEntryRow[], filters: CashReportFilters) {
  const bounds = reportDateBounds(filters);
  const grouped = new Map<string, { cashIn: Prisma.Decimal; cashOut: Prisma.Decimal }>();

  for (let cursor = startOfDay(bounds.start); cursor <= bounds.end; cursor = addDays(cursor, 1)) {
    grouped.set(dateInputValue(cursor), { cashIn: decimalZero(), cashOut: decimalZero() });
  }

  for (const entry of entries) {
    const key = dateInputValue(entry.date);
    const current = grouped.get(key) ?? { cashIn: decimalZero(), cashOut: decimalZero() };
    const signed = signedDecimal(entry.direction, entry.amount);

    if (signed.greaterThanOrEqualTo(0)) {
      current.cashIn = current.cashIn.plus(signed);
    } else {
      current.cashOut = current.cashOut.plus(signed.abs());
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([date, row]) => ({
    date,
    label: formatDate(date),
    giris: toNumber(row.cashIn),
    cikis: toNumber(row.cashOut),
    net: toNumber(row.cashIn.minus(row.cashOut))
  }));
}

function serializeCashReportRow(entry: CashEntryRow): CashReportRow {
  const amount = toNumber(entry.amount);
  const signedAmount = entry.direction === "IN" ? amount : -amount;

  return {
    id: entry.id,
    date: formatDate(entry.date),
    account: entry.cashAccount.name,
    entryType: entryTypeLabels[entry.entryType],
    direction: entry.direction,
    client: entry.client?.name ?? "",
    caseFile: entry.caseFile?.title ?? "",
    description: entry.description ?? "",
    amount,
    signedAmount,
    amountLabel: formatMoney(amount, entry.currency),
    signedAmountLabel: formatSignedMoney(signedAmount, entry.currency),
    tone: signedAmount > 0 ? "green" : signedAmount < 0 ? "rose" : "neutral"
  };
}

function profitabilityRows(grouped: Map<string, { label: string; income: Prisma.Decimal; expense: Prisma.Decimal }>) {
  return Array.from(grouped.entries())
    .map(([id, row]) => {
      const net = row.income.minus(row.expense);
      const netNumber = toNumber(net);

      return {
        id,
        label: row.label,
        income: toNumber(row.income),
        expense: toNumber(row.expense),
        net: netNumber,
        incomeLabel: formatSignedMoney(row.income),
        expenseLabel: formatSignedMoney(-row.expense),
        netLabel: formatSignedMoney(net),
        tone: moneyTone(netNumber)
      };
    })
    .filter((row) => row.income !== 0 || row.expense !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

function reportDateBounds(filters: CashReportFilters) {
  const today = startOfDay(new Date());
  return {
    start: filters.startDate ? parseDateInput(filters.startDate) : startOfMonth(today),
    end: filters.endDate ? endOfDateInput(filters.endDate) : endOfDateInput(dateInputValue(today))
  };
}

function decimalZero() {
  return new Prisma.Decimal(0);
}

function moneyTone(value: number): "green" | "rose" | "neutral" {
  return value > 0 ? "green" : value < 0 ? "rose" : "neutral";
}
