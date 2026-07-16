import { type Prisma } from "@prisma/client";

import { documentTypeLabels } from "@/lib/document-labels";
import {
  assetTypeLabels,
  cashLedgerEntryTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  receiptStatusLabels,
  receiptTypeLabels
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { normalizeSearchQuery, normalizeSearchText, tokenizeSearchQuery } from "@/lib/search/normalize";
import { DATABASE_CONTAINS_SEARCH_PROVIDER } from "@/lib/search/search-index";
import type { GlobalSearchData, SearchResultGroup, SearchResultItem } from "@/lib/search/types";
import { SEARCH_GROUP_LABELS } from "@/lib/search/types";
import { endOfDateInput, formatDate, formatDirectionalMoney, formatMoney, parseDateInput, toNumber } from "@/lib/utils";

export type { GlobalSearchData, SearchResultGroup, SearchResultGroupId, SearchResultItem } from "@/lib/search/types";

const SEARCH_LIMIT_PER_SOURCE = 6;

export async function searchAll(userId: string, query: string): Promise<GlobalSearchData> {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length < 2) {
    return emptySearch(normalizedQuery);
  }

  const helpers = buildSearchHelpers(normalizedQuery);
  const [
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    cashLedgerEntries,
    documents,
    bankStatementRows,
    assetAccounts
  ] = await Promise.all([
    searchClients(userId, helpers),
    searchCaseFiles(userId, helpers),
    searchIncomes(userId, helpers),
    searchExpenses(userId, helpers),
    searchInvoiceOrReceipts(userId, helpers),
    searchCashLedgerEntries(userId, helpers),
    searchDocuments(userId, helpers),
    searchBankStatementRows(userId, helpers),
    searchAssetAccounts(userId, helpers)
  ]);

  const financeItems = [
    ...incomes.map(serializeIncome),
    ...expenses.map(serializeExpense),
    ...invoiceOrReceipts.map(serializeInvoiceOrReceipt),
    ...cashLedgerEntries.map(serializeCashLedgerEntry)
  ]
    .sort((a, b) => sortByMetaDate(b.meta) - sortByMetaDate(a.meta))
    .slice(0, SEARCH_LIMIT_PER_SOURCE * 2);

  const allGroups: SearchResultGroup[] = [
    { id: "clients", title: SEARCH_GROUP_LABELS.clients, items: clients.map(serializeClient) },
    { id: "cases", title: SEARCH_GROUP_LABELS.cases, items: caseFiles.map(serializeCaseFile) },
    { id: "finance", title: SEARCH_GROUP_LABELS.finance, items: financeItems },
    { id: "documents", title: SEARCH_GROUP_LABELS.documents, items: documents.map(serializeDocument) },
    { id: "bank", title: SEARCH_GROUP_LABELS.bank, items: bankStatementRows.map(serializeBankStatementRow) },
    { id: "capital", title: SEARCH_GROUP_LABELS.capital, items: assetAccounts.map(serializeAssetAccount) }
  ];
  const groups = allGroups.filter((group) => group.items.length > 0);

  return {
    query: normalizedQuery,
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups,
    provider: {
      ...DATABASE_CONTAINS_SEARCH_PROVIDER,
      mode: "DATABASE_CONTAINS",
      normalizedQuery: helpers.normalizedQuery
    }
  };
}

function emptySearch(query: string): GlobalSearchData {
  return {
    query,
    total: 0,
    groups: [],
    provider: {
      ...DATABASE_CONTAINS_SEARCH_PROVIDER,
      mode: "DATABASE_CONTAINS",
      normalizedQuery: normalizeSearchText(query)
    }
  };
}

