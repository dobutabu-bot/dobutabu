import { EmptyState } from "@/components/empty-state";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { isSensitiveFinancialColumn } from "@/lib/ui/privacy";
import { cn } from "@/lib/utils";

type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  empty: string;
};

export function DataTable<T>({ columns, rows, empty }: DataTableProps<T>) {
  return (
    <div className="min-w-0">
      <div className="surface overflow-hidden md:hidden">
        {rows.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <MobileDataCard key={index} row={row} columns={columns} />
            ))}
          </div>
        )}
      </div>

      <div className="surface hidden overflow-hidden md:block">
        <div className="scroll-x-stable">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-950 text-xs uppercase text-slate-300">
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
                <tr key={index} className="bg-white hover:bg-slate-50/70">
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
    <article className="bg-white/75 p-3">
      <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50/80 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{primaryColumn.header}</p>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950">{renderCell(primaryColumn, row)}</div>
        </div>
        {secondaryColumn ? (
          <div className="max-w-[45%] shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{secondaryColumn.header}</p>
            <div className="mt-1 truncate text-sm font-medium text-slate-700">{renderCell(secondaryColumn, row)}</div>
          </div>
        ) : null}
      </div>

      {detailColumns.length > 0 ? (
        <dl className="mt-3 grid gap-2">
          {detailColumns.map((column) => (
            <div key={column.header} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
              <dt className="shrink-0 text-xs font-medium text-slate-500">{column.header}</dt>
              <dd className={cn("min-w-0 text-right text-sm text-slate-800", column.className)}>{renderCell(column, row)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actionColumns.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white/80 p-2">
          {actionColumns.map((column) => (
            <div key={column.header} className="flex justify-end">
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
    "px-4 py-3 font-medium whitespace-nowrap",
    isActionColumn(header) ? "sticky right-0 z-10 min-w-44 bg-slate-950 text-right shadow-[-12px_0_18px_rgba(15,23,42,0.12)]" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function cnCell(header: string, className?: string) {
  return [
    "px-4 py-3 align-top text-slate-700",
    isActionColumn(header) ? "sticky right-0 z-10 min-w-44 bg-white text-right shadow-[-12px_0_18px_rgba(15,23,42,0.05)]" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function isActionColumn(header: string) {
  return ["İşlem", "Aksiyon"].includes(header);
}

function renderCell<T>(column: Column<T>, row: T) {
  const content = column.cell(row);
  if (!isSensitiveFinancialColumn(column.header)) return content;
  return <PrivacyAmount>{content}</PrivacyAmount>;
}
