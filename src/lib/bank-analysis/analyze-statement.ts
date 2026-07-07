import type { BankStatementDirection, Prisma } from "@prisma/client";

import {
  categorizeTransaction,
  normalizeTransactionText,
  type TransactionCategoryInput,
  type TransactionCategorySuggestion,
  type TransactionDirection,
  type TransactionRuleInput
} from "@/lib/bank-analysis/categorize-transaction";
import {
  findUnmatchedSystemMovements,
  suggestLedgerMatch,
  type LedgerMovementForMatch
} from "@/lib/bank-analysis/reconciliation";
import {
  buildMonthlyCashFlow,
  inferAnchorDate,
  summarizeStatementRows,
  type MonthlyCashFlowPoint
} from "@/lib/bank-analysis/statement-summary";
import { getBankRowActionOptions, getBankRowSystemMovements, inferBankRowsDateRange } from "@/lib/bank/actions/bank-row-actions-data";
import { prisma } from "@/lib/prisma";
import { isApprovedBankMatch, isIgnoredBankMatch, isSuggestedBankMatch } from "@/lib/reconciliation/match-status";
import { addMonths, dateInputValue, toNumber } from "@/lib/utils";

const rowInclude = {
  clientSuggestion: { select: { id: true, name: true } },
  caseFileSuggestion: { select: { id: true, title: true, fileNumber: true } },
  matchedIncome: { select: { id: true, description: true } },
  matchedExpense: { select: { id: true, description: true } },
  matchedCashLedgerEntry: { select: { id: true, description: true } }
} satisfies Prisma.BankStatementRowInclude;

type AnalysisRow = Prisma.BankStatementRowGetPayload<{ include: typeof rowInclude }>;

export type BankStatementAnalysisFilters = {
  userId?: string;
  cashAccountId?: string | null;
  importId?: string | null;
};

export type CategorizedStatementRow = {
  rowId: string;
  rowNumber: number;
  date: string | null;
  description: string;
  direction: TransactionDirection;
  amount: number;
  currency: string;
  category: string;
  group: string;
  cashAccountId: string | null;
  confidence: number;
  reason: string;
  isHighConfidence: boolean;
  iban: string | null;
  counterparty: string | null;
  clientSuggestionId: string | null;
  clientSuggestionName: string | null;
  caseFileSuggestionId: string | null;
  caseFileSuggestionTitle: string | null;
  matchType: string;
  matchedSignals: string[];
  candidateCount: number;
};

export type CategoryDistributionItem = {
  category: string;
  group: string;
  count: number;
  total: number;
  averageConfidence: number;
};

export type LargeTransactionItem = {
  rowId: string;
  rowNumber: number;
  date: string | null;
  description: string;
  amount: number;
  currency: string;
  category: string;
  confidence: number;
};

export type RecurringTransactionItem = {
  key: string;
  label: string;
  direction: TransactionDirection;
  category: string;
  count: number;
  distinctMonths: number;
  averageAmount: number;
  totalAmount: number;
  averageIntervalDays: number | null;
  firstDate: string | null;
  lastDate: string | null;
  nextExpectedDate: string | null;
};

export async function getStatementSummary(importId: string, userId?: string) {
  const bankImport = await getImportWithRows(importId, userId);
  return summarizeStatementRows(bankImport.rows, bankImport.currency);
}

export async function getLast12MonthsAnalysis(filters: BankStatementAnalysisFilters | string) {
  const normalizedFilters: BankStatementAnalysisFilters = typeof filters === "string" ? { importId: filters } : filters;
  const rows = await getRowsForLast12Months(normalizedFilters);
  const anchorDate = inferAnchorDate(rows);
  const startDate = addMonths(new Date(`${dateInputValue(anchorDate).slice(0, 7)}-01T00:00:00+03:00`), -11);
  const scopedRows = rows.filter((row) => row.transactionDate && row.transactionDate >= startDate);
  const monthly = buildMonthlyCashFlow(scopedRows, anchorDate, 12);

  return {
    startDate: dateInputValue(startDate),
    endDate: dateInputValue(anchorDate),
    monthly,
    totals: {
      income: roundMoney(monthly.reduce((total, point) => total + point.income, 0)),
      expense: roundMoney(monthly.reduce((total, point) => total + point.expense, 0)),
      net: roundMoney(monthly.reduce((total, point) => total + point.net, 0))
    }
  };
}

export async function categorizeStatementRows(importId: string, userId?: string): Promise<CategorizedStatementRow[]> {
  const bankImport = await getImportWithRows(importId, userId);
  const [rules, categories] = await Promise.all([getRules(bankImport.userId), getCategories(bankImport.userId)]);

  return categorizeRows(bankImport.rows, rules, categories);
}

