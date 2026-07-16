import {
  Prisma,
  type CashLedgerDirection,
  type CashLedgerEntryType,
  type ReminderType
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { ensureDefaultCashAccount, resolveCashAccountId, type CashDb } from "@/lib/cash/cash-account-service";
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
  toNumber
} from "@/lib/utils";

type IncomeLedgerSource = {
  id: string;
  userId: string;
  cashAccountId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  date: Date;
  description: string | null;
  receiptNumber: string | null;
  clientId: string;
  caseFileId: string | null;
  deletedAt: Date | null;
};

type ExpenseLedgerSource = {
  id: string;
  userId: string;
  cashAccountId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  date: Date;
  description: string | null;
  clientId: string | null;
  caseFileId: string | null;
  deletedAt: Date | null;
};

export type LedgerEntryFilters = {
  userId: string;
  cashAccountId?: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  caseFileId?: string;
  entryType?: CashLedgerEntryType | "";
  direction?: CashLedgerDirection | "";
  take?: number;
  skip?: number;
};

export type ManualAdjustmentInput = {
  cashAccountId?: string | null;
  direction: CashLedgerDirection;
  amount: string | number | Prisma.Decimal;
  currency?: string;
  date: string | Date;
  description?: string | null;
  referenceNo?: string | null;
  clientId?: string | null;
  caseFileId?: string | null;
};

export type CashTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: string | number | Prisma.Decimal;
  currency?: string;
  date: string | Date;
  description?: string | null;
};

export type SerializableLedgerEntry = {
  id: string;
  cashAccountId: string;
  cashAccountName: string;
  direction: CashLedgerDirection;
  entryType: CashLedgerEntryType;
  amount: number;
  signedAmount: number;
  amountLabel: string;
  signedAmountLabel: string;
  tone: "green" | "rose" | "neutral";
  currency: string;
  date: string;
  dateInput: string;
  description: string;
  referenceNo: string;
  incomeId: string | null;
  expenseId: string | null;
  invoiceOrReceiptId: string | null;
  clientId: string | null;
  clientName: string;
  caseFileId: string | null;
  caseFileTitle: string;
  createdAt: string;
};

export type RunningBalancePoint = {
  date: string;
  label: string;
  balance: number;
  balanceLabel: string;
  tone: "green" | "rose" | "neutral";
};

const ledgerEntrySelect = {
  id: true,
  cashAccountId: true,
  direction: true,
  entryType: true,
  amount: true,
  currency: true,
  date: true,
  description: true,
  referenceNo: true,
  incomeId: true,
  expenseId: true,
  invoiceOrReceiptId: true,
  clientId: true,
  caseFileId: true,
  createdAt: true,
  cashAccount: { select: { name: true } },
  client: { select: { name: true } },
  caseFile: { select: { title: true } }
} satisfies Prisma.CashLedgerEntrySelect;

type LedgerEntryRow = Prisma.CashLedgerEntryGetPayload<{ select: typeof ledgerEntrySelect }>;

export async function createLedgerEntryFromIncome(income: IncomeLedgerSource, db: CashDb = prisma): Promise<SerializableLedgerEntry> {
  const ledger = await syncIncomeLedgerEntry(income.userId, income, db);
  return getSerializedLedgerEntry(income.userId, ledger.id, db);
}

export async function updateLedgerEntryFromIncome(income: IncomeLedgerSource, db: CashDb = prisma): Promise<SerializableLedgerEntry> {
  const ledger = await syncIncomeLedgerEntry(income.userId, income, db);
  return getSerializedLedgerEntry(income.userId, ledger.id, db);
}

export async function softDeleteLedgerEntryFromIncome(userId: string, incomeId: string, db: CashDb = prisma) {
  return db.cashLedgerEntry.updateMany({
    where: { userId, incomeId, deletedAt: null },
    data: { deletedAt: new Date() }
  });
}

