export const DEFAULT_PAGE_SIZE = 25;
export const COMPACT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export type PaginationState = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function parsePagination(
  input: { page?: string; pageSize?: string },
  defaults: { pageSize?: number; maxPageSize?: number } = {}
): PaginationState {
  const pageSize = clampPositiveInteger(input.pageSize, defaults.pageSize ?? DEFAULT_PAGE_SIZE, defaults.maxPageSize ?? MAX_PAGE_SIZE);
  const page = clampPositiveInteger(input.page, 1, 999999);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function totalPages(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
}

export function pageInfo(totalItems: number, page: number, pageSize: number) {
  if (totalItems <= 0) {
    return { from: 0, to: 0, totalPages: 1 };
  }

  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(totalItems, page * pageSize),
    totalPages: totalPages(totalItems, pageSize)
  };
}

export function createPageHref(pathname: string, params: Record<string, string | undefined>, page: number) {
  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") {
      nextParams.set(key, value);
    }
  });

  if (page > 1) {
    nextParams.set("page", String(page));
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function clampPositiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}