export async function detectRecurringTransactions(importId: string, userId?: string) {
  const rows = await categorizeStatementRows(importId, userId);
  const successfulRows = rows.filter((row) => row.date && row.direction !== "NEUTRAL" && row.group !== "TRANSFER");
  const grouped = new Map<string, CategorizedStatementRow[]>();

  for (const row of successfulRows) {
    const key = recurringKey(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const recurring = [...grouped.entries()]
    .map(([key, groupRows]) => buildRecurringItem(key, groupRows))
    .filter((item): item is RecurringTransactionItem => item != null)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    income: recurring.filter((item) => item.direction === "IN").slice(0, 20),
    expense: recurring.filter((item) => item.direction === "OUT").slice(0, 20)
  };
}

export async function detectLargeTransactions(importId: string, userId?: string) {
  const rows = await categorizeStatementRows(importId, userId);
  const sorted = rows
    .filter((row) => row.amount > 0 && row.direction !== "NEUTRAL")
    .sort((a, b) => b.amount - a.amount);

  return {
    income: sorted.filter((row) => row.direction === "IN").slice(0, 20).map(toLargeTransactionItem),
    expense: sorted.filter((row) => row.direction === "OUT").slice(0, 20).map(toLargeTransactionItem)
  };
}

export async function detectIncomeSources(importId: string, userId?: string) {
  const rows = await categorizeStatementRows(importId, userId);
  return distribution(rows.filter((row) => row.group === "INCOME"));
}

export async function detectExpenseCategories(importId: string, userId?: string) {
  const rows = await categorizeStatementRows(importId, userId);
  return distribution(rows.filter((row) => row.group === "EXPENSE"));
}

export async function suggestClientMatches(importId: string, userId?: string) {
  const bankImport = await getImportWithRows(importId, userId);
  const [rules, categories] = await Promise.all([getRules(bankImport.userId), getCategories(bankImport.userId)]);
  const clients = await prisma.client.findMany({
    where: { userId: bankImport.userId, deletedAt: null, archivedAt: null },
    select: { id: true, name: true }
  });

  return bankImport.rows
    .filter((row) => row.status === "SUCCESS")
    .map((row) => {
      const category = categorizeTransaction(toCategorizeInput(row), rules, categories);
      const fromRule = category.clientId ? clients.find((client) => client.id === category.clientId) : null;
      const fromExisting = row.clientSuggestion;
      const fromText = fromRule ?? fromExisting ?? matchNamedEntity(row.description, clients);
      if (!fromText) return null;
      return {
        rowId: row.id,
        rowNumber: row.rowNumber,
        date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
        description: row.description,
        clientId: fromText.id,
        clientName: fromText.name,
        confidence: fromRule ? 0.92 : fromExisting ? 0.82 : 0.68,
        reason: fromRule ? "Kullanıcı kuralı" : fromExisting ? "İçe aktarma önerisi" : "Açıklama adıyla benzerlik"
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .slice(0, 50);
}

export async function suggestCaseFileMatches(importId: string, userId?: string) {
  const bankImport = await getImportWithRows(importId, userId);
  const [rules, categories] = await Promise.all([getRules(bankImport.userId), getCategories(bankImport.userId)]);
  const caseFiles = await prisma.caseFile.findMany({
    where: {
      userId: bankImport.userId,
      deletedAt: null,
      archivedAt: null,
      client: { deletedAt: null, archivedAt: null }
    },
    select: { id: true, title: true, fileNumber: true }
  });

  return bankImport.rows
    .filter((row) => row.status === "SUCCESS")
    .map((row) => {
      const category = categorizeTransaction(toCategorizeInput(row), rules, categories);
      const fromRule = category.caseFileId ? caseFiles.find((caseFile) => caseFile.id === category.caseFileId) : null;
      const fromExisting = row.caseFileSuggestion;
      const fromText = fromRule ?? fromExisting ?? matchCaseFile(row.description, caseFiles);
      if (!fromText) return null;
      return {
        rowId: row.id,
        rowNumber: row.rowNumber,
        date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
        description: row.description,
        caseFileId: fromText.id,
        caseFileTitle: fromText.title,
        fileNumber: "fileNumber" in fromText ? fromText.fileNumber : null,
        confidence: fromRule ? 0.92 : fromExisting ? 0.82 : 0.68,
        reason: fromRule ? "Kullanıcı kuralı" : fromExisting ? "İçe aktarma önerisi" : "Dosya adı/numarası benzerliği"
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .slice(0, 50);
}

export async function suggestLedgerMatches(importId: string, userId?: string) {
  const bankImport = await getImportWithRows(importId, userId);
  const ledgerEntries = await getLedgerCandidates(bankImport);
  const bankRows = bankImport.rows
    .filter((row) => row.status === "SUCCESS" && row.direction !== "NEUTRAL")
    .map(toBankMovementForMatch);

  const suggestedMatches = bankRows
    .filter((row) => !isApprovedBankMatch(row) && !isIgnoredBankMatch(row))
    .map((row) => suggestLedgerMatch(row, ledgerEntries))
    .filter((match): match is NonNullable<typeof match> => match != null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 50);

  const unmatchedBankRows = bankRows
    .filter((row) => !isApprovedBankMatch(row) && !isIgnoredBankMatch(row))
    .filter((row) => !suggestedMatches.some((match) => match.rowId === row.id))
    .slice(0, 50)
    .map((row) => ({
      rowId: row.id,
      rowNumber: row.rowNumber,
      date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
      description: row.description,
      direction: row.direction,
      amount: Math.abs(toNumber(row.amount))
    }));

  return {
    matchedRows: bankRows.filter(isApprovedBankMatch).length,
    suggestedMatches,
    unmatchedBankRows,
    unmatchedSystemMovements: findUnmatchedSystemMovements(bankRows, ledgerEntries)
  };
}

export async function getStatementAnalysis(importId: string, userId?: string) {
  const [
    summary,
    last12Months,
    categories,
    recurring,
    largeTransactions,
    incomeSources,
    expenseCategories,
    clientMatches,
    caseFileMatches,
    ledgerMatches
  ] = await Promise.all([
    getStatementSummary(importId, userId),
    getLast12MonthsAnalysis({ importId, userId }),
    categorizeStatementRows(importId, userId),
    detectRecurringTransactions(importId, userId),
    detectLargeTransactions(importId, userId),
    detectIncomeSources(importId, userId),
    detectExpenseCategories(importId, userId),
    suggestClientMatches(importId, userId),
    suggestCaseFileMatches(importId, userId),
    suggestLedgerMatches(importId, userId)
  ]);

  return {
    summary,
    last12Months,
    categoryDistribution: distribution(categories.filter((row) => row.group !== "NEUTRAL")),
    recurring,
    largeTransactions,
    incomeSources,
    expenseCategories,
    clientMatches,
    caseFileMatches,
    ledgerMatches,
    unmatchedBankRows: ledgerMatches.unmatchedBankRows,
    unmatchedSystemMovements: ledgerMatches.unmatchedSystemMovements
  };
}

export type BankAnalysisScreenFilters = {
  userId: string;
  importId?: string | null;
  page?: number;
  pageSize?: number;
  direction?: "ALL" | TransactionDirection;
  category?: string | null;
  match?: "ALL" | "MATCHED" | "SUGGESTED" | "UNMATCHED";
};

export async function getBankAnalysisScreenData(filters: BankAnalysisScreenFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const imports = await prisma.bankStatementImport.findMany({
    where: { userId: filters.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      originalFileName: true,
      periodStart: true,
      periodEnd: true,
      currency: true,
      cashAccountId: true,
      cashAccount: { select: { name: true } }
    },
    take: 100
  });
  const selectedImport = filters.importId ? imports.find((item) => item.id === filters.importId) ?? null : null;
  const analysisRows = await getRowsForScreenScope(filters.userId, filters.importId);
  const anchorDate = inferAnchorDate(analysisRows);
  const startDate = addMonths(new Date(`${dateInputValue(anchorDate).slice(0, 7)}-01T00:00:00+03:00`), -11);
  const last12Rows = analysisRows.filter((row) => row.transactionDate && row.transactionDate >= startDate && row.status === "SUCCESS");
  const [rules, categories] = await Promise.all([getRules(filters.userId), getCategories(filters.userId)]);
  const categorizedRows = categorizeRows(last12Rows, rules, categories);
  const summary = summarizeStatementRows(last12Rows, selectedImport?.currency ?? imports[0]?.currency ?? "TRY");
  const monthly = buildMonthlyCashFlow(last12Rows, anchorDate, 12);
  const recurring = buildRecurringFromCategorizedRows(categorizedRows);
  const largeTransactions = buildLargeTransactionsFromCategorizedRows(categorizedRows);
  const incomeSources = distribution(categorizedRows.filter((row) => row.group === "INCOME"));
  const expenseCategories = distribution(categorizedRows.filter((row) => row.group === "EXPENSE"));
  const categoryOptions = [...new Set(categorizedRows.map((row) => row.category))].sort((a, b) => a.localeCompare(b, "tr"));
  const confidence = buildConfidenceSummary(categorizedRows);
  const ledgerEntries = await getLedgerCandidatesForRows(filters.userId, analysisRows, selectedImport?.id ? undefined : null);
  const bankRows = last12Rows.filter((row) => row.direction !== "NEUTRAL").map(toBankMovementForMatch);
  const ledgerMatches = buildLedgerMatchSummary(bankRows, ledgerEntries);
  const filteredRows = applyScreenRowFilters(categorizedRows, filters, ledgerMatches.suggestedMatches);
  const totalRows = filteredRows.length;
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const [actionOptions, systemMovements] = await Promise.all([
    getBankRowActionOptions(filters.userId),
    getBankRowSystemMovements({
      userId: filters.userId,
      dateRange: inferBankRowsDateRange(analysisRows),
      cashAccountId: selectedImport?.cashAccountId ?? null
    })
  ]);

  return {
    imports: imports.map((item) => ({
      id: item.id,
      label: `${item.bankName} - ${item.originalFileName}`,
      period: `${item.periodStart ? dateInputValue(item.periodStart) : "-"} / ${item.periodEnd ? dateInputValue(item.periodEnd) : "-"}`,
      cashAccount: item.cashAccount?.name ?? "-"
    })),
    selectedImport: selectedImport
      ? {
          id: selectedImport.id,
          bankName: selectedImport.bankName,
          originalFileName: selectedImport.originalFileName,
          periodStart: selectedImport.periodStart ? dateInputValue(selectedImport.periodStart) : null,
          periodEnd: selectedImport.periodEnd ? dateInputValue(selectedImport.periodEnd) : null
        }
      : null,
    summary: {
      ...summary,
      averageMonthlyIncome: roundMoney(summary.totalIn / 12),
      averageMonthlyExpense: roundMoney(summary.totalOut / 12),
      highestIncomeMonth: highestMonth(monthly, "income"),
      highestExpenseMonth: highestMonth(monthly, "expense"),
      highConfidenceSuggestions: confidence.high,
      mediumConfidenceSuggestions: confidence.medium,
      lowConfidenceSuggestions: confidence.low
    },
    charts: {
      monthlyTrend: monthly.map((point) => ({ label: point.label, tahsilat: point.income, gider: point.expense, net: point.net })),
      netCashFlow: monthly.map((point) => ({ label: point.label, net: point.net })),
      expenseCategories: expenseCategories.slice(0, 8).map((item) => ({ label: item.category, value: item.total })),
      incomeSources: incomeSources.slice(0, 8).map((item) => ({ label: item.category, value: item.total })),
      recurringCalendar: [...recurring.expense, ...recurring.income].slice(0, 10).map((item) => ({
        label: item.label || item.category,
        value: item.averageAmount
      })),
      largestExpenses: largeTransactions.expense.slice(0, 10).map((item) => ({ label: shortLabel(item.description), value: item.amount })),
      largestIncome: largeTransactions.income.slice(0, 10).map((item) => ({ label: shortLabel(item.description), value: item.amount }))
    },
    insights: buildInsights({
      monthly,
      recurring,
      categorizedRows,
      ledgerMatches,
      averageMonthlyExpense: summary.totalOut / 12
    }),
    distributions: {
      incomeSources,
      expenseCategories,
      categoryOptions
    },
    recurring,
    largeTransactions,
    ledgerMatches,
    actionOptions,
    systemMovements,
    rows: pagedRows.map((row) => {
      const suggestedMatch = ledgerMatches.suggestedMatches.find((match) => match.rowId === row.rowId);
      return {
        ...row,
        matchStatus: screenMatchStatus(row, Boolean(suggestedMatch)),
        matchConfidence: suggestedMatch?.confidence ?? null,
        matchReason: suggestedMatch?.reason ?? null
      };
    }),
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize))
    }
  };
}

export async function getBankAnalysisCsvRows(filters: Omit<BankAnalysisScreenFilters, "page" | "pageSize">) {
  const data = await getBankAnalysisScreenData({ ...filters, page: 1, pageSize: 100 });
  const allRows = await getRowsForScreenScope(filters.userId, filters.importId);
  const [rules, categories] = await Promise.all([getRules(filters.userId), getCategories(filters.userId)]);
  const categorizedRows = categorizeRows(allRows.filter((row) => row.status === "SUCCESS"), rules, categories);

  return {
    filename: filters.importId ? `banka-analizi-${filters.importId}.csv` : "banka-analizi-son-12-ay.csv",
    rows: applyScreenRowFilters(categorizedRows, filters, data.ledgerMatches.suggestedMatches).map((row) => ({
      Tarih: row.date ?? "",
      Açıklama: row.description,
      Yön: row.direction === "IN" ? "Giriş" : row.direction === "OUT" ? "Çıkış" : "Nötr",
      Tutar: String(row.amount),
      "Para Birimi": row.currency,
      Kategori: row.category,
      Grup: row.group,
      Güven: String(row.confidence),
      "Güven Açıklaması": row.reason,
      "Eşleşen Sinyaller": row.matchedSignals.join(", "),
      "Müvekkil Önerisi": row.clientSuggestionName ?? "",
      "Dosya Önerisi": row.caseFileSuggestionTitle ?? "",
      "Eşleşme Durumu": row.matchType
    }))
  };
}

async function getImportWithRows(importId: string, userId?: string) {
  const bankImport = await prisma.bankStatementImport.findFirst({
    where: { id: importId, ...(userId ? { userId } : {}), deletedAt: null },
    include: {
      rows: {
        where: { deletedAt: null },
        orderBy: [{ transactionDate: "asc" }, { rowNumber: "asc" }],
        include: rowInclude
      }
    }
  });

  if (!bankImport) {
    throw new Error("Banka ekstresi bulunamadı.");
  }

  return bankImport;
}

async function getRowsForLast12Months(filters: BankStatementAnalysisFilters) {
  let cashAccountId = filters.cashAccountId;
  let userId = filters.userId;
  let importId = filters.importId ?? undefined;

  if (filters.importId) {
    const bankImport = await prisma.bankStatementImport.findFirst({
      where: { id: filters.importId, ...(filters.userId ? { userId: filters.userId } : {}), deletedAt: null },
      select: { userId: true, cashAccountId: true }
    });
    if (!bankImport) return [];
    userId = bankImport.userId;
    cashAccountId = filters.cashAccountId ?? bankImport.cashAccountId;
    importId = cashAccountId ? undefined : filters.importId;
  }

  return prisma.bankStatementRow.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(importId ? { importId } : {}),
      deletedAt: null,
      status: "SUCCESS",
      transactionDate: { not: null }
    },
    orderBy: { transactionDate: "asc" },
    take: 10000
  });
}

async function getRules(userId: string): Promise<TransactionRuleInput[]> {
  const rules = await prisma.transactionRule.findMany({
    where: { userId, isActive: true, deletedAt: null },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      keyword: true,
      matchType: true,
      direction: true,
      category: true,
      targetGroup: true,
      amountMin: true,
      amountMax: true,
      confidence: true,
      clientId: true,
      caseFileId: true,
      cashAccountId: true
    }
  });

  return rules;
}