function searchClients(userId: string, helpers: SearchHelpers) {
  return prisma.client.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: containsAny(["name", "tcNo", "taxNo", "phone", "email", "address", "notes"], helpers)
    },
    orderBy: { updatedAt: "desc" },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchCaseFiles(userId: string, helpers: SearchHelpers) {
  return prisma.caseFile.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["title", "courtOrOffice", "fileNumber", "caseType", "notes"], helpers),
        { client: { name: { contains: helpers.query } } }
      ]
    },
    orderBy: { updatedAt: "desc" },
    include: { client: { select: { name: true } } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchIncomes(userId: string, helpers: SearchHelpers) {
  return prisma.income.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["description", "receiptNumber", "currency"], helpers),
        { client: { name: { contains: helpers.query } } },
        { caseFile: { title: { contains: helpers.query } } },
        { caseFile: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("amount", "date", helpers),
        ...(helpers.incomeCategories.length > 0 ? [{ category: { in: helpers.incomeCategories } }] : [])
      ]
    },
    orderBy: { date: "desc" },
    include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchExpenses(userId: string, helpers: SearchHelpers) {
  return prisma.expense.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["description", "currency"], helpers),
        { client: { name: { contains: helpers.query } } },
        { caseFile: { title: { contains: helpers.query } } },
        { caseFile: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("amount", "date", helpers),
        ...(helpers.expenseCategories.length > 0 ? [{ category: { in: helpers.expenseCategories } }] : [])
      ]
    },
    orderBy: { date: "desc" },
    include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchInvoiceOrReceipts(userId: string, helpers: SearchHelpers) {
  return prisma.invoiceOrReceipt.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["number", "notes"], helpers),
        { client: { name: { contains: helpers.query } } },
        { caseFile: { title: { contains: helpers.query } } },
        { caseFile: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("netAmount", "issueDate", helpers),
        ...(helpers.receiptTypes.length > 0 ? [{ type: { in: helpers.receiptTypes } }] : []),
        ...(helpers.receiptStatuses.length > 0 ? [{ status: { in: helpers.receiptStatuses } }] : [])
      ]
    },
    orderBy: { issueDate: "desc" },
    include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchCashLedgerEntries(userId: string, helpers: SearchHelpers) {
  return prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["description", "referenceNo", "currency"], helpers),
        { cashAccount: { name: { contains: helpers.query } } },
        { client: { name: { contains: helpers.query } } },
        { caseFile: { title: { contains: helpers.query } } },
        { caseFile: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("amount", "date", helpers),
        ...(helpers.cashEntryTypes.length > 0 ? [{ entryType: { in: helpers.cashEntryTypes } }] : [])
      ]
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      cashAccount: { select: { name: true } },
      client: { select: { name: true } },
      caseFile: { select: { title: true, fileNumber: true } }
    },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchDocuments(userId: string, helpers: SearchHelpers) {
  return prisma.document.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["title", "description", "fileName", "originalFileName", "mimeType", "extractedText", "currency"], helpers),
        { linkedClient: { name: { contains: helpers.query } } },
        { linkedCaseFile: { title: { contains: helpers.query } } },
        { linkedCaseFile: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("amount", "documentDate", helpers),
        { uploadedAt: helpers.date ? { gte: helpers.date.start, lte: helpers.date.end } : undefined },
        ...(helpers.documentTypes.length > 0 ? [{ documentType: { in: helpers.documentTypes } }] : [])
      ].filter(Boolean) as Prisma.DocumentWhereInput[]
    },
    orderBy: { uploadedAt: "desc" },
    include: { linkedClient: { select: { name: true } }, linkedCaseFile: { select: { title: true, fileNumber: true } } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchBankStatementRows(userId: string, helpers: SearchHelpers) {
  return prisma.bankStatementRow.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["description", "currency", "categorySuggestion", "errorMessage"], helpers),
        { import: { bankName: { contains: helpers.query } } },
        { import: { originalFileName: { contains: helpers.query } } },
        { clientSuggestion: { name: { contains: helpers.query } } },
        { caseFileSuggestion: { title: { contains: helpers.query } } },
        { caseFileSuggestion: { fileNumber: { contains: helpers.query } } },
        ...decimalOrDateFilters("amount", "transactionDate", helpers)
      ]
    },
    orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
    include: {
      import: { select: { id: true, bankName: true, originalFileName: true } },
      clientSuggestion: { select: { name: true } },
      caseFileSuggestion: { select: { title: true, fileNumber: true } }
    },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function searchAssetAccounts(userId: string, helpers: SearchHelpers) {
  return prisma.assetAccount.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        ...containsAny(["name", "currency", "symbol", "valuationCurrency", "description"], helpers),
        ...decimalAssetFilters(helpers),
        ...(helpers.assetTypes.length > 0 ? [{ assetType: { in: helpers.assetTypes } }] : [])
      ]
    },
    orderBy: { updatedAt: "desc" },
    include: { valuations: { orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }], take: 1 } },
    take: SEARCH_LIMIT_PER_SOURCE
  });
}

