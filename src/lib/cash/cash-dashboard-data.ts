import { Prisma } from "@prisma/client";

import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import { getLedgerEntries, reminderTypeToCashTone, signedDecimal } from "@/lib/cash/cash-ledger-service";
import { reminderPriorityLabels, reminderTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { addDays, dateInputValue, endOfDateInput, formatDate, formatMoney, formatSignedMoney, startOfDay, startOfMonth, toNumber } from "@/lib/utils";

export type CashSummaryData = {
  inTotal: number;
  outTotal: number;
  net: number;
  movementCount: number;
  inTotalLabel: string;
  outTotalLabel: string;
  netLabel: string;
  tone: "green" | "rose" | "neutral";
};

export type CashFlowPoint = {
  date: string;
  label: string;
  giris: number;
  cikis: number;
  net: number;
};

export type CashAccountDistributionPoint = {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  tone: "green" | "rose" | "neutral";
  color: string;
};

export type UpcomingCashReminder = {
  id: string;
  title: string;
  typeLabel: string;
  priorityLabel: string;
  dueDate: string;
  amount: number;
  amountLabel: string;
  signedAmount: number;
  signedAmountLabel: string;
  tone: "green" | "rose" | "neutral";
  client: string;
  caseFile: string;
};

export async function getTotalCashBalance(userId: string) {
  const balances = await getAllCashAccountBalances(userId);
  const total = balances.reduce((sum, account) => sum + account.balance, 0);

  return {
    total,
    totalLabel: formatMoney(total),
    tone: total > 0 ? "green" : total < 0 ? "rose" : "neutral",
    accounts: balances
  };
}

export async function getTodayCashInOut(userId: string): Promise<CashSummaryData> {
  const today = startOfDay(new Date());
  return getCashInOut(userId, today, endOfDateInput(dateInputValue(today)));
}

export async function getMonthlyCashInOut(userId: string): Promise<CashSummaryData> {
  const today = startOfDay(new Date());
  return getCashInOut(userId, startOfMonth(today), endOfDateInput(dateInputValue(today)));
}

export async function getLast7DaysCashFlow(userId: string): Promise<CashFlowPoint[]> {
  const today = startOfDay(new Date());
  return getDailyCashFlow(userId, addDays(today, -6), endOfDateInput(dateInputValue(today)));
}

export async function getCurrentMonthDailyCashFlow(userId: string): Promise<CashFlowPoint[]> {
  const today = startOfDay(new Date());
  return getDailyCashFlow(userId, startOfMonth(today), endOfDateInput(dateInputValue(today)));
}

export async function getCashAccountDistribution(userId: string): Promise<CashAccountDistributionPoint[]> {
  const [balances, accounts] = await Promise.all([
    getAllCashAccountBalances(userId),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, color: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    })
  ]);
  const colorMap = new Map(accounts.map((account) => [account.id, account.color ?? "#16a34a"]));

  return balances.map((account) => ({
    id: account.accountId,
    label: account.accountName,
    value: account.balance,
    valueLabel: account.balanceLabel,
    tone: account.tone,
    color: colorMap.get(account.accountId) ?? "#16a34a"
  }));
}

export async function getRecentCashMovements(userId: string, take = 10) {
  return getLedgerEntries({ userId, take });
}

export async function getUpcomingCashReminders(userId: string): Promise<UpcomingCashReminder[]> {
  const today = startOfDay(new Date());
  const horizon = addDays(today, 15);
  const reminders = await prisma.taskReminder.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "OPEN",
      notificationEnabled: true,
      reminderType: { in: ["EXPENSE", "COLLECTION", "INVOICE", "TAX"] },
      dueDate: { lte: horizon },
      AND: [
        { OR: [{ relatedClientId: null }, { relatedClient: { archivedAt: null, deletedAt: null } }] },
        { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: { archivedAt: null, deletedAt: null } }] }
      ]
    },
    include: {
      relatedClient: { select: { name: true } },
      relatedCaseFile: { select: { title: true } }
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 20
  });

  return reminders.map((reminder) => {
    const amount = toNumber(reminder.amount);
    const tone = reminderTypeToCashTone(reminder.reminderType);
    const signedAmount = tone === "green" ? amount : tone === "rose" ? -amount : amount;

    return {
      id: reminder.id,
      title: reminder.title,
      typeLabel: reminderTypeLabels[reminder.reminderType],
      priorityLabel: reminderPriorityLabels[reminder.priority],
      dueDate: formatDate(reminder.dueDate),
      amount,
      amountLabel: reminder.amount ? formatMoney(reminder.amount, reminder.currency) : "-",
      signedAmount,
      signedAmountLabel: reminder.amount ? formatSignedMoney(signedAmount, reminder.currency) : "-",
      tone,
      client: reminder.relatedClient?.name ?? "",
      caseFile: reminder.relatedCaseFile?.title ?? ""
    };
  });
}

async function getCashInOut(userId: string, start: Date, end: Date): Promise<CashSummaryData> {
  const entries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      cashAccount: { deletedAt: null },
      date: { gte: start, lte: end }
    },
    select: { direction: true, amount: true }
  });
  const totals = entries.reduce(
    (current, entry) => {
      if (entry.direction === "IN") {
        current.inTotal = current.inTotal.plus(entry.amount);
      } else {
        current.outTotal = current.outTotal.plus(entry.amount);
      }
      return current;
    },
    { inTotal: new Prisma.Decimal(0), outTotal: new Prisma.Decimal(0) }
  );
  const net = totals.inTotal.minus(totals.outTotal);
  const netNumber = toNumber(net);

  return {
    inTotal: toNumber(totals.inTotal),
    outTotal: toNumber(totals.outTotal),
    net: netNumber,
    movementCount: entries.length,
    inTotalLabel: formatSignedMoney(totals.inTotal),
    outTotalLabel: formatSignedMoney(-totals.outTotal),
    netLabel: formatSignedMoney(net),
    tone: netNumber > 0 ? "green" : netNumber < 0 ? "rose" : "neutral"
  };
}

async function getDailyCashFlow(userId: string, start: Date, end: Date): Promise<CashFlowPoint[]> {
  const entries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      cashAccount: { deletedAt: null },
      date: { gte: start, lte: end }
    },
    select: { direction: true, amount: true, date: true }
  });
  const grouped = new Map<string, { inTotal: Prisma.Decimal; outTotal: Prisma.Decimal }>();

  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    grouped.set(dateInputValue(cursor), { inTotal: new Prisma.Decimal(0), outTotal: new Prisma.Decimal(0) });
  }

  for (const entry of entries) {
    const key = dateInputValue(entry.date);
    const current = grouped.get(key) ?? { inTotal: new Prisma.Decimal(0), outTotal: new Prisma.Decimal(0) };
    const signed = signedDecimal(entry.direction, entry.amount);

    if (signed.greaterThanOrEqualTo(0)) {
      current.inTotal = current.inTotal.plus(signed);
    } else {
      current.outTotal = current.outTotal.plus(signed.abs());
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([date, row]) => {
    const net = row.inTotal.minus(row.outTotal);
    return {
      date,
      label: formatDate(date),
      giris: toNumber(row.inTotal),
      cikis: toNumber(row.outTotal),
      net: toNumber(net)
    };
  });
}