async function getCategories(userId: string): Promise<TransactionCategoryInput[]> {
  return prisma.transactionCategory.findMany({
    where: { userId, isActive: true, deletedAt: null },
    orderBy: [{ group: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      group: true,
      direction: true,
      isActive: true
    }
  });
}

function categorizeRows(rows: AnalysisRow[], rules: TransactionRuleInput[], categories: TransactionCategoryInput[]): CategorizedStatementRow[] {
  return rows
    .filter((row) => row.status === "SUCCESS")
    .map((row) => {
      const category = categorizeTransaction(toCategorizeInput(row), rules, categories);
      return toCategorizedRow(row, category);
    });
}

function toCategorizeInput(row: AnalysisRow) {
  return {
    description: row.description,
    direction: row.direction as TransactionDirection,
    amount: row.amount
  };
}

function toCategorizedRow(row: AnalysisRow, category: TransactionCategorySuggestion): CategorizedStatementRow {
  return {
    rowId: row.id,
    rowNumber: row.rowNumber,
    date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
    description: row.description,
    direction: row.direction as TransactionDirection,
    amount: Math.abs(toNumber(row.amount)),
    currency: row.currency,
    category: category.category,
    group: category.group,
    cashAccountId: row.cashAccountId,
    confidence: category.confidence,
    reason: category.reason,
    isHighConfidence: category.isHighConfidence,
    iban: category.iban,
    counterparty: category.counterparty,
    clientSuggestionId: category.clientId ?? row.clientSuggestionId,
    clientSuggestionName: row.clientSuggestion?.name ?? null,
    caseFileSuggestionId: category.caseFileId ?? row.caseFileSuggestionId,
    caseFileSuggestionTitle: row.caseFileSuggestion?.title ?? null,
    matchType: row.matchType,
    matchedSignals: category.matchedSignals,
    candidateCount: category.candidates.length
  };
}

function distribution(rows: CategorizedStatementRow[]): CategoryDistributionItem[] {
  const grouped = new Map<string, { category: string; group: string; count: number; total: number; confidenceTotal: number }>();

  for (const row of rows) {
    const key = `${row.group}:${row.category}`;
    const current = grouped.get(key) ?? { category: row.category, group: row.group, count: 0, total: 0, confidenceTotal: 0 };
    current.count += 1;
    current.total += row.amount;
    current.confidenceTotal += row.confidence;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      category: item.category,
      group: item.group,
      count: item.count,
      total: roundMoney(item.total),
      averageConfidence: roundMoney(item.confidenceTotal / item.count)
    }))
    .sort((a, b) => b.total - a.total);
}