export async function createLedgerEntryFromExpense(expense: ExpenseLedgerSource, db: CashDb = prisma): Promise<SerializableLedgerEntry> {
  const ledger = await syncExpenseLedgerEntry(expense.userId, expense, db);
  return getSerializedLedgerEntry(expense.userId, ledger.id, db);
}

export async function updateLedgerEntryFromExpense(expense: ExpenseLedgerSource, db: CashDb = prisma): Promise<SerializableLedgerEntry> {
  const ledger = await syncExpenseLedgerEntry(expense.userId, expense, db);
  return getSerializedLedgerEntry(expense.userId, ledger.id, db);
}

export async function softDeleteLedgerEntryFromExpense(userId: string, expenseId: string, db: CashDb = prisma) {
  return db.cashLedgerEntry.updateMany({
    where: { userId, expenseId, deletedAt: null },
    data: { deletedAt: new Date() }
  });
}

export async function syncIncomeLedgerEntry(userId: string, income: IncomeLedgerSource, db: CashDb = prisma) {
  const cashAccountId = income.cashAccountId ?? (await ensureDefaultCashAccount(userId, db)).id;

  return db.cashLedgerEntry.upsert({
    where: { incomeId: income.id },
    update: {
      userId,
      cashAccountId,
      direction: "IN",
      entryType: "INCOME",
      amount: income.amount,
      currency: income.currency,
      date: income.date,
      description: income.description,
      referenceNo: income.receiptNumber,
      clientId: income.clientId,
      caseFileId: income.caseFileId,
      deletedAt: income.deletedAt
    },
    create: {
      userId,
      cashAccountId,
      direction: "IN",
      entryType: "INCOME",
      amount: income.amount,
      currency: income.currency,
      date: income.date,
      description: income.description,
      referenceNo: income.receiptNumber,
      incomeId: income.id,
      clientId: income.clientId,
      caseFileId: income.caseFileId,
      deletedAt: income.deletedAt
    }
  });
}

export async function syncExpenseLedgerEntry(userId: string, expense: ExpenseLedgerSource, db: CashDb = prisma) {
  const cashAccountId = expense.cashAccountId ?? (await ensureDefaultCashAccount(userId, db)).id;

  return db.cashLedgerEntry.upsert({
    where: { expenseId: expense.id },
    update: {
      userId,
      cashAccountId,
      direction: "OUT",
      entryType: "EXPENSE",
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      description: expense.description,
      referenceNo: null,
      clientId: expense.clientId,
      caseFileId: expense.caseFileId,
      deletedAt: expense.deletedAt
    },
    create: {
      userId,
      cashAccountId,
      direction: "OUT",
      entryType: "EXPENSE",
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      description: expense.description,
      expenseId: expense.id,
      clientId: expense.clientId,
      caseFileId: expense.caseFileId,
      deletedAt: expense.deletedAt
    }
  });
}

export async function createManualAdjustment(userId: string, data: ManualAdjustmentInput): Promise<SerializableLedgerEntry> {
  const ledger = await prisma.$transaction(async (tx) => {
    const cashAccountId = await resolveCashAccountId(userId, data.cashAccountId, tx);

    return tx.cashLedgerEntry.create({
      data: {
        userId,
        cashAccountId,
        direction: data.direction,
        entryType: "ADJUSTMENT",
        amount: toDecimal(data.amount),
        currency: (data.currency ?? "TRY").toUpperCase(),
        date: normalizeDate(data.date),
        description: clean(data.description),
        referenceNo: clean(data.referenceNo),
        clientId: clean(data.clientId),
        caseFileId: clean(data.caseFileId)
      },
      select: ledgerEntrySelect
    });
  });

  await writeAuditLog({
    entityType: "CASH_LEDGER_ENTRY",
    entityId: ledger.id,
    action: "CREATE",
    newValue: ledger,
    message: "Manuel kasa düzeltmesi oluşturuldu",
    userId
  });

  return serializeLedgerEntry(ledger);
}

