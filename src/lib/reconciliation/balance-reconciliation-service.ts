import { Prisma, type BankStatementDirection, type CashLedgerDirection, type CashLedgerEntryType } from "@prisma/client";

import { getAllCashAccountBalances, getCashAccountBalance } from "@/lib/cash/cash-account-service";
import { prisma } from "@/lib/prisma";
import { isApprovedBankMatch } from "@/lib/reconciliation/match-status";
import { dateInputValue, formatDate, formatMoney, toNumber } from "@/lib/utils";

export type BalanceReconciliationScope = {
  userId: string;
  cashAccountId?: string | null;
  importId?: string | null;
};

type BankImportRow = Prisma.BankStatementImportGetPayload<{
  select: typeof importSelect;
}>;

type BankRow = Prisma.BankStatementRowGetPayload<{
  include: {
    clientSuggestion: { select: { name: true } };
    caseFileSuggestion: { select: { title: true; fileNumber: true } };
    import: { select: { bankName: true; cashAccountId: true } };
  };
}>;

type LedgerEntry = Prisma.CashLedgerEntryGetPayload<{
  include: {
    client: { select: { name: true } };
    caseFile: { select: { title: true; fileNumber: true } };
    cashAccount: { select: { name: true; currency: true } };
  };
}>;

const importSelect = {
  id: true,
  bankName: true,
  originalFileName: true,
  periodStart: true,
  periodEnd: true,
  cashAccountId: true,
  currency: true,
  openingBalance: true,
  closingBalance: true,
  duplicateRows: true,
  totalRows: true,
  successfulRows: true,
  cashAccount: { select: { name: true, currency: true } }
} satisfies Prisma.BankStatementImportSelect;

export async function getBalanceReconciliationData(scope: BalanceReconciliationScope) {
  const [accounts, imports, balances] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { userId: scope.userId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, currency: true, isDefault: true, isActive: true }
    }),
    prisma.bankStatementImport.findMany({
      where: { userId: scope.userId, deletedAt: null },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: importSelect,
      take: 200
    }),
    getAllCashAccountBalances(scope.userId)
  ]);

  const selectedImport = scope.importId ? imports.find((item) => item.id === scope.importId) ?? null : null;
  const selectedAccountId = scope.cashAccountId || selectedImport?.cashAccountId || null;
  const selectedAccount = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) ?? null : null;
  const relevantImports = imports.filter((item) => {
    if (selectedImport) return item.id === selectedImport.id;
    if (selectedAccount) return item.cashAccountId === selectedAccount.id;
    return true;
  });
  const balanceImport = selectedImport ?? latestImportForAccount(relevantImports, selectedAccount?.id ?? null);
  const displayCurrency = selectedImport?.currency ?? selectedAccount?.currency ?? balances[0]?.currency ?? imports[0]?.currency ?? "TRY";
  const accountCurrencies = new Set(accounts.map((account) => account.currency));
  const importCurrencies = new Set(relevantImports.map((item) => item.currency));
  const hasCurrencyMismatch = Boolean(
    selectedAccount &&
      balanceImport &&
      selectedAccount.currency.toUpperCase() !== balanceImport.currency.toUpperCase()
  );
  const hasMultipleCurrencies = accountCurrencies.size > 1 || importCurrencies.size > 1;
  const bankBalance = selectedImport
    ? toNumber(selectedImport.closingBalance)
    : selectedAccount
      ? toNumber(balanceImport?.closingBalance)
      : sumLatestImportBalances(relevantImports, displayCurrency);
  const systemBalance = selectedAccount
    ? (await getCashAccountBalance(scope.userId, selectedAccount.id)).balance
    : round(balances.filter((balance) => balance.currency === displayCurrency).reduce((total, balance) => total + balance.balance, 0));
  const difference = round(bankBalance - systemBalance);
  const differencePercent = percentDifference(difference, systemBalance, bankBalance);
  const status = balanceStatus(difference, differencePercent);
  const bankRows = await getBalanceBankRows(scope.userId, selectedAccount?.id ?? null, selectedImport?.id ?? null);
  const systemEntries = await getBalanceSystemEntries(scope.userId, bankRows, selectedAccount?.id ?? null, Boolean(selectedAccount));
  const matchedLedgerIds = new Set(bankRows.map((row) => row.matchedCashLedgerEntryId).filter((id): id is string => Boolean(id)));
  const unmatchedBankRows = bankRows.filter((row) => !isMatchedBankRow(row) && row.matchType !== "IGNORED");
  const unmatchedSystemMovements = systemEntries.filter((entry) => !matchedLedgerIds.has(entry.id));
  const duplicateRows = relevantImports.reduce((total, item) => total + item.duplicateRows, 0);
  const possibleReasons = buildPossibleReasons({
    unmatchedBankRows,
    unmatchedSystemMovements,
    duplicateRows,
    hasCurrencyMismatch,
    hasMultipleCurrencies,
    dateDifferenceCount: countDateDifferenceCandidates(unmatchedBankRows, unmatchedSystemMovements),
    transferCount: countTransferCandidates(unmatchedBankRows, unmatchedSystemMovements),
    selectedAccountName: selectedAccount?.name ?? null
  });

  return {
    accounts: accounts.map((account) => {
      const balance = balances.find((item) => item.accountId === account.id);
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        isDefault: account.isDefault,
        isActive: account.isActive,
        currentBalance: balance?.balance ?? 0,
        currentBalanceLabel: balance?.balanceLabel ?? formatMoney(0, account.currency)
      };
    }),
    imports: imports.map(serializeImport),
    selectedAccount: selectedAccount
      ? {
          id: selectedAccount.id,
          name: selectedAccount.name,
          currency: selectedAccount.currency,
          isDefault: selectedAccount.isDefault
        }
      : null,
    selectedImport: selectedImport ? serializeImport(selectedImport) : null,
    balanceImport: balanceImport ? serializeImport(balanceImport) : null,
    summary: {
      bankBalance,
      bankBalanceLabel: formatMoney(bankBalance, displayCurrency),
      systemBalance,
      systemBalanceLabel: formatMoney(systemBalance, displayCurrency),
      difference,
      differenceLabel: formatMoney(difference, displayCurrency),
      differencePercent,
      differencePercentLabel: `${differencePercent > 0 ? "+" : ""}${differencePercent.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`,
      currency: displayCurrency,
      status,
      canCreateAdjustment: Boolean(selectedAccount && Math.abs(difference) >= 0.01)
    },
    counts: {
      unmatchedBank: unmatchedBankRows.length,
      unmatchedBankIn: unmatchedBankRows.filter((row) => row.direction === "IN").length,
      unmatchedBankOut: unmatchedBankRows.filter((row) => row.direction === "OUT").length,
      unmatchedSystem: unmatchedSystemMovements.length,
      duplicateRows
    },
    possibleReasons,
    unmatchedBankRows: unmatchedBankRows.slice(0, 50).map(serializeBankRow),
    unmatchedSystemMovements: unmatchedSystemMovements.slice(0, 50).map(serializeLedgerEntry),
    compareScopeLabel: selectedImport
      ? `${selectedImport.bankName} · ${selectedImport.originalFileName}`
      : selectedAccount
        ? `${selectedAccount.name} için son ekstre`
        : "Hesapların son ekstreleri"
  };
}