function toLargeTransactionItem(row: CategorizedStatementRow): LargeTransactionItem {
  return {
    rowId: row.rowId,
    rowNumber: row.rowNumber,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    confidence: row.confidence
  };
}

async function getRowsForScreenScope(userId: string, importId?: string | null) {
  return prisma.bankStatementRow.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "SUCCESS",
      transactionDate: { not: null },
      import: { deletedAt: null, ...(importId ? { id: importId } : {}) }
    },
    orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
    include: rowInclude,
    take: 10000
  });
}

function buildRecurringFromCategorizedRows(rows: CategorizedStatementRow[]) {
  const grouped = new Map<string, CategorizedStatementRow[]>();

  for (const row of rows.filter((item) => item.date && item.direction !== "NEUTRAL" && item.group !== "TRANSFER")) {
    const key = recurringKey(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const recurring = [...grouped.entries()]
    .map(([key, groupRows]) => buildRecurringItem(key, groupRows))
    .filter((item): item is RecurringTransactionItem => item != null)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    income: recurring.filter((item) => item.direction === "IN").slice(0, 20),
    expense: recurring.filter((item) => item.direction === "OUT").slice(0, 20)
  };
}

function buildLargeTransactionsFromCategorizedRows(rows: CategorizedStatementRow[]) {
  const sorted = rows
    .filter((row) => row.amount > 0 && row.direction !== "NEUTRAL")
    .sort((a, b) => b.amount - a.amount);

  return {
    income: sorted.filter((row) => row.direction === "IN").slice(0, 20).map(toLargeTransactionItem),
    expense: sorted.filter((row) => row.direction === "OUT").slice(0, 20).map(toLargeTransactionItem)
  };
}

function buildConfidenceSummary(rows: CategorizedStatementRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.confidence >= 0.78) summary.high += 1;
      else if (row.confidence >= 0.6) summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

async function getLedgerCandidatesForRows(userId: string, rows: AnalysisRow[], cashAccountId?: string | null): Promise<LedgerMovementForMatch[]> {
  const rowsWithDates = rows.filter((row) => row.transactionDate);
  const sortedDates = rowsWithDates.map((row) => row.transactionDate as Date).sort((a, b) => a.getTime() - b.getTime());
  const startDate = sortedDates[0] ? new Date(sortedDates[0].getTime() - 7 * 86400000) : undefined;
  const endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1].getTime() + 7 * 86400000) : undefined;

  const entries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      ...(cashAccountId ? { cashAccountId } : {}),
      deletedAt: null,
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {})
    },
    orderBy: { date: "desc" },
    take: 3000,
    select: {
      id: true,
      incomeId: true,
      expenseId: true,
      direction: true,
      amount: true,
      date: true,
      description: true,
      clientId: true,
      caseFileId: true
    }
  });

  return entries.map((entry) => ({ ...entry, direction: entry.direction as TransactionDirection }));
}

