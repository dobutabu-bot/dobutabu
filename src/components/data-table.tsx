import { EmptyState } from "@/components/empty-state";
import { RecordActionMenu } from "@/components/action-menu";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { isSensitiveFinancialColumn } from "@/lib/ui/privacy";
import { cn } from "@/lib/utils";

type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  title?: (row: T) => string | undefined;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  empty: string;
};

export function DataTable<T>({ columns, rows, empty }: DataTableProps<T>) {
  return (
    <div className="w-full max-w-full min-w-0">
      <div className="surface w-full max-w-full min-w-0 overflow-hidden md:hidden">
        {rows.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <MobileDataCard key={recordKey(row, index)} row={row} columns={columns} />
            ))}
          </div>
        )}
      </div>

      <div className="surface hidden w-full max-w-full min-w-0 overflow-hidden md:block">
        <div className="scroll-x-stable max-h-[72dvh] w-full max-w-full">
          <table className="w-full min-w-[960px] table-auto text-left text-sm">
            <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-950 text-xs uppercase text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className={cnHeader(column.header)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={empty} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={recordKey(row, index)} className="bg-white transition hover:bg-slate-50/70">
                    {columns.map((column) => (
                      <td key={column.header} className={cnCell(column.header, column.className)}>
                        {renderCell(column, row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MobileDataCard<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  const primaryColumn = columns[0];
  const secondaryColumn = columns[1];
  const actionColumns = columns.filter((column) => isActionColumn(column.header));
  const detailColumns = columns.filter((column, index) => index > 1 && !isActionColumn(column.header));

  return (
    <article className="w-full max-w-full min-w-0 bg-white/75 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3 rounded-2xl bg-slate-50/80 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{primaryColumn.header}</p>
          <div className={cn("mt-1 truncate text-sm font-semibold text-slate-950", mobileValueClass(primaryColumn.header))}>
            {renderCell(primaryColumn, row)}
          </div>
        </div>
        {secondaryColumn ? (
          <div className="min-w-0 max-w-[45%] shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{secondaryColumn.header}</p>
            <div className={cn("mt-1 truncate text-sm font-medium text-slate-700", mobileValueClass(secondaryColumn.header))}>
              {renderCell(secondaryColumn, row)}
            </div>
          </div>
        ) : null}
      </div>

      {detailColumns.length > 0 ? (
        <dl className="mt-3 grid gap-2">
          {detailColumns.map((column) => (
            <div key={column.header} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
              <dt className="shrink-0 text-xs font-medium text-slate-500">{column.header}</dt>
              <dd className={cn("min-w-0 max-w-[68%] text-right text-sm text-slate-800", mobileValueClass(column.header), column.className)}>
                {renderCell(column, row)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actionColumns.length > 0 ? (
        <div className="mt-3 flex w-full max-w-full min-w-0 justify-end rounded-2xl border border-slate-100 bg-white/80 p-2">
          {actionColumns.map((column) => (
            <div key={column.header} className="flex w-full min-w-0 justify-end">
              {renderCell(column, row)}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function cnHeader(header: string) {
  return [
    "px-4 py-3 font-medium whitespace-nowrap tracking-[0.08em]",
    columnWidthClass(header),
    isActionColumn(header) ? "sticky right-0 z-30 bg-slate-950 text-right shadow-[-12px_0_18px_rgba(15,23,42,0.12)]" : "",
    isSensitiveFinancialColumn(header) ? "tabular-finance" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function cnCell(header: string, className?: string) {
  return [
    "min-w-0 max-w-80 overflow-hidden px-4 py-3 align-middle text-slate-700",
    columnWidthClass(header),
    isActionColumn(header) ? "sticky right-0 z-20 bg-white text-right shadow-[-12px_0_18px_rgba(15,23,42,0.05)]" : "",
    isSensitiveFinancialColumn(header) ? "whitespace-nowrap text-right tabular-finance font-semibold text-slate-900" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function isActionColumn(header: string) {
  return ["İşlem", "İşlemler", "Aksiyon", "Aksiyonlar"].includes(header);
}

function columnWidthClass(header: string) {
  if (isActionColumn(header)) return "w-16 min-w-16 max-w-16";
  if (/tarih/i.test(header)) return "w-[92px] min-w-[92px] whitespace-nowrap";
  if (isSensitiveFinancialColumn(header) || /tutar|brüt|net|kdv|stopaj|bakiye/i.test(header)) {
    return "w-[130px] min-w-[130px] whitespace-nowrap text-right";
  }
  if (/müvekkil/i.test(header)) return "w-[160px] min-w-[160px]";
  if (/dosya/i.test(header)) return "w-[160px] min-w-[160px]";
  if (/açıklama|not/i.test(header)) return "w-[220px] min-w-[220px]";
  if (/kasa|hesap/i.test(header)) return "w-[140px] min-w-[140px]";
  if (/kategori|tür|durum|yön/i.test(header)) return "w-[110px] min-w-[110px] whitespace-nowrap";
  return "min-w-[120px]";
}

function renderCell<T>(column: Column<T>, row: T) {
  const content = column.cell(row);
  if (isActionColumn(column.header)) {
    return <RecordActionMenu>{content}</RecordActionMenu>;
  }
  const renderedContent = isSensitiveFinancialColumn(column.header) ? <PrivacyAmount>{content}</PrivacyAmount> : content;
  const title = column.title?.(row) ?? primitiveTitle(content);

  return (
    <span className={cellContentClass(column.header)} title={title}>
      {renderedContent}
    </span>
  );
}

function cellContentClass(header: string) {
  if (isSensitiveFinancialColumn(header) || /tarih/i.test(header)) {
    return "inline-block max-w-full min-w-0 whitespace-nowrap align-middle";
  }
  return "block max-w-full min-w-0 truncate";
}

function mobileValueClass(header: string) {
  if (isSensitiveFinancialColumn(header) || /tarih|tutar|brüt|net|kdv|stopaj|bakiye/i.test(header)) {
    return "overflow-hidden text-ellipsis whitespace-nowrap tabular-finance font-semibold";
  }
  return "break-words [overflow-wrap:anywhere]";
}

function primitiveTitle(content: React.ReactNode) {
  if (typeof content === "string" || typeof content === "number") return String(content);
  return undefined;
}

function recordKey<T>(row: T, index: number) {
  if (row && typeof row === "object" && "id" in row) {
    const id = (row as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return index;
}
