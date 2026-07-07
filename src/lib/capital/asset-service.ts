import { Prisma, type AssetTransactionType, type AssetType, type AssetValuationSource } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatMoney, toNumber } from "@/lib/utils";

type CapitalDb = Prisma.TransactionClient;

export type AssetAccountInput = {
  name: string;
  assetType: AssetType;
  currency?: string | null;
  symbol?: string | null;
  quantity?: string | number | Prisma.Decimal | null;
  unitPrice?: string | number | Prisma.Decimal | null;
  manualTotalValue?: string | number | Prisma.Decimal | null;
  valuationCurrency?: string | null;
  linkedCashAccountId?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type AssetValuationInput = {
  assetAccountId: string;
  valuationDate: string | Date;
  quantity?: string | number | Prisma.Decimal | null;
  unitPrice?: string | number | Prisma.Decimal | null;
  totalValue: string | number | Prisma.Decimal;
  valuationCurrency?: string | null;
  source?: AssetValuationSource;
  note?: string | null;
};

export type AssetTransactionInput = {
  assetAccountId: string;
  transactionType: AssetTransactionType;
  date: string | Date;
  quantity?: string | number | Prisma.Decimal | null;
  unitPrice?: string | number | Prisma.Decimal | null;
  totalAmount: string | number | Prisma.Decimal;
  currency?: string | null;
  description?: string | null;
  linkedCashLedgerEntryId?: string | null;
};

export class CapitalAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapitalAssetError";
  }
}

export async function createAssetAccount(userId: string, data: AssetAccountInput) {
  const linkedCashAccountId = await resolveLinkedCashAccountId(userId, data.linkedCashAccountId);
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.assetAccount.create({
      data: normalizeAssetAccountInput(userId, data, linkedCashAccountId)
    });
    const initialValue = initialAssetValue(account);

    if (!initialValue || initialValue.lessThanOrEqualTo(0)) {
      return { account, valuation: null, transaction: null };
    }

    const valuationDate = new Date();
    const valuation = await tx.assetValuation.create({
      data: {
        userId,
        assetAccountId: account.id,
        valuationDate,
        quantity: account.quantity,
        unitPrice: account.unitPrice,
        totalValue: initialValue,
        valuationCurrency: account.valuationCurrency,
        source: "MANUAL",
        note: "İlk manuel değerleme"
      }
    });
    const transaction = await tx.assetTransaction.create({
      data: {
        userId,
        assetAccountId: account.id,
        transactionType: "VALUE_UPDATE",
        date: valuationDate,
        quantity: account.quantity,
        unitPrice: account.unitPrice,
        totalAmount: initialValue,
        currency: account.valuationCurrency,
        description: "İlk manuel değerleme"
      }
    });

    return { account, valuation, transaction };
  });

  await writeAuditLog({
    entityType: "ASSET_ACCOUNT",
    entityId: result.account.id,
    action: "CREATE",
    newValue: result.account,
    message: "Varlık hesabı oluşturuldu",
    userId
  });
  if (result.valuation) {
    await writeAuditLog({
      entityType: "ASSET_VALUATION",
      entityId: result.valuation.id,
      action: "VALUE_UPDATE",
      newValue: result.valuation,
      message: "İlk manuel varlık değerlemesi kaydedildi",
      userId
    });
  }
  if (result.transaction) {
    await writeAuditLog({
      entityType: "ASSET_TRANSACTION",
      entityId: result.transaction.id,
      action: "VALUE_UPDATE",
      newValue: result.transaction,
      message: "İlk manuel varlık hareketi kaydedildi",
      userId
    });
  }

  return serializeAssetAccount(result.account);
}

export async function updateAssetAccount(userId: string, id: string, data: AssetAccountInput) {
  const existing = await prisma.assetAccount.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new CapitalAssetError("Varlık hesabı bulunamadı.");

  const linkedCashAccountId = await resolveLinkedCashAccountId(userId, data.linkedCashAccountId);
  const updated = await prisma.assetAccount.update({
    where: { id: existing.id },
    data: normalizeAssetAccountUpdateInput(data, linkedCashAccountId)
  });

  await writeAuditLog({
    entityType: "ASSET_ACCOUNT",
    entityId: updated.id,
    action: "UPDATE",
    oldValue: existing,
    newValue: updated,
    message: "Varlık hesabı güncellendi",
    userId
  });

  return serializeAssetAccount(updated);
}

export async function softDeleteAssetAccount(userId: string, id: string) {
  const existing = await prisma.assetAccount.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new CapitalAssetError("Varlık hesabı bulunamadı.");

  const deleted = await prisma.assetAccount.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), isActive: false }
  });

  await writeAuditLog({
    entityType: "ASSET_ACCOUNT",
    entityId: deleted.id,
    action: "DELETE",
    oldValue: existing,
    newValue: deleted,
    message: "Varlık hesabı silindi",
    userId
  });

  return serializeAssetAccount(deleted);
}

