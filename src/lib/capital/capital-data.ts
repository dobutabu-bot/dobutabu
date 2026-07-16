import { Prisma, type AssetType } from "@prisma/client";

import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import { assetTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatMoney, toNumber } from "@/lib/utils";

const volatileAssetTypes = new Set<AssetType>(["FX", "GOLD", "STOCK", "CRYPTO", "FUND"]);
const cashAssetTypes = new Set<AssetType>(["CASH", "BANK"]);

type CapitalAssetPagination = {
  page?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
  query?: string;
};

export async function getCapitalCenterData(userId: string, currency = "TRY", assetPagination: CapitalAssetPagination = {}) {
  const valuationCurrency = currency.toUpperCase();
  const [assets, cashBalances, cashAccounts, snapshots, valuationHistory] = await Promise.all([
    prisma.assetAccount.findMany({
      where: { userId, deletedAt: null, isActive: true },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
      include: {
        linkedCashAccount: { select: { name: true, currency: true } },
        valuations: {
          orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }],
          take: 1
        }
      }
    }),
    getAllCashAccountBalances(userId),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, currency: true, isDefault: true, isActive: true }
    }),
    prisma.capitalSnapshot.findMany({
      where: { userId, currency: valuationCurrency },
      orderBy: { snapshotDate: "asc" },
      take: 36
    }),
    prisma.assetValuation.findMany({
      where: { userId },
      orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }],
      include: { assetAccount: { select: { name: true, assetType: true, deletedAt: true } } },
      take: 200
    })
  ]);
  const cashBalanceMap = new Map(cashBalances.map((balance) => [balance.accountId, balance]));
  const rows = assets.map((asset) => serializeAsset(asset, cashBalanceMap.get(asset.linkedCashAccountId ?? "")));
  const assetQuery = assetPagination.query?.trim() ?? "";
  const normalizedAssetQuery = assetQuery.toLocaleLowerCase("tr-TR");
  const filteredRows = normalizedAssetQuery
    ? rows.filter((row) =>
        [row.name, row.symbol, row.currency, row.assetTypeLabel, row.description, row.linkedCashAccountName]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedAssetQuery)
      )
    : rows;
  const assetPageSize = assetPagination.take ?? assetPagination.pageSize ?? rows.length;
  const assetSkip = assetPagination.skip ?? 0;
  const assetPage = assetPagination.page ?? Math.floor(assetSkip / Math.max(assetPageSize, 1)) + 1;
  const pagedRows = filteredRows.slice(assetSkip, assetSkip + assetPageSize);
  const linkedCashAccountIds = new Set(rows.map((asset) => asset.linkedCashAccountId).filter((id): id is string => Boolean(id)));
  const activeRowsForCurrency = rows.filter((row) => row.valuationCurrency === valuationCurrency);
  const totals = calculateTotals(activeRowsForCurrency);
  const assetTypeDistribution = distributionByAssetType(activeRowsForCurrency);
  const currencyDistribution = distributionByCurrency(rows);
  const volatileTotal = activeRowsForCurrency
    .filter((row) => volatileAssetTypes.has(row.assetType))
    .reduce((total, row) => total + Math.abs(row.currentValue), 0);
  const cashTotal = activeRowsForCurrency
    .filter((row) => cashAssetTypes.has(row.assetType))
    .reduce((total, row) => total + Math.abs(row.currentValue), 0);
  const assetBase = totals.totalAssets > 0 ? totals.totalAssets : 0;

  return {
    currency: valuationCurrency,
    assetQuery,
    summary: {
      totalAssets: totals.totalAssets,
      totalAssetsLabel: formatMoney(totals.totalAssets, valuationCurrency),
      totalDebts: totals.totalDebts,
      totalDebtsLabel: formatMoney(totals.totalDebts, valuationCurrency),
      netWorth: totals.netWorth,
      netWorthLabel: formatMoney(totals.netWorth, valuationCurrency),
      cashBankTotal: sumByTypes(activeRowsForCurrency, ["CASH", "BANK"]),
      cashBankTotalLabel: formatMoney(sumByTypes(activeRowsForCurrency, ["CASH", "BANK"]), valuationCurrency),
      fxTotal: sumByTypes(activeRowsForCurrency, ["FX"]),
      fxTotalLabel: formatMoney(sumByTypes(activeRowsForCurrency, ["FX"]), valuationCurrency),
      goldTotal: sumByTypes(activeRowsForCurrency, ["GOLD"]),
      goldTotalLabel: formatMoney(sumByTypes(activeRowsForCurrency, ["GOLD"]), valuationCurrency),
      stockTotal: sumByTypes(activeRowsForCurrency, ["STOCK", "FUND"]),
      stockTotalLabel: formatMoney(sumByTypes(activeRowsForCurrency, ["STOCK", "FUND"]), valuationCurrency),
      cryptoTotal: sumByTypes(activeRowsForCurrency, ["CRYPTO"]),
      cryptoTotalLabel: formatMoney(sumByTypes(activeRowsForCurrency, ["CRYPTO"]), valuationCurrency),
      otherTotal: sumOther(activeRowsForCurrency),
      otherTotalLabel: formatMoney(sumOther(activeRowsForCurrency), valuationCurrency),
      volatileRatio: assetBase > 0 ? round((volatileTotal / assetBase) * 100) : 0,
      cashRatio: assetBase > 0 ? round((cashTotal / assetBase) * 100) : 0
    },
    assetTypeDistribution,
    currencyDistribution,
    ratioDistribution: [
      { label: "Riskli/volatil", value: round(volatileTotal) },
      { label: "Daha stabil", value: round(Math.max(assetBase - volatileTotal, 0)) }
    ].filter((item) => item.value > 0),
    cashRatioDistribution: [
      { label: "Nakit/Banka", value: round(cashTotal) },
      { label: "Diğer", value: round(Math.max(assetBase - cashTotal, 0)) }
    ].filter((item) => item.value > 0),
    assets: pagedRows,
    assetPagination: {
      page: assetPage,
      pageSize: assetPageSize,
      totalItems: filteredRows.length,
      totalPages: Math.max(1, Math.ceil(filteredRows.length / Math.max(assetPageSize, 1)))
    },
    cashAccountOptions: cashAccounts.map((account) => ({
      id: account.id,
      label: `${account.name} · ${account.currency}${account.isDefault ? " · Varsayılan" : ""}${account.isActive ? "" : " · Pasif"}`,
      value: account.id
    })),
    cashAccountSuggestions: cashAccounts
      .filter((account) => account.isActive && !linkedCashAccountIds.has(account.id))
      .map((account) => {
        const balance = cashBalanceMap.get(account.id);
        const value = balance?.balance ?? 0;
        return {
          cashAccountId: account.id,
          name: account.name,
          currency: account.currency,
          balance: round(value),
          balanceLabel: balance?.balanceLabel ?? formatMoney(value, account.currency),
          suggestedAssetType: suggestedAssetTypeForCashAccount(account.type, value),
          suggestedAssetTypeLabel: assetTypeLabels[suggestedAssetTypeForCashAccount(account.type, value)]
        };
      }),
    latestValuations: valuationHistory
      .filter((row) => row.assetAccount.deletedAt === null)
      .map((row) => ({
        id: row.id,
        assetAccountId: row.assetAccountId,
        assetName: row.assetAccount.name,
        assetType: row.assetAccount.assetType,
        assetTypeLabel: assetTypeLabels[row.assetAccount.assetType],
        valuationDate: dateInputValue(row.valuationDate),
        valuationDateLabel: formatDate(row.valuationDate),
        quantity: row.quantity ? toNumber(row.quantity) : null,
        unitPrice: row.unitPrice ? toNumber(row.unitPrice) : null,
        totalValue: toNumber(row.totalValue),
        totalValueLabel: formatMoney(row.totalValue, row.valuationCurrency),
        valuationCurrency: row.valuationCurrency,
        source: row.source,
        note: row.note ?? ""
      })),
    netWorthTrend: snapshots.map((row) => ({
      label: formatDate(row.snapshotDate),
      value: toNumber(row.netWorth)
    })),
    monthlyChange: monthlySnapshotChange(snapshots)
  };
}

