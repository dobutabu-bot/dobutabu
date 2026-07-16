import type { Prisma } from "@prisma/client";
import { ArrowRight, BarChart3, FileSpreadsheet, Landmark, Search, SearchCheck, Upload } from "lucide-react";
import Link from "@/components/app-link";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type BankStatementsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function BankStatementsPage({ searchParams }: BankStatementsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const where: Prisma.BankStatementImportWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(query ? { OR: [{ bankName: { contains: query } }, { originalFileName: { contains: query } }] } : {})
  };
  const [imports, totalCount] = await Promise.all([
    prisma.bankStatementImport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take
    }),
    prisma.bankStatementImport.count({ where })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);
  const totals = imports.reduce(
    (current, item) => {
      current.total += item.totalRows;
      current.success += item.successfulRows;
      current.failed += item.failedRows;
      current.duplicate += item.duplicateRows;
      return current;
    },
    { total: 0, success: 0, failed: 0, duplicate: 0 }
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="V3 Akıllı Finans"
        title="Banka Ekstreleri"
        description="Banka hareketlerini içe aktarın, sistemdeki kasa hareketleriyle karşılaştırın ve eşleşme önerilerini görün."
        actions={
          <>
          <Link href="/bank-statements/analysis" className="secondary-action min-h-12">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Son 12 Ay Analizi
          </Link>
          <Link href="/bank-statements/import" className="primary-action min-h-12">
            <Upload className="h-4 w-4" aria-hidden />
            Ekstre Yükle
          </Link>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="İçe Aktarım" value={String(totalCount)} icon={Landmark} />
        <SummaryCard label="Toplam Satır" value={String(totals.total)} icon={FileSpreadsheet} />
        <SummaryCard label="İşlenen / Sorunlu" value={`${totals.success} / ${totals.failed + totals.duplicate}`} tone={totals.failed > 0 ? "rose" : "green"} icon={FileSpreadsheet} />
      </section>

      <section className="surface p-4">
        <form className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row" action="/bank-statements">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Arama</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input className="field pl-10" name="q" defaultValue={query} placeholder="Banka veya dosya adı ara" />
          </label>
          <button className="primary-action min-h-11 justify-center" type="submit">Ara</button>
          {query ? <Link href="/bank-statements" className="secondary-action min-h-11 justify-center">Temizle</Link> : null}
        </form>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Son İçe Aktarımlar</h2>
          <p className="mt-1 text-xs text-slate-500">CSV, Excel ve PDF ekstreleri burada listelenir. Silinen kayıtlar normal listede görünmez.</p>
        </div>
        <DataTable
          rows={imports}
          empty="Henüz banka ekstresi içe aktarılmadı"
          columns={[
            {
              header: "Banka",
              cell: (row) => (
                <Link href={`/bank-statements/${row.id}`} className="font-semibold text-slate-950 hover:underline">
                  {row.bankName}
                </Link>
              )
            },
            { header: "Dönem", cell: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}` },
            { header: "Satır", cell: (row) => `${row.successfulRows}/${row.totalRows}` },
            {
              header: "Durum",
              cell: (row) => <StatusBadge tone={row.failedRows > 0 ? "amber" : "green"}>{row.failedRows > 0 ? "Kontrol gerekli" : "Hazır"}</StatusBadge>
            },
            {
              header: "İşlem",
              cell: (row) => (
                <div className="flex min-w-0 flex-wrap justify-end gap-2">
                  <Link href={`/bank-statements/${row.id}/analysis`} className="secondary-action min-h-11 px-4 text-sm leading-none">
                    <BarChart3 className="h-4 w-4" aria-hidden />
                    Son 12 Ay
                  </Link>
                  <Link href={`/bank-statements/${row.id}/reconciliation`} className="secondary-action min-h-11 px-4 text-sm leading-none">
                    <SearchCheck className="h-4 w-4" aria-hidden />
                    Mutabakat
                  </Link>
                  <Link href={`/bank-statements/${row.id}`} className="secondary-action min-h-11 px-4 text-sm leading-none">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    Detay
                  </Link>
                </div>
              )
            }
          ]}
        />
      </section>

      <Pagination
        page={Math.min(pagination.page, pageCount)}
        totalPages={pageCount}
        totalItems={totalCount}
        pageSize={pagination.pageSize}
        hrefForPage={(page) => createPageHref("/bank-statements", { q: query }, page)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  icon: typeof FileSpreadsheet;
  tone?: "neutral" | "green" | "rose" | "amber";
}) {
  return (
    <article className="surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
      <p
        className={
          tone === "green"
            ? "mt-2 text-xl font-semibold text-emerald-700"
            : tone === "rose"
              ? "mt-2 text-xl font-semibold text-rose-700"
              : tone === "amber"
                ? "mt-2 text-xl font-semibold text-amber-700"
                : "mt-2 text-xl font-semibold text-slate-950"
        }
      >
        {value}
      </p>
    </article>
  );
}
