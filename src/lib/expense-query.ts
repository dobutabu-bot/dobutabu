import type { Prisma } from "@prisma/client";

export type ExpenseFilters = {
  clientId?: string;
  caseFileId?: string;
  category?: string;
  scope?: string;
  reimbursable?: string;
};

const expenseCategories = [
  "COURT_FEE",
  "NOTARY",
  "TRAVEL",
  "ACCOMMODATION",
  "OFFICE",
  "TAX",
  "PERSONNEL",
  "MEAL",
  "OTHER"
] as const;
const expenseScopes = ["GENERAL", "CASE", "CLIENT"] as const;
const reimbursableFilters = ["YES", "NO"] as const;

type ExpenseCategoryFilter = (typeof expenseCategories)[number];
type ExpenseScopeFilter = (typeof expenseScopes)[number];
type ReimbursableFilter = (typeof reimbursableFilters)[number];

export function expenseWhereFromFilters(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    AND: [
      { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
      { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
    ]
  };
  const clientId = clean(filters.clientId);
  const caseFileId = clean(filters.caseFileId);
  const category = clean(filters.category);
  const scope = clean(filters.scope);
  const reimbursable = clean(filters.reimbursable);

  if (clientId) {
    where.clientId = clientId;
  }

  if (caseFileId) {
    where.caseFileId = caseFileId;
  }

  if (isExpenseCategory(category)) {
    where.category = category;
  }

  if (isReimbursableFilter(reimbursable)) {
    where.isClientExpense = reimbursable === "YES";
  }

  if (!caseFileId && !clientId && isExpenseScope(scope)) {
    if (scope === "GENERAL") {
      where.clientId = null;
      where.caseFileId = null;
    }

    if (scope === "CASE") {
      where.caseFileId = { not: null };
    }

    if (scope === "CLIENT") {
      where.clientId = { not: null };
      where.caseFileId = null;
    }
  }

  return where;
}

export function expenseFiltersFromSearchParams(searchParams: URLSearchParams): ExpenseFilters {
  return {
    clientId: searchParams.get("clientId") ?? "",
    caseFileId: searchParams.get("caseFileId") ?? "",
    category: searchParams.get("category") ?? "",
    scope: searchParams.get("scope") ?? "",
    reimbursable: searchParams.get("reimbursable") ?? ""
  };
}

export function appendExpenseFilters(params: URLSearchParams, filters: ExpenseFilters) {
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

function isExpenseCategory(value: string): value is ExpenseCategoryFilter {
  return expenseCategories.includes(value as ExpenseCategoryFilter);
}

function isExpenseScope(value: string): value is ExpenseScopeFilter {
  return expenseScopes.includes(value as ExpenseScopeFilter);
}

function isReimbursableFilter(value: string): value is ReimbursableFilter {
  return reimbursableFilters.includes(value as ReimbursableFilter);
}