function serializeClient(row: Awaited<ReturnType<typeof searchClients>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "clients",
    type: "Müvekkil",
    title: row.name,
    description: [row.type === "COMPANY" ? "Şirket" : "Gerçek kişi", row.email, row.phone].filter(Boolean).join(" · "),
    meta: `Güncellendi: ${formatDate(row.updatedAt)}`,
    href: `/clients/${row.id}`,
    tone: "blue"
  };
}

function serializeCaseFile(row: Awaited<ReturnType<typeof searchCaseFiles>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "cases",
    type: "Dosya",
    title: row.title,
    description: [row.client.name, row.fileNumber, row.courtOrOffice].filter(Boolean).join(" · "),
    meta: `Durum: ${row.status} · ${formatDate(row.updatedAt)}`,
    href: `/cases/${row.id}`,
    tone: row.status === "ACTIVE" ? "green" : "neutral"
  };
}

function serializeIncome(row: Awaited<ReturnType<typeof searchIncomes>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "finance",
    type: "Tahsilat",
    title: row.description || incomeCategoryLabels[row.category],
    description: [row.client.name, caseLabel(row.caseFile), incomeCategoryLabels[row.category]].filter(Boolean).join(" · "),
    meta: formatDate(row.date),
    href: `/collections/${row.id}`,
    amountLabel: formatDirectionalMoney(row.amount, "IN", row.currency),
    tone: "green"
  };
}

function serializeExpense(row: Awaited<ReturnType<typeof searchExpenses>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "finance",
    type: "Gider",
    title: row.description || expenseCategoryLabels[row.category],
    description: [row.client?.name ?? "Genel gider", caseLabel(row.caseFile), expenseCategoryLabels[row.category]].filter(Boolean).join(" · "),
    meta: formatDate(row.date),
    href: `/expenses/${row.id}`,
    amountLabel: formatDirectionalMoney(row.amount, "OUT", row.currency),
    tone: "rose"
  };
}

function serializeInvoiceOrReceipt(row: Awaited<ReturnType<typeof searchInvoiceOrReceipts>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "finance",
    type: "Makbuz/Fatura",
    title: `${receiptTypeLabels[row.type]} ${row.number}`,
    description: [row.client.name, caseLabel(row.caseFile), receiptStatusLabels[row.status]].filter(Boolean).join(" · "),
    meta: formatDate(row.issueDate),
    href: "/receipts",
    amountLabel: formatMoney(row.netAmount),
    tone: row.status === "UNPAID" ? "amber" : row.status === "CANCELLED" ? "rose" : "blue"
  };
}

function serializeCashLedgerEntry(row: Awaited<ReturnType<typeof searchCashLedgerEntries>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "finance",
    type: "Kasa Hareketi",
    title: row.description || cashLedgerEntryTypeLabels[row.entryType],
    description: [row.cashAccount.name, row.client?.name, caseLabel(row.caseFile), cashLedgerEntryTypeLabels[row.entryType]].filter(Boolean).join(" · "),
    meta: formatDate(row.date),
    href: `/cash/ledger/${row.id}`,
    amountLabel: formatDirectionalMoney(row.amount, row.direction, row.currency),
    tone: row.direction === "IN" ? "green" : "rose"
  };
}

function serializeDocument(row: Awaited<ReturnType<typeof searchDocuments>>[number]): SearchResultItem {
  return {
    id: row.id,
    group: "documents",
    type: documentTypeLabels[row.documentType],
    title: row.title,
    description: [row.originalFileName, row.linkedClient?.name, caseLabel(row.linkedCaseFile)].filter(Boolean).join(" · "),
    meta: formatDate(row.documentDate ?? row.uploadedAt),
    href: `/documents/${row.id}`,
    amountLabel: row.amount ? formatMoney(row.amount, row.currency) : undefined,
    tone: row.extractionStatus === "FAILED" ? "amber" : "blue"
  };
}

function serializeBankStatementRow(row: Awaited<ReturnType<typeof searchBankStatementRows>>[number]): SearchResultItem {
  const amount = Math.abs(toNumber(row.amount));
  return {
    id: row.id,
    group: "bank",
    type: "Banka Hareketi",
    title: row.description,
    description: [row.import.bankName, row.categorySuggestion, row.clientSuggestion?.name, caseLabel(row.caseFileSuggestion)].filter(Boolean).join(" · "),
    meta: formatDate(row.transactionDate),
    href: `/bank-statements/${row.import.id}`,
    amountLabel: row.direction === "OUT" ? formatDirectionalMoney(amount, "OUT", row.currency) : row.direction === "IN" ? formatDirectionalMoney(amount, "IN", row.currency) : formatMoney(amount, row.currency),
    tone: row.direction === "OUT" ? "rose" : row.direction === "IN" ? "green" : "neutral"
  };
}

