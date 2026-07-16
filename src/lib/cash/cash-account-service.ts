import { Prisma, type CashAccountType } from "@prisma/client";
import { cache } from "react";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toNumber } from "@/lib/utils";

export type CashDb = Prisma.TransactionClient;

export type CashAccountInput = {
  name: string;
  type?: CashAccountType;
  currency?: string;
  openingBalance?: string | number | Prisma.Decimal;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type CashAccountListItem = {
  id: string;
  name: string;
  type: CashAccountType;
  currency: string;
  openingBalance: number;
  openingBalanceLabel: string;
  currentBalance: number;
  currentBalanceLabel: string;
  description: string;
  color: string;
  icon: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CashAccountBalance = {
  accountId: string;
  accountName: string;
  type: CashAccountType;
  currency: string;
  balance: number;
  balanceLabel: string;
  tone: "green" | "rose" | "neutral";
};

export class CashAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashAccountError";
  }
}

export async function getCashAccounts(userId: string): Promise<CashAccountListItem[]> {
  const accounts = await prisma.cashAccount.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }]
  });
  const balances = await getAllCashAccountBalances(userId);
  const balanceMap = new Map(balances.map((balance) => [balance.accountId, balance]));

  return accounts.map((account) => serializeCashAccount(account, balanceMap.get(account.id)?.balance ?? 0));
}

export async function getActiveCashAccounts(userId: string): Promise<CashAccountListItem[]> {
  const accounts = await getCashAccounts(userId);
  return accounts.filter((account) => account.isActive);
}

export async function getDefaultCashAccount(userId: string): Promise<CashAccountListItem> {
  const account = await ensureDefaultCashAccount(userId);
  const balance = await getCashAccountBalance(userId, account.id);
  return serializeCashAccount(account, balance.balance);
}

export async function createCashAccount(userId: string, data: CashAccountInput): Promise<CashAccountListItem> {
  const account = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.cashAccount.updateMany({
        where: { userId, deletedAt: null, isDefault: true },
        data: { isDefault: false }
      });
    }

    return tx.cashAccount.create({
      data: normalizeCashAccountInput(userId, data)
    });
  });
  const balance = await getCashAccountBalance(userId, account.id);

  await writeAuditLog({
    entityType: "CASH_ACCOUNT",
    entityId: account.id,
    action: "CREATE",
    newValue: account,
    message: "Kasa hesabı oluşturuldu",
    userId
  });

  return serializeCashAccount(account, balance.balance);
}

export async function updateCashAccount(userId: string, id: string, data: CashAccountInput): Promise<CashAccountListItem> {
  const existing = await prisma.cashAccount.findFirst({ where: { id, userId, deletedAt: null } });

  if (!existing) {
    throw new CashAccountError("Kasa hesabı bulunamadı.");
  }

  const account = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.cashAccount.updateMany({
        where: { userId, deletedAt: null, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    return tx.cashAccount.update({
      where: { id },
      data: normalizeCashAccountUpdateInput(data)
    });
  });
  const balance = await getCashAccountBalance(userId, account.id);

  await writeAuditLog({
    entityType: "CASH_ACCOUNT",
    entityId: account.id,
    action: "UPDATE",
    oldValue: existing,
    newValue: account,
    message: "Kasa hesabı güncellendi",
    userId
  });

  return serializeCashAccount(account, balance.balance);
}

export async function softDeleteCashAccount(userId: string, id: string) {
  const existing = await prisma.cashAccount.findFirst({ where: { id, userId, deletedAt: null } });

  if (!existing) {
    throw new CashAccountError("Kasa hesabı bulunamadı.");
  }

  if (existing.isDefault) {
    throw new CashAccountError("Varsayılan kasa hesabı silinemez. Önce başka bir hesabı varsayılan yapın.");
  }

  const activeLinkedEntries = await prisma.cashLedgerEntry.count({
    where: { userId, cashAccountId: id, deletedAt: null }
  });

  if (activeLinkedEntries > 0) {
    const archived = await prisma.cashAccount.update({
      where: { id },
      data: { isActive: false }
    });

    await writeAuditLog({
      entityType: "CASH_ACCOUNT",
      entityId: archived.id,
      action: "ARCHIVE",
      oldValue: existing,
      newValue: archived,
      message: "Hareketi olan kasa hesabı arşivlendi",
      userId
    });

    const balance = await getCashAccountBalance(userId, archived.id);
    return serializeCashAccount(archived, balance.balance);
  }

  const deleted = await prisma.cashAccount.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, isDefault: false }
  });

  await writeAuditLog({
    entityType: "CASH_ACCOUNT",
    entityId: deleted.id,
    action: "DELETE",
    oldValue: existing,
    newValue: deleted,
    message: "Kasa hesabı silindi",
    userId
  });

  return serializeCashAccount(deleted, 0);
}