async function getBalanceBankRows(userId: string, cashAccountId: string | null, importId: string | null): Promise<BankRow[]> {
  return prisma.bankStatementRow.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ["SUCCESS", "DUPLICATE"] },
      transactionDate: { not: null },
      import: {
        deletedAt: null,
        ...(importId ? { id: importId } : {}),
        ...(cashAccountId && !importId ? { cashAccountId } : {})
      }
    },
    orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
    include: {
      clientSuggestion: { select: { name: true } },
      caseFileSuggestion: { select: { title: true, fileNumber: true } },
      import: { select: { bankName: true, cashAccountId: true } }
    },
    take: 10000
  });
}

async function getBalanceSystemEntries(userId: string, bankRows: BankRow[], cashAccountId: string | null, isAccountScoped: boolean): Promise<LedgerEntry[]> {
  const sortedDates = bankRows
    .map((row) => row.transactionDate)
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const startDate = sortedDates[0] ? new Date(sortedDates[0].getTime() - 3 * 86400000) : undefined;
  const endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1].getTime() + 3 * 86400000) : undefined;

  return prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(!isAccountScoped ? { entryType: { not: "TRANSFER" as CashLedgerEntryType } } : {}),
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {})
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      client: { select: { name: true } },
      caseFile: { select: { title: true, fileNumber: true } },
      cashAccount: { select: { name: true, currency: true } }
    },
    take: 3000
  });
}