export async function createCashTransfer(userId: string, data: CashTransferInput) {
  const result = await prisma.$transaction(async (tx) => {
    const fromAccountId = await resolveCashAccountId(userId, data.fromAccountId, tx);
    const toAccountId = await resolveCashAccountId(userId, data.toAccountId, tx);

    if (fromAccountId === toAccountId) {
      throw new Error("Aynı kasa hesabına transfer yapılamaz.");
    }

    const amount = toDecimal(data.amount);
    const currency = (data.currency ?? "TRY").toUpperCase();
    const transfer = await tx.cashTransfer.create({
      data: {
        userId,
        fromAccountId,
        toAccountId,
        amount,
        currency,
        date: normalizeDate(data.date),
        description: clean(data.description)
      }
    });
    const [outEntry, inEntry] = await Promise.all([
      tx.cashLedgerEntry.create({
        data: {
          userId,
          cashAccountId: fromAccountId,
          direction: "OUT",
          entryType: "TRANSFER",
          amount,
          currency,
          date: transfer.date,
          description: transfer.description,
          referenceNo: transfer.id
        },
        select: ledgerEntrySelect
      }),
      tx.cashLedgerEntry.create({
        data: {
          userId,
          cashAccountId: toAccountId,
          direction: "IN",
          entryType: "TRANSFER",
          amount,
          currency,
          date: transfer.date,
          description: transfer.description,
          referenceNo: transfer.id
        },
        select: ledgerEntrySelect
      })
    ]);

    return { transfer, entries: [outEntry, inEntry] };
  });

  await writeAuditLog({
    entityType: "CASH_TRANSFER",
    entityId: result.transfer.id,
    action: "CREATE",
    newValue: result.transfer,
    message: "Kasa hesapları arası transfer oluşturuldu",
    userId
  });
  await Promise.all(
    result.entries.map((entry) =>
      writeAuditLog({
        entityType: "CASH_LEDGER_ENTRY",
        entityId: entry.id,
        action: "CREATE",
        newValue: entry,
        message: "Transfer kasa hareketi oluşturuldu",
        userId
      })
    )
  );

  return {
    transfer: {
      id: result.transfer.id,
      fromAccountId: result.transfer.fromAccountId,
      toAccountId: result.transfer.toAccountId,
      amount: toNumber(result.transfer.amount),
      amountLabel: formatMoney(result.transfer.amount, result.transfer.currency),
      currency: result.transfer.currency,
      date: formatDate(result.transfer.date),
      dateInput: dateInputValue(result.transfer.date),
      description: result.transfer.description ?? ""
    },
    entries: result.entries.map(serializeLedgerEntry)
  };
}

export async function getLedgerEntries(filters: LedgerEntryFilters): Promise<SerializableLedgerEntry[]> {
  const entries = await prisma.cashLedgerEntry.findMany({
    where: cashLedgerWhere(filters),
    select: ledgerEntrySelect,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: filters.skip,
    take: Math.min(filters.take ?? 50, 500)
  });

  return entries.map(serializeLedgerEntry);
}

export async function countLedgerEntries(filters: LedgerEntryFilters): Promise<number> {
  return prisma.cashLedgerEntry.count({
    where: cashLedgerWhere(filters)
  });
}