function buildLedgerMatchSummary(bankRows: ReturnType<typeof toBankMovementForMatch>[], ledgerEntries: LedgerMovementForMatch[]) {
  const suggestedMatches = bankRows
    .filter((row) => !isApprovedBankMatch(row) && !isIgnoredBankMatch(row))
    .map((row) => suggestLedgerMatch(row, ledgerEntries))
    .filter((match): match is NonNullable<typeof match> => match != null)
    .sort((a, b) => b.confidence - a.confidence);

  const unmatchedBankRows = bankRows
    .filter((row) => !isApprovedBankMatch(row) && !isIgnoredBankMatch(row))
    .filter((row) => !suggestedMatches.some((match) => match.rowId === row.id))
    .map((row) => ({
      rowId: row.id,
      rowNumber: row.rowNumber,
      date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
      description: row.description,
      direction: row.direction,
      amount: Math.abs(toNumber(row.amount))
    }));

  return {
    matchedRows: bankRows.filter(isApprovedBankMatch).length,
    suggestedMatches: suggestedMatches.slice(0, 100),
    unmatchedBankRows: unmatchedBankRows.slice(0, 100),
    unmatchedSystemMovements: findUnmatchedSystemMovements(bankRows, ledgerEntries)
  };
}

function applyScreenRowFilters(
  rows: CategorizedStatementRow[],
  filters: Pick<BankAnalysisScreenFilters, "direction" | "category" | "match">,
  suggestedMatches: Array<{ rowId: string }>
) {
  return rows.filter((row) => {
    if (filters.direction && filters.direction !== "ALL" && row.direction !== filters.direction) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.match && filters.match !== "ALL") {
      const hasSuggestion = suggestedMatches.some((match) => match.rowId === row.rowId);
      const matchStatus = screenMatchStatus(row, hasSuggestion);
      if (matchStatus !== filters.match) return false;
    }
    return true;
  });
}