export async function getCashAccountBalance(userId: string, id: string): Promise<CashAccountBalance> {
  const account = await prisma.cashAccount.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      openingBalance: true
    }
  });

  if (!account) {
    throw new CashAccountError("Kasa hesabı bulunamadı.");
  }

  const [inTotal, outTotal] = await Promise.all([
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId, cashAccountId: id, deletedAt: null, direction: "IN" }
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId, cashAccountId: id, deletedAt: null, direction: "OUT" }
    })
  ]);
  const balanceDecimal = account.openingBalance
    .plus(inTotal._sum.amount ?? new Prisma.Decimal(0))
    .minus(outTotal._sum.amount ?? new Prisma.Decimal(0));
  const balance = toNumber(balanceDecimal);

  return {
    accountId: account.id,
    accountName: account.name,
    type: account.type,
    currency: account.currency,
    balance,
    balanceLabel: formatMoney(balance, account.currency),
    tone: balance > 0 ? "green" : balance < 0 ? "rose" : "neutral"
  };
}

export const getAllCashAccountBalances = cache(async (userId: string): Promise<CashAccountBalance[]> => {
  const accounts = await prisma.cashAccount.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      openingBalance: true
    }
  });
  const entries = await prisma.cashLedgerEntry.groupBy({
    by: ["cashAccountId", "direction"],
    where: { userId, deletedAt: null, cashAccount: { deletedAt: null } },
    _sum: { amount: true }
  });
  const entryMap = new Map<string, { in: Prisma.Decimal; out: Prisma.Decimal }>();

  for (const entry of entries) {
    const current = entryMap.get(entry.cashAccountId) ?? { in: new Prisma.Decimal(0), out: new Prisma.Decimal(0) };
    if (entry.direction === "IN") {
      current.in = current.in.plus(entry._sum.amount ?? 0);
    } else {
      current.out = current.out.plus(entry._sum.amount ?? 0);
    }
    entryMap.set(entry.cashAccountId, current);
  }

  return accounts.map((account) => {
    const totals = entryMap.get(account.id) ?? { in: new Prisma.Decimal(0), out: new Prisma.Decimal(0) };
    const balance = toNumber(account.openingBalance.plus(totals.in).minus(totals.out));
    return {
      accountId: account.id,
      accountName: account.name,
      type: account.type,
      currency: account.currency,
      balance,
      balanceLabel: formatMoney(balance, account.currency),
      tone: balance > 0 ? "green" : balance < 0 ? "rose" : "neutral"
    };
  });
});

export async function resolveCashAccountId(userId: string, requestedId?: string | null, db: CashDb = prisma) {
  const cleanId = requestedId?.trim();

  if (cleanId) {
    const account = await db.cashAccount.findFirst({
      where: { id: cleanId, userId, deletedAt: null, isActive: true },
      select: { id: true }
    });

    if (!account) {
      throw new CashAccountError("Kasa hesabı bulunamadı veya kullanıma kapalı.");
    }

    return account.id;
  }

  const defaultAccount = await ensureDefaultCashAccount(userId, db);
  return defaultAccount.id;
}

export async function ensureDefaultCashAccount(userId: string, db: CashDb = prisma) {
  const existing = await db.cashAccount.findFirst({
    where: { userId, isDefault: true, deletedAt: null },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return db.cashAccount.create({
    data: {
      userId,
      name: "Ana Kasa",
      type: "CASH",
      currency: "TRY",
      openingBalance: new Prisma.Decimal(0),
      description: "V2 dijital kasa varsayılan hesabı",
      color: "#16a34a",
      icon: "wallet",
      isDefault: true,
      isActive: true
    }
  });
}

function normalizeCashAccountInput(userId: string, data: CashAccountInput): Prisma.CashAccountUncheckedCreateInput {
  return {
    userId,
    name: data.name.trim(),
    type: data.type ?? "CASH",
    currency: (data.currency ?? "TRY").toUpperCase(),
    openingBalance: toDecimal(data.openingBalance ?? 0),
    description: clean(data.description),
    color: clean(data.color),
    icon: clean(data.icon),
    isDefault: data.isDefault ?? false,
    isActive: data.isActive ?? true
  };
}

function normalizeCashAccountUpdateInput(data: CashAccountInput): Prisma.CashAccountUncheckedUpdateInput {
  return {
    name: data.name.trim(),
    type: data.type ?? "CASH",
    currency: (data.currency ?? "TRY").toUpperCase(),
    openingBalance: toDecimal(data.openingBalance ?? 0),
    description: clean(data.description),
    color: clean(data.color),
    icon: clean(data.icon),
    isDefault: data.isDefault ?? false,
    isActive: data.isActive ?? true
  };
}

function serializeCashAccount(
  account: {
    id: string;
    name: string;
    type: CashAccountType;
    currency: string;
    openingBalance: Prisma.Decimal;
    description: string | null;
    color: string | null;
    icon: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  currentBalance: number
): CashAccountListItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: toNumber(account.openingBalance),
    openingBalanceLabel: formatMoney(account.openingBalance, account.currency),
    currentBalance,
    currentBalanceLabel: formatMoney(currentBalance, account.currency),
    description: account.description ?? "",
    color: account.color ?? "",
    icon: account.icon ?? "",
    isDefault: account.isDefault,
    isActive: account.isActive,
    createdAt: formatDate(account.createdAt),
    updatedAt: formatDate(account.updatedAt)
  };
}

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function toDecimal(value: string | number | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}
