import Link from "@/components/app-link";

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  totalItems?: number;
  pageSize?: number;
};

export function Pagination({ page, totalPages, hrefForPage, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;

  const previous = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const pages = visiblePages(page, totalPages);
  const from = totalItems && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = totalItems && pageSize ? Math.min(totalItems, page * pageSize) : null;

  return (
    <nav className="surface flex flex-wrap items-center justify-between gap-3 p-3" aria-label="Sayfalama" data-testid="pagination">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">
          Sayfa <span className="font-semibold text-slate-950">{page}</span> / {totalPages}
        </p>
        {from != null && to != null && totalItems != null ? (
          <p className="mt-0.5 text-xs text-slate-400">
            {from}-{to} / {totalItems} kayıt
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link aria-disabled={page <= 1} className={page <= 1 ? "secondary-action pointer-events-none opacity-50" : "secondary-action"} href={hrefForPage(previous)}>
          Önceki
        </Link>
        <div className="hidden gap-1 sm:flex">
          {pages.map((item, index) =>
            item === "…" ? (
              <span key={`ellipsis-${index}`} className="inline-flex h-10 min-w-10 items-center justify-center text-sm text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                aria-current={item === page ? "page" : undefined}
                className={
                  item === page
                    ? "inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-950 px-3 text-sm font-semibold text-white"
                    : "inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                {item}
              </Link>
            )
          )}
        </div>
        <Link aria-disabled={page >= totalPages} className={page >= totalPages ? "secondary-action pointer-events-none opacity-50" : "secondary-action"} href={hrefForPage(next)}>
          Sonraki
        </Link>
      </div>
    </nav>
  );
}

function visiblePages(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1].filter((item) => item >= 1 && item <= totalPages));
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];

  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) {
      result.push("…");
    }
    result.push(item);
  });

  return result;
}
