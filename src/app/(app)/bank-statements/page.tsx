import { ArrowRight, BarChart3, FileSpreadsheet, Landmark, SearchCheck, Upload } from "lucide-react";
import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function BankStatementsPage() {
  const user = await requireUser();
  const imports = await prisma.bankStatementImport.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      cashAccount: { select: { name: true } },
      document: { select: { id: true } },
      _count: { select: { rows: true } }
    },
    take: 100
  });
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
      <section className="surface-dark flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">V3 Akıllı Finans</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Banka Ekstreleri</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Banka hareketlerini içe aktarın, sistemdeki kasa hareketleriyle karşılaştırın ve eşleşme önerilerini görün.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-statements/analysis" className="secondary-action min-h-12 border-white/15 bg-white/10 text-white hover:bg-white/15">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Son 12 Ay Analizi
          </Link>
          <Link href="/bank-statements/import" className="primary-action min-h-12">
            <Upload className="h-4 w-4" aria-hidden />
            Ekstre Yükle
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="İçe Aktarım" value={String(imports.length)} icon={Landmark} />
        <SummaryCard label="Toplam Satır" value={String(totals.total)} icon={FileSpreadsheet} />
        <SummaryCard label="Başarılı Satır" value={String(totals.success)} tone="green" icon={FileSpreadsheet} />
        <SummaryCard label="Duplicate / Hatalı" value={`${totals.duplicate} / ${totals.failed}`} tone={totals.failed > 0 ? "rose" : "amber"} icon={FileSpreadsheet} />
      </section>

      <section className="surface p-4">
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
            { header: "Dosya", cell: (row) => row.originalFileName },
            { header: "Tür", cell: (row) => row.sourceType },
            { header: "Kasa", cell: (row) => row.cashAccount?.name ?? "-" },
            { header: "Dönem", cell: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}` },
            { header: "Satır", cell: (row) => `${row.successfulRows}/${row.totalRows}` },
            { header: "Duplicate", cell: (row) => String(row.duplicateRows) },
            { header: "Kapanış", cell: (row) => (row.closingBalance ? formatMoney(row.closingBalance, row.currency) : "-") },
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