function buildPossibleReasons({
  unmatchedBankRows,
  unmatchedSystemMovements,
  duplicateRows,
  hasCurrencyMismatch,
  hasMultipleCurrencies,
  dateDifferenceCount,
  transferCount,
  selectedAccountName
}: {
  unmatchedBankRows: BankRow[];
  unmatchedSystemMovements: LedgerEntry[];
  duplicateRows: number;
  hasCurrencyMismatch: boolean;
  hasMultipleCurrencies: boolean;
  dateDifferenceCount: number;
  transferCount: number;
  selectedAccountName: string | null;
}) {
  const bankIn = unmatchedBankRows.filter((row) => row.direction === "IN").length;
  const bankOut = unmatchedBankRows.filter((row) => row.direction === "OUT").length;
  const reasons = [
    {
      title: "Sisteme girilmemiş banka hareketleri",
      value: `${unmatchedBankRows.length} hareket`,
      description: "Ekstrede görünen ama henüz tahsilat, gider veya kasa hareketiyle eşleşmeyen kayıtlar.",
      tone: unmatchedBankRows.length > 0 ? "amber" : "green"
    },
    {
      title: "Bankada olup sistemde olmayan gelirler",
      value: `${bankIn} giriş`,
      description: "Banka girişlerinden tahsilat oluşturulması veya mevcut kayıtla eşleştirilmesi gerekebilir.",
      tone: bankIn > 0 ? "green" : "neutral"
    },
    {
      title: "Bankada olup sistemde olmayan giderler",
      value: `${bankOut} çıkış`,
      description: "Banka çıkışlarından gider oluşturulması veya mevcut kayıtla eşleştirilmesi gerekebilir.",
      tone: bankOut > 0 ? "rose" : "neutral"
    },
    {
      title: "Sistemde olup bankada görünmeyen kayıtlar",
      value: `${unmatchedSystemMovements.length} hareket`,
      description: selectedAccountName
        ? `${selectedAccountName} kasasındaki hareketler içinde ekstreyle eşleşmeyen kayıtlar.`
        : "Tüm kasa hareketleri içinde bankada karşılığı görünmeyen kayıtlar.",
      tone: unmatchedSystemMovements.length > 0 ? "amber" : "green"
    },
    {
      title: "Tarih farkı",
      value: `${dateDifferenceCount} olası kayıt`,
      description: "Aynı tutar ve yön var, ancak banka valörü ile sistem kayıt tarihi farklı olabilir.",
      tone: dateDifferenceCount > 0 ? "amber" : "neutral"
    },
    {
      title: "Transferler",
      value: `${transferCount} olası transfer`,
      description: "Kendi hesaplarınız arasındaki virman/transfer hareketleri gelir-gider toplamını şişirmeden ayrıca kontrol edilmelidir.",
      tone: transferCount > 0 ? "amber" : "neutral"
    },
    {
      title: "Duplicate kayıtlar",
      value: `${duplicateRows} satır`,
      description: "Ekstre import sırasında duplicate olarak işaretlenen satırlar fark yaratmaması için ayrıca incelenebilir.",
      tone: duplicateRows > 0 ? "amber" : "green"
    }
  ] satisfies Array<{ title: string; value: string; description: string; tone: "green" | "rose" | "amber" | "neutral" }>;

  if (hasCurrencyMismatch || hasMultipleCurrencies) {
    reasons.unshift({
      title: "Para birimi kontrolü",
      value: hasCurrencyMismatch ? "Uyumsuz" : "Çoklu para birimi",
      description: hasCurrencyMismatch
        ? "Seçili ekstre para birimi ile kasa hesabı para birimi aynı değil."
        : "Birden fazla para birimi olduğu için karşılaştırma seçili para birimi üzerinden yapılır.",
      tone: "amber"
    });
  }

  return reasons;
}

function countDateDifferenceCandidates(bankRows: BankRow[], systemEntries: LedgerEntry[]) {
  let count = 0;
  for (const row of bankRows) {
    if (!row.transactionDate || !row.amount || row.direction === "NEUTRAL") continue;
    const rowAmount = Math.abs(toNumber(row.amount));
    const match = systemEntries.find((entry) => {
      const dateDiff = Math.round(Math.abs(row.transactionDate!.getTime() - entry.date.getTime()) / 86400000);
      return directionMatches(row.direction, entry.direction) && Math.abs(Math.abs(toNumber(entry.amount)) - rowAmount) < 0.01 && dateDiff > 0 && dateDiff <= 3;
    });
    if (match) count += 1;
  }
  return count;
}

function countTransferCandidates(bankRows: BankRow[], systemEntries: LedgerEntry[]) {
  const transferText = /transfer|virman|kredi kart|nakit çek|nakit yat|hesaplar arası|eft/i;
  const bankTransferCount = bankRows.filter((row) => transferText.test(row.description)).length;
  const systemTransferCount = systemEntries.filter((entry) => entry.entryType === "TRANSFER" || transferText.test(entry.description ?? "")).length;
  return bankTransferCount + systemTransferCount;
}