export async function createAssetValuation(userId: string, data: AssetValuationInput) {
  const result = await prisma.$transaction(async (tx) => {
    const account = await ensureOwnedAssetAccount(userId, data.assetAccountId, tx);
    const quantity = optionalDecimal(data.quantity);
    const unitPrice = optionalDecimal(data.unitPrice);
    const totalValue = requiredDecimal(data.totalValue);
    const valuationDate = normalizeDate(data.valuationDate);
    const valuationCurrency = normalizeCurrency(data.valuationCurrency ?? account.valuationCurrency);
    const created = await tx.assetValuation.create({
      data: {
        userId,
        assetAccountId: account.id,
        valuationDate,
        quantity,
        unitPrice,
        totalValue,
        valuationCurrency,
        source: data.source ?? "MANUAL",
        note: clean(data.note)
      }
    });
    const transaction = await tx.assetTransaction.create({
      data: {
        userId,
        assetAccountId: account.id,
        transactionType: "VALUE_UPDATE",
        date: valuationDate,
        quantity,
        unitPrice,
        totalAmount: totalValue,
        currency: valuationCurrency,
        description: clean(data.note) ?? "Manuel değer güncelleme"
      }
    });

    await tx.assetAccount.update({
      where: { id: account.id },
      data: {
        quantity: quantity ?? account.quantity,
        unitPrice: unitPrice ?? account.unitPrice,
        manualTotalValue: totalValue,
        valuationCurrency
      }
    });

    return { valuation: created, transaction };
  });

  await writeAuditLog({
    entityType: "ASSET_VALUATION",
    entityId: result.valuation.id,
    action: "VALUE_UPDATE",
    newValue: result.valuation,
    message: "Varlık değerlemesi kaydedildi",
    userId
  });
  await writeAuditLog({
    entityType: "ASSET_TRANSACTION",
    entityId: result.transaction.id,
    action: "VALUE_UPDATE",
    newValue: result.transaction,
    message: "Varlık değer güncelleme hareketi kaydedildi",
    userId
  });

  return serializeAssetValuation(result.valuation);
}

export async function createAssetTransaction(userId: string, data: AssetTransactionInput) {
  const transaction = await prisma.$transaction(async (tx) => {
    const account = await ensureOwnedAssetAccount(userId, data.assetAccountId, tx);
    const linkedCashLedgerEntryId = await resolveLinkedLedgerEntryId(userId, data.linkedCashLedgerEntryId, tx);

    return tx.assetTransaction.create({
      data: {
        userId,
        assetAccountId: account.id,
        transactionType: data.transactionType,
        date: normalizeDate(data.date),
        quantity: optionalDecimal(data.quantity),
        unitPrice: optionalDecimal(data.unitPrice),
        totalAmount: requiredDecimal(data.totalAmount),
        currency: normalizeCurrency(data.currency ?? account.valuationCurrency),
        description: clean(data.description),
        linkedCashLedgerEntryId
      }
    });
  });

  await writeAuditLog({
    entityType: "ASSET_TRANSACTION",
    entityId: transaction.id,
    action: transaction.transactionType === "VALUE_UPDATE" ? "VALUE_UPDATE" : "CREATE",
    newValue: transaction,
    message: "Varlık hareketi kaydedildi",
    userId
  });

  return serializeAssetTransaction(transaction);
}

