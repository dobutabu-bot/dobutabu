import type { Prisma } from "@prisma/client";

import { endOfDateInput, parseDateInput } from "@/lib/utils";

export type CollectionFilters = {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  caseFileId?: string;
  category?: string;
};

const incomeCategories = ["LEGAL_FEE", "ADVANCE", "EXPENSE_REIMBURSEMENT", "OTHER"] as const;

type IncomeCategoryFilter = (typeof incomeCategories)[number];

export function collectionWhereFromFilters(filters: CollectionFilters): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = {
    deletedAt: null,
    client: { archivedAt: null, deletedAt: null },
    OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
  };
  const startDate = cleanDate(filters.startDate);
  const endDate = cleanDate(filters.endDate);
  const clientId = clean(filters.clientId);
  const caseFileId = clean(filters.caseFileId);
  const category = clean(filters.category);

  if (clientId) {
    where.clientId = clientId;
  }

  if (caseFileId) {
    where.caseFileId = caseFileId;
  }

  if (isIncomeCategory(category)) {
    where.category = category;
  }

  const date: Prisma.DateTimeFilter = {};

  if (startDate) {
    date.gte = parseDateInput(startDate);
  }

  if (endDate) {
    date.lte = endOfDateInput(endDate);
  }

  if (date.gte || date.lte) {
    where.date = date;
  }

  return where;
}

export function collectionFiltersFromSearchParams(searchParams: URLSearchParams): CollectionFilters {
  return {
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    clientId: searchParams.get("clientId") ?? "",
    caseFileId: searchParams.get("caseFileId") ?? "",
    category: searchParams.get("category") ?? ""
  };
}

export function appendCollectionFilters(params: URLSearchParams, filters: CollectionFilters) {
  for (const [key, value] of Object.entries(filters)) {
    const cleanValue = clean(value);

    if (cleanValue) {
      params.set(key, cleanValue);
    }
  }
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function cleanDate(value: string | undefined) {
  const next = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}

function isIncomeCategory(value: string): value is IncomeCategoryFilter {
  return incomeCategories.includes(value as IncomeCategoryFilter);
}