function serializeAsset(
  asset: Prisma.AssetAccountGetPayload<{
    include: {
      linkedCashAccount: { select: { name: true; currency: true } };
      valuations: true;
    };
  }>,
  cashBalance?: { balance: number; balanceLabel: string }
) {
  const latestValuation = asset.valuations[0] ?? null;
  const rawValue = currentAssetValue(asset, latestValuation, cashBalance);
  const currentValue = asset.assetType === "DEBT" ? -Math.abs(rawValue) : rawValue;
  const absoluteValue = Math.abs(currentValue);

  return {
    id: asset.id,
    name: asset.name,
    assetType: asset.assetType,
    assetTypeLabel: assetTypeLabels[asset.assetType],
    currency: asset.currency ?? "",
    symbol: asset.symbol ?? "",
    quantity: asset.quantity ? toNumber(asset.quantity) : null,
    unitPrice: asset.unitPrice ? toNumber(asset.unitPrice) : null,
    manualTotalValue: asset.manualTotalValue ? toNumber(asset.manualTotalValue) : null,
    currentValue: round(currentValue),
    absoluteValue: round(absoluteValue),
    currentValueLabel: formatMoney(currentValue, asset.valuationCurrency),
    absoluteValueLabel: formatMoney(absoluteValue, asset.valuationCurrency),
    valuationCurrency: asset.valuationCurrency,
    linkedCashAccountId: asset.linkedCashAccountId,
    linkedCashAccountName: asset.linkedCashAccount?.name ?? "",
    description: asset.description ?? "",
    isActive: asset.isActive,
    lastUpdateDate: latestValuation ? dateInputValue(latestValuation.valuationDate) : dateInputValue(asset.updatedAt),
    lastUpdateLabel: latestValuation ? formatDate(latestValuation.valuationDate) : formatDate(asset.updatedAt),
    tone: currentValue > 0 ? "green" : currentValue < 0 ? "rose" : "neutral"
  };
}