export async function getCapitalSummary(userId: string, currency = "TRY") {
  const valuationCurrency = normalizeCurrency(currency);
  const [accounts, latestValuations, cashBalances] = await Promise.all([
    prisma.assetAccount.findMany({
      where: { userId, deletedAt: null, isActive: true, valuationCurrency },
      orderBy: [{ assetType: "asc" }, { name: "asc" }]
    }),
    prisma.assetValuation.findMany({
      where: { userId, valuationCurrency },
      orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }]
    }),
    getAllCashAccountBalances(userId)
  ]);
  const valuationMap = new Map<string, (typeof latestValuations)[number]>();
  for (const valuation of latestValuations) {
    if (!valuationMap.has(valuation.assetAccountId)) valuationMap.set(valuation.assetAccountId, valuation);
  }
  const cashBalanceMap = new Map(cashBalances.map((balance) => [balance.accountId, balance]));
  const breakdown = new Map<AssetType, Prisma.Decimal>();
  let totalAssets = decimalZero();
  let totalDebts = decimalZero();

  const rows = accounts.map((account) => {
    const value = currentAssetValue(account, valuationMap.get(account.id), cashBalanceMap.get(account.linkedCashAccountId ?? ""));
    const absoluteValue = value.abs();
    const signedValue = account.assetType === "DEBT" ? absoluteValue.negated() : value;
    const currentBreakdown = breakdown.get(account.assetType) ?? decimalZero();
    breakdown.set(account.assetType, currentBreakdown.plus(signedValue));

    if (account.assetType === "DEBT") {
      totalDebts = totalDebts.plus(absoluteValue);
    } else {
      totalAssets = totalAssets.plus(value);
    }

    return {
      ...serializeAssetAccount(account),
      currentValue: toNumber(signedValue),
      currentValueLabel: formatMoney(signedValue, valuationCurrency),
      tone: signedValue.greaterThan(0) ? "green" : signedValue.lessThan(0) ? "rose" : "neutral"
    };
  });
  const netWorth = totalAssets.minus(totalDebts);

  return {
    currency: valuationCurrency,
    totalAssets: toNumber(totalAssets),
    totalAssetsLabel: formatMoney(totalAssets, valuationCurrency),
    totalDebts: toNumber(totalDebts),
    totalDebtsLabel: formatMoney(totalDebts, valuationCurrency),
    netWorth: toNumber(netWorth),
    netWorthLabel: formatMoney(netWorth, valuationCurrency),
    rows,
    breakdown: Object.fromEntries(
      [...breakdown.entries()].map(([assetType, value]) => [
        assetType,
        {
          value: toNumber(value),
          valueLabel: formatMoney(value, valuationCurrency)
        }
      ])
    )
  };
}

export async function createCapitalSnapshot(userId: string, currency = "TRY") {
  const summary = await getCapitalSummary(userId, currency);
  const snapshot = await prisma.capitalSnapshot.create({
    data: {
      userId,
      snapshotDate: new Date(),
      totalAssets: requiredDecimal(summary.totalAssets),
      totalDebts: requiredDecimal(summary.totalDebts),
      netWorth: requiredDecimal(summary.netWorth),
      currency: summary.currency,
      breakdown: summary.breakdown
    }
  });

  await writeAuditLog({
    entityType: "CAPITAL_SNAPSHOT",
    entityId: snapshot.id,
    action: "CREATE",
    newValue: snapshot,
    message: "Sermaye anlık görüntüsü oluşturuldu",
    userId
  });

  return {
    id: snapshot.id,
    snapshotDate: dateInputValue(snapshot.snapshotDate),
    totalAssets: toNumber(snapshot.totalAssets),
    totalDebts: toNumber(snapshot.totalDebts),
    netWorth: toNumber(snapshot.netWorth),
    currency: snapshot.currency,
    breakdown: snapshot.breakdown,
    createdAt: snapshot.createdAt.toISOString()
  };
}

async function ensureOwnedAssetAccount(userId: string, assetAccountId: string, db: CapitalDb = prisma) {
  const account = await db.assetAccount.findFirst({ where: { id: assetAccountId, userId, deletedAt: null } });
  if (!account) throw new CapitalAssetError("Varlık hesabı bulunamadı.");
  return account;
}

async function resolveLinkedCashAccountId(userId: string, linkedCashAccountId?: string | null, db: CapitalDb = prisma) {
  const cleanId = clean(linkedCashAccountId);
  if (!cleanId) return null;

  const account = await db.cashAccount.findFirst({ where: { id: cleanId, userId, deletedAt: null }, select: { id: true } });
  if (!account) throw new CapitalAssetError("Bağlanacak kasa hesabı bulunamadı.");
  return account.id;
}

async function resolveLinkedLedgerEntryId(userId: string, linkedCashLedgerEntryId?: string | null, db: CapitalDb = prisma) {
  const cleanId = clean(linkedCashLedgerEntryId);
  if (!cleanId) return null;

  const entry = await db.cashLedgerEntry.findFirst({ where: { id: cleanId, userId, deletedAt: null }, select: { id: true } });
  if (!entry) throw new CapitalAssetError("Bağlanacak kasa hareketi bulunamadı.");
  return entry.id;
}

function currentAssetValue(
  account: {
    quantity: Prisma.Decimal | null;
    unitPrice: Prisma.Decimal | null;
    manualTotalValue: Prisma.Decimal | null;
    linkedCashAccountId: string | null;
  },
  latestValuation: { totalValue: Prisma.Decimal } | undefined,
  cashBalance: { balance: number } | undefined
) {
  if (cashBalance && account.linkedCashAccountId) return requiredDecimal(cashBalance.balance);
  if (account.manualTotalValue) return account.manualTotalValue;
  if (latestValuation) return latestValuation.totalValue;
  if (account.quantity && account.unitPrice) return account.quantity.mul(account.unitPrice);
  return decimalZero();
}

function initialAssetValue(account: {
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  manualTotalValue: Prisma.Decimal | null;
}) {
  if (account.manualTotalValue) return account.manualTotalValue.abs();
  if (account.quantity && account.unitPrice) return account.quantity.mul(account.unitPrice).abs();
  return null;
}