function latestImportForAccount(imports: BankImportRow[], accountId: string | null) {
  const pool = accountId ? imports.filter((item) => item.cashAccountId === accountId) : imports;
  return pool[0] ?? null;
}

function sumLatestImportBalances(imports: BankImportRow[], currency: string) {
  const byAccount = new Map<string, BankImportRow>();
  for (const item of imports.filter((row) => row.currency === currency)) {
    const key = item.cashAccountId ?? item.id;
    const current = byAccount.get(key);
    if (!current || Number(item.periodEnd ?? item.id) > Number(current.periodEnd ?? current.id)) {
      byAccount.set(key, item);
    }
  }
  return round([...byAccount.values()].reduce((total, item) => total + toNumber(item.closingBalance), 0));
}

function serializeImport(item: BankImportRow) {
  return {
    id: item.id,
    bankName: item.bankName,
    originalFileName: item.originalFileName,
    cashAccountId: item.cashAccountId,
    cashAccountName: item.cashAccount?.name ?? "Kasa seçilmedi",
    currency: item.currency,
    openingBalance: toNumber(item.openingBalance),
    closingBalance: toNumber(item.closingBalance),
    closingBalanceLabel: formatMoney(item.closingBalance, item.currency),
    periodStart: item.periodStart ? dateInputValue(item.periodStart) : "",
    periodEnd: item.periodEnd ? dateInputValue(item.periodEnd) : "",
    periodLabel: item.periodStart || item.periodEnd ? `${formatDate(item.periodStart)} - ${formatDate(item.periodEnd)}` : "Dönem yok",
    duplicateRows: item.duplicateRows,
    totalRows: item.totalRows,
    successfulRows: item.successfulRows
  };
}

function serializeBankRow(row: BankRow) {
  const amount = Math.abs(toNumber(row.amount));
  return {
    id: row.id,
    date: row.transactionDate ? dateInputValue(row.transactionDate) : "",
    description: row.description,
    direction: row.direction,
    amount,
    signedAmount: row.direction === "OUT" ? -amount : amount,
    currency: row.currency,
    amountLabel: formatMoney(amount, row.currency),
    bankName: row.import.bankName,
    category: row.categorySuggestion ?? "-",
    clientSuggestion: row.clientSuggestion?.name ?? "-",
    caseFileSuggestion: row.caseFileSuggestion?.title ?? "-"
  };
}

function serializeLedgerEntry(entry: LedgerEntry) {
  const amount = Math.abs(toNumber(entry.amount));
  return {
    id: entry.id,
    date: dateInputValue(entry.date),
    description: entry.description ?? "-",
    direction: entry.direction,
    entryType: entry.entryType,
    amount,
    signedAmount: entry.direction === "OUT" ? -amount : amount,
    currency: entry.currency,
    amountLabel: formatMoney(amount, entry.currency),
    clientName: entry.client?.name ?? "-",
    caseFileTitle: entry.caseFile?.title ?? "-",
    cashAccountName: entry.cashAccount.name
  };
}

function isMatchedBankRow(row: {
  matchType: string;
  matchedCashLedgerEntryId?: string | null;
  matchedIncomeId?: string | null;
  matchedExpenseId?: string | null;
}) {
  return isApprovedBankMatch(row);
}

function directionMatches(bankDirection: BankStatementDirection, systemDirection: CashLedgerDirection) {
  return bankDirection !== "NEUTRAL" && bankDirection === systemDirection;
}

function percentDifference(difference: number, systemBalance: number, bankBalance: number) {
  const denominator = Math.abs(systemBalance) > 0 ? Math.abs(systemBalance) : Math.abs(bankBalance);
  if (denominator === 0) return 0;
  return round((difference / denominator) * 100);
}

function balanceStatus(difference: number, differencePercent: number) {
  const absoluteDifference = Math.abs(difference);
  const absolutePercent = Math.abs(differencePercent);
  if (absoluteDifference < 0.01) {
    return {
      label: "Tam Uyum",
      tone: "green" as const,
      description: "Bankadaki kapanış bakiyesi ile sistemdeki kasa bakiyesi uyumlu."
    };
  }
  if (absoluteDifference <= 100 || absolutePercent <= 1) {
    return {
      label: "Kontrol Gerekli",
      tone: "amber" as const,
      description: "Küçük bir fark var. Tarih, komisyon, transfer veya eksik kayıt kontrolü önerilir."
    };
  }
  return {
    label: "Mutabakat Farkı",
    tone: "rose" as const,
    description: "Banka ve sistem bakiyesi arasında belirgin fark var. Eşleşmeyen hareketler incelenmeli."
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