function currentAssetValue(
  asset: { quantity: Prisma.Decimal | null; unitPrice: Prisma.Decimal | null; manualTotalValue: Prisma.Decimal | null; linkedCashAccountId: string | null },
  latestValuation: { totalValue: Prisma.Decimal } | null,
  cashBalance?: { balance: number }
) {
  if (cashBalance && asset.linkedCashAccountId) return cashBalance.balance;
  if (asset.manualTotalValue) return toNumber(asset.manualTotalValue);
  if (latestValuation) return toNumber(latestValuation.totalValue);
  if (asset.quantity && asset.unitPrice) return toNumber(asset.quantity.mul(asset.unitPrice));
  return 0;
}

function calculateTotals(rows: Array<{ assetType: AssetType; currentValue: number }>) {
  const totalAssets = round(rows.filter((row) => row.assetType !== "DEBT").reduce((total, row) => total + Math.max(row.currentValue, 0), 0));
  const totalDebts = round(rows.filter((row) => row.assetType === "DEBT").reduce((total, row) => total + Math.abs(row.currentValue), 0));
  return {
    totalAssets,
    totalDebts,
    netWorth: round(totalAssets - totalDebts)
  };
}

function distributionByAssetType(rows: Array<{ assetType: AssetType; currentValue: number }>) {
  const map = new Map<AssetType, number>();
  for (const row of rows) {
    const value = Math.abs(row.currentValue);
    if (value === 0) continue;
    map.set(row.assetType, round((map.get(row.assetType) ?? 0) + value));
  }
  return [...map.entries()].map(([assetType, value]) => ({ label: assetTypeLabels[assetType], value }));
}

function distributionByCurrency(rows: Array<{ valuationCurrency: string; currentValue: number }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = Math.abs(row.currentValue);
    if (value === 0) continue;
    map.set(row.valuationCurrency, round((map.get(row.valuationCurrency) ?? 0) + value));
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function sumByTypes(rows: Array<{ assetType: AssetType; currentValue: number }>, assetTypes: AssetType[]) {
  const selectedTypes = new Set(assetTypes);
  return round(rows.filter((row) => selectedTypes.has(row.assetType)).reduce((total, row) => total + Math.max(row.currentValue, 0), 0));
}

function sumOther(rows: Array<{ assetType: AssetType; currentValue: number }>) {
  const known = new Set<AssetType>(["CASH", "BANK", "FX", "GOLD", "STOCK", "FUND", "CRYPTO", "DEBT"]);
  return round(rows.filter((row) => !known.has(row.assetType)).reduce((total, row) => total + Math.max(row.currentValue, 0), 0));
}

function suggestedAssetTypeForCashAccount(type: "CASH" | "BANK" | "CREDIT_CARD" | "VIRTUAL" | "OTHER", balance: number): AssetType {
  if (balance < 0 || type === "CREDIT_CARD") return "DEBT";
  if (type === "CASH") return "CASH";
  if (type === "BANK") return "BANK";
  return "OTHER";
}

function monthlySnapshotChange(snapshots: Array<{ snapshotDate: Date; netWorth: Prisma.Decimal }>) {
  return snapshots.map((row, index) => {
    const value = toNumber(row.netWorth);
    const previous = index > 0 ? toNumber(snapshots[index - 1].netWorth) : value;
    return {
      label: formatDate(row.snapshotDate),
      value: round(value - previous)
    };
  });
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