function normalizeAssetAccountInput(userId: string, data: AssetAccountInput, linkedCashAccountId: string | null): Prisma.AssetAccountUncheckedCreateInput {
  return {
    userId,
    name: data.name.trim(),
    assetType: data.assetType,
    currency: clean(data.currency)?.toUpperCase() ?? null,
    symbol: clean(data.symbol)?.toUpperCase() ?? null,
    quantity: optionalDecimal(data.quantity),
    unitPrice: optionalDecimal(data.unitPrice),
    manualTotalValue: optionalDecimal(data.manualTotalValue),
    valuationCurrency: normalizeCurrency(data.valuationCurrency),
    linkedCashAccountId,
    description: clean(data.description),
    isActive: data.isActive ?? true
  };
}

function normalizeAssetAccountUpdateInput(data: AssetAccountInput, linkedCashAccountId: string | null): Prisma.AssetAccountUncheckedUpdateInput {
  return {
    name: data.name.trim(),
    assetType: data.assetType,
    currency: clean(data.currency)?.toUpperCase() ?? null,
    symbol: clean(data.symbol)?.toUpperCase() ?? null,
    quantity: optionalDecimal(data.quantity),
    unitPrice: optionalDecimal(data.unitPrice),
    manualTotalValue: optionalDecimal(data.manualTotalValue),
    valuationCurrency: normalizeCurrency(data.valuationCurrency),
    linkedCashAccountId,
    description: clean(data.description),
    isActive: data.isActive ?? true
  };
}

function serializeAssetAccount(account: {
  id: string;
  name: string;
  assetType: AssetType;
  currency: string | null;
  symbol: string | null;
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  manualTotalValue: Prisma.Decimal | null;
  valuationCurrency: string;
  linkedCashAccountId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: account.id,
    name: account.name,
    assetType: account.assetType,
    currency: account.currency,
    symbol: account.symbol,
    quantity: account.quantity ? toNumber(account.quantity) : null,
    unitPrice: account.unitPrice ? toNumber(account.unitPrice) : null,
    manualTotalValue: account.manualTotalValue ? toNumber(account.manualTotalValue) : null,
    manualTotalValueLabel: account.manualTotalValue ? formatMoney(account.manualTotalValue, account.valuationCurrency) : "",
    valuationCurrency: account.valuationCurrency,
    linkedCashAccountId: account.linkedCashAccountId,
    description: account.description ?? "",
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    deletedAt: account.deletedAt?.toISOString() ?? null
  };
}

function serializeAssetValuation(valuation: {
  id: string;
  assetAccountId: string;
  valuationDate: Date;
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  totalValue: Prisma.Decimal;
  valuationCurrency: string;
  source: AssetValuationSource;
  note: string | null;
  createdAt: Date;
}) {
  return {
    id: valuation.id,
    assetAccountId: valuation.assetAccountId,
    valuationDate: dateInputValue(valuation.valuationDate),
    quantity: valuation.quantity ? toNumber(valuation.quantity) : null,
    unitPrice: valuation.unitPrice ? toNumber(valuation.unitPrice) : null,
    totalValue: toNumber(valuation.totalValue),
    totalValueLabel: formatMoney(valuation.totalValue, valuation.valuationCurrency),
    valuationCurrency: valuation.valuationCurrency,
    source: valuation.source,
    note: valuation.note ?? "",
    createdAt: valuation.createdAt.toISOString()
  };
}

function serializeAssetTransaction(transaction: {
  id: string;
  assetAccountId: string;
  transactionType: AssetTransactionType;
  date: Date;
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  totalAmount: Prisma.Decimal;
  currency: string;
  description: string | null;
  linkedCashLedgerEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: transaction.id,
    assetAccountId: transaction.assetAccountId,
    transactionType: transaction.transactionType,
    date: dateInputValue(transaction.date),
    quantity: transaction.quantity ? toNumber(transaction.quantity) : null,
    unitPrice: transaction.unitPrice ? toNumber(transaction.unitPrice) : null,
    totalAmount: toNumber(transaction.totalAmount),
    totalAmountLabel: formatMoney(transaction.totalAmount, transaction.currency),
    currency: transaction.currency,
    description: transaction.description ?? "",
    linkedCashLedgerEntryId: transaction.linkedCashLedgerEntryId,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    deletedAt: transaction.deletedAt?.toISOString() ?? null
  };
}

function normalizeDate(value: string | Date) {
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00+03:00`);
}

function normalizeCurrency(value?: string | null) {
  return (clean(value) ?? "TRY").toUpperCase();
}

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function optionalDecimal(value: string | number | Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return requiredDecimal(value);
}

function requiredDecimal(value: string | number | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function decimalZero() {
  return new Prisma.Decimal(0);
}