function serializeAssetAccount(row: Awaited<ReturnType<typeof searchAssetAccounts>>[number]): SearchResultItem {
  const latestValuation = row.valuations[0];
  const value = latestValuation?.totalValue ?? row.manualTotalValue;
  return {
    id: row.id,
    group: "capital",
    type: "Sermaye",
    title: row.name,
    description: [assetTypeLabels[row.assetType], row.symbol, row.currency].filter(Boolean).join(" · "),
    meta: `Güncellendi: ${formatDate(row.updatedAt)}`,
    href: "/capital/assets",
    amountLabel: value ? formatMoney(value, row.valuationCurrency) : undefined,
    tone: row.assetType === "DEBT" ? "rose" : "blue"
  };
}

type SearchHelpers = {
  query: string;
  normalizedQuery: string;
  tokens: string[];
  number: number | null;
  date: { start: Date; end: Date } | null;
  incomeCategories: Array<keyof typeof incomeCategoryLabels>;
  expenseCategories: Array<keyof typeof expenseCategoryLabels>;
  receiptTypes: Array<keyof typeof receiptTypeLabels>;
  receiptStatuses: Array<keyof typeof receiptStatusLabels>;
  cashEntryTypes: Array<keyof typeof cashLedgerEntryTypeLabels>;
  documentTypes: Array<keyof typeof documentTypeLabels>;
  assetTypes: Array<keyof typeof assetTypeLabels>;
};

function buildSearchHelpers(query: string): SearchHelpers {
  return {
    query,
    normalizedQuery: normalizeSearchText(query),
    tokens: tokenizeSearchQuery(query),
    number: numericQuery(query),
    date: dateQuery(query),
    incomeCategories: matchingLabelKeys(incomeCategoryLabels, query),
    expenseCategories: matchingLabelKeys(expenseCategoryLabels, query),
    receiptTypes: matchingLabelKeys(receiptTypeLabels, query),
    receiptStatuses: matchingLabelKeys(receiptStatusLabels, query),
    cashEntryTypes: matchingLabelKeys(cashLedgerEntryTypeLabels, query),
    documentTypes: matchingLabelKeys(documentTypeLabels, query),
    assetTypes: matchingLabelKeys(assetTypeLabels, query)
  };
}

function containsAny(fields: string[], helpers: SearchHelpers) {
  const variants = Array.from(new Set([helpers.query, helpers.normalizedQuery, ...helpers.tokens].filter((value) => value.length >= 2)));
  return fields.flatMap((field) => variants.map((query) => ({ [field]: { contains: query } })));
}

function decimalOrDateFilters(amountField: string, dateField: string, helpers: SearchHelpers) {
  const filters: Array<Record<string, unknown>> = [];
  if (helpers.number != null) filters.push({ [amountField]: { equals: helpers.number } });
  if (helpers.date) filters.push({ [dateField]: { gte: helpers.date.start, lte: helpers.date.end } });
  return filters;
}

function decimalAssetFilters(helpers: SearchHelpers) {
  if (helpers.number == null) return [];
  return [
    { quantity: { equals: helpers.number } },
    { unitPrice: { equals: helpers.number } },
    { manualTotalValue: { equals: helpers.number } }
  ];
}

function matchingLabelKeys<T extends Record<string, string>>(labels: T, query: string) {
  const normalized = normalizeSearchText(query);
  return Object.entries(labels)
    .filter(([key, label]) => normalizeSearchText(key).includes(normalized) || normalizeSearchText(label).includes(normalized))
    .map(([key]) => key as keyof T);
}

function numericQuery(query: string) {
  const parsed = toNumber(query);
  return parsed > 0 ? parsed : null;
}

function dateQuery(query: string) {
  const trimmed = query.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const trMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  const compactTrMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (isoMatch) return dateBounds(trimmed);
  const match = trMatch ?? compactTrMatch;
  if (!match) return null;
  const [, day, month, year] = match;
  return dateBounds(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}

function dateBounds(value: string) {
  return { start: parseDateInput(value), end: endOfDateInput(value) };
}

function caseLabel(caseFile: { title: string; fileNumber?: string | null } | null) {
  if (!caseFile) return "";
  return `${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`;
}

function sortByMetaDate(value: string) {
  const [day, month, year] = value.split(".").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}