export async function getRunningBalance(
  userId: string,
  accountId: string,
  dateRange: { startDate?: string; endDate?: string }
): Promise<RunningBalancePoint[]> {
  const account = await prisma.cashAccount.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { id: true, currency: true, openingBalance: true }
  });

  if (!account) {
    return [];
  }

  const today = startOfDay(new Date());
  const start = dateRange.startDate ? parseDateInput(dateRange.startDate) : today;
  const end = dateRange.endDate ? endOfDateInput(dateRange.endDate) : endOfDateInput(dateInputValue(today));
  const [previousEntries, rangeEntries] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where: {
        userId,
        cashAccountId: account.id,
        deletedAt: null,
        cashAccount: { deletedAt: null },
        date: { lt: start }
      },
      select: { direction: true, amount: true }
    }),
    prisma.cashLedgerEntry.findMany({
      where: {
        userId,
        cashAccountId: account.id,
        deletedAt: null,
        cashAccount: { deletedAt: null },
        date: { gte: start, lte: end }
      },
      select: { direction: true, amount: true, date: true },
      orderBy: { date: "asc" }
    })
  ]);
  let running = previousEntries.reduce(
    (total, entry) => total.plus(signedDecimal(entry.direction, entry.amount)),
    account.openingBalance
  );
  const points: RunningBalancePoint[] = [];

  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dayKey = dateInputValue(cursor);
    for (const entry of rangeEntries) {
      if (dateInputValue(entry.date) === dayKey) {
        running = running.plus(signedDecimal(entry.direction, entry.amount));
      }
    }
    const balance = toNumber(running);
    points.push({
      date: dayKey,
      label: formatDate(cursor),
      balance,
      balanceLabel: formatMoney(balance, account.currency),
      tone: balance > 0 ? "green" : balance < 0 ? "rose" : "neutral"
    });
  }

  return points;
}

export function cashLedgerWhere(filters: LedgerEntryFilters): Prisma.CashLedgerEntryWhereInput {
  return {
    userId: filters.userId,
    deletedAt: null,
    cashAccount: { deletedAt: null },
    ...(filters.cashAccountId ? { cashAccountId: filters.cashAccountId } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {}),
    ...(filters.entryType ? { entryType: filters.entryType } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...dateWhere(filters.startDate, filters.endDate)
  };
}

export function serializeLedgerEntry(row: LedgerEntryRow): SerializableLedgerEntry {
  const amount = toNumber(row.amount);
  const signedAmount = row.direction === "IN" ? amount : -amount;

  return {
    id: row.id,
    cashAccountId: row.cashAccountId,
    cashAccountName: row.cashAccount.name,
    direction: row.direction,
    entryType: row.entryType,
    amount,
    signedAmount,
    amountLabel: formatMoney(amount, row.currency),
    signedAmountLabel: formatSignedMoney(signedAmount, row.currency),
    tone: signedAmount > 0 ? "green" : signedAmount < 0 ? "rose" : "neutral",
    currency: row.currency,
    date: formatDate(row.date),
    dateInput: dateInputValue(row.date),
    description: row.description ?? "",
    referenceNo: row.referenceNo ?? "",
    incomeId: row.incomeId,
    expenseId: row.expenseId,
    invoiceOrReceiptId: row.invoiceOrReceiptId,
    clientId: row.clientId,
    clientName: row.client?.name ?? "",
    caseFileId: row.caseFileId,
    caseFileTitle: row.caseFile?.title ?? "",
    createdAt: formatDate(row.createdAt)
  };
}

async function getSerializedLedgerEntry(userId: string, id: string, db: CashDb = prisma): Promise<SerializableLedgerEntry> {
  const row = await db.cashLedgerEntry.findFirst({
    where: { id, userId },
    select: ledgerEntrySelect
  });

  if (!row) {
    throw new Error("Kasa hareketi bulunamadı.");
  }

  return serializeLedgerEntry(row);
}

export function signedDecimal(direction: CashLedgerDirection, amount: Prisma.Decimal) {
  return direction === "IN" ? amount : amount.negated();
}

export function reminderTypeToCashTone(type: ReminderType) {
  return type === "COLLECTION" ? "green" : type === "GENERAL" || type === "CASE" ? "neutral" : "rose";
}

function dateWhere(startDate?: string, endDate?: string) {
  const value: Prisma.DateTimeFilter = {};

  if (startDate) {
    value.gte = parseDateInput(startDate);
  }

  if (endDate) {
    value.lte = endOfDateInput(endDate);
  }

  return value.gte || value.lte ? { date: value } : {};
}

function normalizeDate(value: string | Date) {
  return value instanceof Date ? value : parseDateInput(value);
}

function toDecimal(value: string | number | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}