function highestMonth(points: MonthlyCashFlowPoint[], key: "income" | "expense") {
  const winner = [...points].sort((a, b) => b[key] - a[key])[0];
  return winner ? { label: winner.label, value: winner[key] } : { label: "-", value: 0 };
}

function shortLabel(value: string) {
  return value.length > 28 ? `${value.slice(0, 25)}...` : value;
}

function buildInsights({
  monthly,
  recurring,
  categorizedRows,
  ledgerMatches,
  averageMonthlyExpense
}: {
  monthly: MonthlyCashFlowPoint[];
  recurring: { income: RecurringTransactionItem[]; expense: RecurringTransactionItem[] };
  categorizedRows: CategorizedStatementRow[];
  ledgerMatches: ReturnType<typeof buildLedgerMatchSummary>;
  averageMonthlyExpense: number;
}) {
  const insights: Array<{ tone: "green" | "rose" | "amber" | "blue" | "neutral"; title: string; description: string }> = [];
  const lastMonth = monthly[monthly.length - 1];

  if (lastMonth && averageMonthlyExpense > 0 && lastMonth.expense > averageMonthlyExpense * 1.15) {
    insights.push({
      tone: "rose",
      title: "Bu ay giderler ortalamanın üstünde.",
      description: `${lastMonth.label} gideri son 12 ay ortalamasının üzerinde.`
    });
  }

  const rent = recurring.expense.find((item) => normalizeTransactionText(item.category).includes("kira") || normalizeTransactionText(item.label).includes("kira"));
  if (rent) {
    insights.push({
      tone: "amber",
      title: "Düzenli kira ödemesi tespit edildi.",
      description: `${rent.count} hareket, ortalama ${Math.round(rent.averageAmount).toLocaleString("tr-TR")} TL.`
    });
  }

  const tax = recurring.expense.find((item) => ["vergi", "sgk"].some((keyword) => normalizeTransactionText(item.category).includes(keyword) || normalizeTransactionText(item.label).includes(keyword)));
  if (tax) {
    insights.push({
      tone: "amber",
      title: "Vergi/SGK benzeri düzenli ödeme bulundu.",
      description: `${tax.category} kategorisinde düzenli hareket adayı var.`
    });
  }

  const possibleClientPayments = categorizedRows.filter((row) => row.direction === "IN" && row.category === "Müvekkil Ödemesi").length;
  if (possibleClientPayments > 0) {
    insights.push({
      tone: "green",
      title: `Müvekkil ödemesi olabilecek ${possibleClientPayments} hareket var.`,
      description: "Düşük güvenli öneriler otomatik kaydedilmedi; kullanıcı onayı gerekir."
    });
  }

  const unmatchedIncome = ledgerMatches.unmatchedBankRows.filter((row) => row.direction === "IN").length;
  if (unmatchedIncome > 0) {
    insights.push({
      tone: "blue",
      title: "Sistemde karşılığı olmayan banka girişleri var.",
      description: `${unmatchedIncome} giriş tahsilat veya kasa hareketiyle eşleşmemiş görünüyor.`
    });
  }

  const unmatchedExpense = ledgerMatches.unmatchedBankRows.filter((row) => row.direction === "OUT").length;
  if (unmatchedExpense > 0) {
    insights.push({
      tone: "rose",
      title: "Sistemde karşılığı olmayan banka çıkışları var.",
      description: `${unmatchedExpense} çıkış gider veya kasa hareketiyle eşleşmemiş görünüyor.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "neutral",
      title: "Analiz sakin görünüyor.",
      description: "Son 12 ay için belirgin sapma veya düzenli ödeme adayı bulunmadı."
    });
  }

  return insights;
}

function recurringKey(row: CategorizedStatementRow) {
  const normalized = normalizeTransactionText(row.description)
    .replace(/\btr\d{2}[a-z0-9]{5,30}\b/g, "")
    .replace(/\d+/g, " ")
    .replace(/\b(eft|fast|havale|pos|atm|ref|no|islem|işlem)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((part) => part.length > 3)
    .slice(0, 5)
    .join(" ");

  return `${row.direction}:${row.category}:${normalized || row.category}`;
}

function buildRecurringItem(key: string, rows: CategorizedStatementRow[]): RecurringTransactionItem | null {
  if (rows.length < 3) return null;
  const datedRows = rows
    .filter((row) => row.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const distinctMonths = new Set(datedRows.map((row) => String(row.date).slice(0, 7))).size;
  if (distinctMonths < 2) return null;

  const intervals = datedRows.slice(1).map((row, index) => {
    const previous = new Date(`${datedRows[index].date}T00:00:00+03:00`);
    const current = new Date(`${row.date}T00:00:00+03:00`);
    return Math.round((current.getTime() - previous.getTime()) / 86400000);
  });
  const averageIntervalDays = intervals.length > 0 ? Math.round(intervals.reduce((total, day) => total + day, 0) / intervals.length) : null;
  const regularEnough = averageIntervalDays == null || (averageIntervalDays >= 20 && averageIntervalDays <= 45) || distinctMonths >= 3;
  if (!regularEnough) return null;

  const totalAmount = rows.reduce((total, row) => total + row.amount, 0);
  const firstDate = datedRows[0]?.date ?? null;
  const lastDate = datedRows[datedRows.length - 1]?.date ?? null;
  const nextExpectedDate =
    lastDate && averageIntervalDays ? dateInputValue(new Date(new Date(`${lastDate}T00:00:00+03:00`).getTime() + averageIntervalDays * 86400000)) : null;
  const [, category, label] = key.split(":");

  return {
    key,
    label: label || category || rows[0].category,
    direction: rows[0].direction,
    category: rows[0].category,
    count: rows.length,
    distinctMonths,
    averageAmount: roundMoney(totalAmount / rows.length),
    totalAmount: roundMoney(totalAmount),
    averageIntervalDays,
    firstDate,
    lastDate,
    nextExpectedDate
  };
}

function matchNamedEntity(description: string, entities: Array<{ id: string; name: string }>) {
  const text = normalizeTransactionText(description);
  return entities.find((entity) =>
    normalizeTransactionText(entity.name)
      .split(" ")
      .some((part) => part.length > 2 && text.includes(part))
  );
}

function matchCaseFile(description: string, caseFiles: Array<{ id: string; title: string; fileNumber: string | null }>) {
  const text = normalizeTransactionText(description);
  return caseFiles.find((caseFile) => {
    const fileNumber = normalizeTransactionText(caseFile.fileNumber ?? "");
    const titleMatches = normalizeTransactionText(caseFile.title)
      .split(" ")
      .some((part) => part.length > 3 && text.includes(part));
    return (fileNumber && text.includes(fileNumber)) || titleMatches;
  });
}

async function getLedgerCandidates(bankImport: Awaited<ReturnType<typeof getImportWithRows>>): Promise<LedgerMovementForMatch[]> {
  const rowsWithDates = bankImport.rows.filter((row) => row.transactionDate);
  const sortedDates = rowsWithDates.map((row) => row.transactionDate as Date).sort((a, b) => a.getTime() - b.getTime());
  const startDate = sortedDates[0] ? new Date(sortedDates[0].getTime() - 7 * 86400000) : undefined;
  const endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1].getTime() + 7 * 86400000) : undefined;

  const entries = await prisma.cashLedgerEntry.findMany({
    where: {
      userId: bankImport.userId,
      ...(bankImport.cashAccountId ? { cashAccountId: bankImport.cashAccountId } : {}),
      deletedAt: null,
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {})
    },
    orderBy: { date: "desc" },
    take: 2000,
    select: {
      id: true,
      incomeId: true,
      expenseId: true,
      direction: true,
      amount: true,
      date: true,
      description: true,
      clientId: true,
      caseFileId: true
    }
  });

  return entries.map((entry) => ({
    ...entry,
    direction: entry.direction as TransactionDirection
  }));
}

function toBankMovementForMatch(row: AnalysisRow) {
  return {
    id: row.id,
    rowNumber: row.rowNumber,
    transactionDate: row.transactionDate,
    description: row.description,
    amount: row.amount,
    direction: row.direction as TransactionDirection,
    matchType: row.matchType,
    matchedCashLedgerEntryId: row.matchedCashLedgerEntryId,
    matchedIncomeId: row.matchedIncomeId,
    matchedExpenseId: row.matchedExpenseId
  };
}

function screenMatchStatus(row: { matchType?: string | null }, hasSuggestion: boolean): "MATCHED" | "SUGGESTED" | "UNMATCHED" {
  if (isApprovedBankMatch(row)) return "MATCHED";
  if (hasSuggestion || isSuggestedBankMatch(row)) return "SUGGESTED";
  return "UNMATCHED";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type Last12MonthsAnalysis = {
  startDate: string;
  endDate: string;
  monthly: MonthlyCashFlowPoint[];
  totals: {
    income: number;
    expense: number;
    net: number;
  };
};

export type BankStatementDirectionForAnalysis = BankStatementDirection;
