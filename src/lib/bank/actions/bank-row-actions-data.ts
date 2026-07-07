import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { dateInputValue, formatMoney, toNumber } from "@/lib/utils";

export type BankRowActionOptions = Awaited<ReturnType<typeof getBankRowActionOptions>>;

export type BankRowSystemMovement = ReturnType<typeof serializeBankRowSystemMovement>;

export type BankRowActionLedgerEntry = Prisma.CashLedgerEntryGetPayload<{
  include: {
    client: { select: { name: true } };
    caseFile: { select: { title: true; fileNumber: true } };
    cashAccount: { select: { name: true } };
  };
}>;

export async function getBankRowActionOptions(userId: string) {
  const [clients, caseFiles, cashAccounts] = await Promise.all([
    prisma.client.findMany({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId, deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      select: { id: true, clientId: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, currency: true, isDefault: true }
    })
  ]);

  return {
    clients,
    caseFiles: caseFiles.map((item) => ({
      id: item.id,
      clientId: item.clientId,
      title: item.fileNumber ? `${item.title} · ${item.fileNumber}` : item.title,
      clientName: item.client.name
    })),
    cashAccounts
  };
}

export async function getBankRowSystemMovements({
  userId,
  dateRange,
  cashAccountId
}: {
  userId: string;
  dateRange?: { startDate?: Date; endDate?: Date };
  cashAccountId?: string | null;
}) {
  const entries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(dateRange?.startDate && dateRange.endDate ? { date: { gte: dateRange.startDate, lte: dateRange.endDate } } : {})
    },
    orderBy: { date: "desc" },
    include: {
      client: { select: { name: true } },
      caseFile: { select: { title: true, fileNumber: true } },
      cashAccount: { select: { name: true } }
    },
    take: 500
  });

  return entries.map(serializeBankRowSystemMovement);
}

export function inferBankRowsDateRange(rows: Array<{ transactionDate: Date | null }>, toleranceDays = 7) {
  const sortedDates = rows
    .map((row) => row.transactionDate)
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());

  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];
  if (!first || !last) return {};

  return {
    startDate: new Date(first.getTime() - toleranceDays * 86400000),
    endDate: new Date(last.getTime() + toleranceDays * 86400000)
  };
}

export function serializeBankRowSystemMovement(entry: BankRowActionLedgerEntry) {
  return {
    id: entry.id,
    date: dateInputValue(entry.date),
    description: entry.description ?? "-",
    direction: entry.direction,
    entryType: entry.entryType,
    amount: Math.abs(toNumber(entry.amount)),
    signedAmount: entry.direction === "OUT" ? -Math.abs(toNumber(entry.amount)) : Math.abs(toNumber(entry.amount)),
    currency: entry.currency,
    amountLabel: formatMoney(Math.abs(toNumber(entry.amount)), entry.currency),
    clientName: entry.client?.name ?? "-",
    caseFileTitle: entry.caseFile?.title ?? "-",
    cashAccountName: entry.cashAccount.name,
    incomeId: entry.incomeId,
    expenseId: entry.expenseId
  };
}
