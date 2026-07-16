import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, FileText, Filter, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/app-link";

import { AmountText } from "@/components/amount-text";
import { BankRowActions } from "@/components/bank/bank-row-actions";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { LazyBankAnalysisCharts } from "@/components/lazy-bank-analysis-charts";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { StatusBadge } from "@/components/status-badge";
import type { getBankAnalysisScreenData } from "@/lib/bank-analysis/analyze-statement";
import { cn, formatDate, formatMoney } from "@/lib/utils";

type BankAnalysisData = Awaited<ReturnType<typeof getBankAnalysisScreenData>>;

type BankAnalysisScreenProps = {
  data: BankAnalysisData;
  selectedImportId?: string | null;
  page: number;
  searchParams: Record<string, string | undefined>;
};

export function BankAnalysisScreen({ data, selectedImportId, page, searchParams }: BankAnalysisScreenProps) {
  const basePath = selectedImportId ? `/bank-statements/${selectedImportId}/analysis` : "/bank-statements/analysis";
  const csvHref = buildHref("/api/bank-statements/analysis/export", { ...searchParams, importId: selectedImportId ?? searchParams.importId });
  const pdfHref = selectedImportId ? `/api/reports/bank-analysis/${selectedImportId}/pdf` : null;

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">V3 Akıllı Banka Analizi</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Son 1 Yıllık Banka Analizi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Banka hareketlerinden gelir, gider, düzenli ödeme, yüksek harcama, net nakit akışı ve mutabakat önerilerini çıkarır.
              Bu ekran yatırım tavsiyesi vermez; yalnızca sistem kayıtlarını sınıflandırır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/bank-statements/import" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              <Landmark className="h-4 w-4" aria-hidden />
              Ekstre Yükle
            </Link>
            <a href={csvHref} className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
            {pdfHref ? (
              <a href={pdfHref} className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
                <FileText className="h-4 w-4" aria-hidden />
                PDF
              </a>
            ) : null}
          </div>
        </div>

        {data.selectedImport ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200">
            <span className="font-semibold text-white">{data.selectedImport.bankName}</span> · {data.selectedImport.originalFileName} ·{" "}
            {formatDate(data.selectedImport.periodStart)} - {formatDate(data.selectedImport.periodEnd)}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Son 12 Ay Toplam Giriş" value={<AmountText value={data.summary.totalIn} currency={data.summary.currency} showSign size="md" variant="strong" />} icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} />
        <Metric label="Son 12 Ay Toplam Çıkış" value={<AmountText value={-data.summary.totalOut} currency={data.summary.currency} showSign size="md" variant="strong" />} icon={<ArrowDownRight className="h-4 w-4" aria-hidden />} />
        <Metric label="Son 12 Ay Net Nakit Akışı" value={<AmountText value={data.summary.netCashFlow} currency={data.summary.currency} showSign size="md" variant="strong" />} icon={<Scale className="h-4 w-4" aria-hidden />} />
        <Metric label="Ortalama Aylık Gelir" value={formatMoney(data.summary.averageMonthlyIncome, data.summary.currency)} icon={<TrendingUp className="h-4 w-4" aria-hidden />} />
        <Metric label="Ortalama Aylık Gider" value={formatMoney(data.summary.averageMonthlyExpense, data.summary.currency)} icon={<TrendingDown className="h-4 w-4" aria-hidden />} />
        <Metric label="En Yüksek Gider Ayı" value={`${data.summary.highestExpenseMonth.label} · ${formatMoney(data.summary.highestExpenseMonth.value, data.summary.currency)}`} icon={<ArrowDownRight className="h-4 w-4" aria-hidden />} />
        <Metric label="En Yüksek Gelir Ayı" value={`${data.summary.highestIncomeMonth.label} · ${formatMoney(data.summary.highestIncomeMonth.value, data.summary.currency)}`} icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} />
        <Metric label="Yüksek Güvenli Öneri" value={`${data.summary.highConfidenceSuggestions} kayıt`} icon={<Landmark className="h-4 w-4" aria-hidden />} />
      </section>

      <details className="surface group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Filtreler</h2>
              <p className="text-xs text-slate-500">Import, yön, kategori ve eşleşme durumuna göre daraltın.</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 group-open:hidden">Aç</span>
          <span className="hidden rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white group-open:inline">Kapat</span>
        </summary>
        <form action={basePath} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {!selectedImportId ? (
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">Ekstre</span>
              <select name="importId" defaultValue={searchParams.importId ?? ""} className="input min-h-11">
                <option value="">Tüm ekstreler</option>
                {data.imports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Yön</span>
            <select name="direction" defaultValue={searchParams.direction ?? "ALL"} className="input min-h-11">
              <option value="ALL">Tümü</option>
              <option value="IN">Giriş</option>
              <option value="OUT">Çıkış</option>
              <option value="NEUTRAL">Nötr</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Kategori</span>
            <select name="category" defaultValue={searchParams.category ?? ""} className="input min-h-11">
              <option value="">Tümü</option>
              {data.distributions.categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Eşleşme</span>
            <select name="match" defaultValue={searchParams.match ?? "ALL"} className="input min-h-11">
              <option value="ALL">Tümü</option>
              <option value="MATCHED">Eşleşmiş</option>
              <option value="SUGGESTED">Önerilen</option>
              <option value="UNMATCHED">Eşleşmeyen</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="primary-action min-h-11 flex-1" type="submit">
              Uygula
            </button>
            <Link href={basePath} className="secondary-action min-h-11">
              Sıfırla
            </Link>
          </div>
        </form>
      </details>

      <LazyBankAnalysisCharts data={data.charts} />

      <section className="surface p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Akıllı Bulgular</h2>
          <p className="mt-1 text-xs text-slate-500">Düşük güvenli öneriler otomatik kaydedilmez; aksiyon almadan önce kontrol edilmelidir.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.insights.map((insight) => (
            <article key={insight.title} className={cn("rounded-3xl border p-4", insightTone(insight.tone))}>
              <h3 className="text-sm font-semibold">{insight.title}</h3>
              <p className="mt-2 text-xs leading-5 opacity-80">{insight.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="surface p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Banka Hareketleri</h2>
            <p className="mt-1 text-xs text-slate-500">Kategori, confidence, eşleşme ve müvekkil/dosya önerileri. Büyük veri için sayfalama kullanılır.</p>
          </div>
          <StatusBadge tone="neutral">
            Sayfa {data.pagination.page}/{data.pagination.totalPages}
          </StatusBadge>
        </div>
        {data.rows.length === 0 ? (
          <EmptyState title="Filtreye uygun banka hareketi yok" description="Filtreleri gevşeterek tekrar deneyebilirsiniz." />
        ) : (
          <DataTable
            rows={data.rows}
            empty="Banka hareketi yok"
            columns={[
              { header: "Tarih", cell: (row) => (row.date ? formatDate(row.date) : "-") },
              { header: "Banka Hareketi", cell: (row) => <span className="line-clamp-2 min-w-56 text-sm">{row.description}</span> },
              {
                header: "Tutar",
                cell: (row) => <AmountText value={row.direction === "OUT" ? -row.amount : row.amount} currency={row.currency} showSign size="sm" variant="strong" />
              },
              { header: "Kategori", cell: (row) => row.category },
              {
                header: "Confidence",
                cell: (row) => <StatusBadge tone={row.confidence >= 0.78 ? "green" : row.confidence >= 0.6 ? "amber" : "neutral"}>%{Math.round(row.confidence * 100)}</StatusBadge>
              },
              {
                header: "Eşleşme",
                cell: (row) => (
                  <StatusBadge tone={row.matchStatus === "MATCHED" ? "green" : row.matchStatus === "SUGGESTED" ? "amber" : "neutral"}>
                    {row.matchStatus === "MATCHED" ? "Eşleşti" : row.matchStatus === "SUGGESTED" ? "Önerildi" : "Eşleşmedi"}
                  </StatusBadge>
                )
              },
              { header: "Müvekkil/Dosya", cell: (row) => `${row.clientSuggestionName ?? "-"} / ${row.caseFileSuggestionTitle ?? "-"}` },
              {
                header: "İşlem",
                cell: (row) => (
                  <BankRowActions
                    row={{
                      id: row.rowId,
                      date: row.date,
                      description: row.description,
                      direction: row.direction,
                      amount: row.amount,
                      currency: row.currency,
                      amountLabel: formatMoney(row.amount, row.currency),
                      signedAmount: row.direction === "OUT" ? -row.amount : row.amount,
                      category: row.category,
                      matchType: row.matchType,
                      cashAccountId: row.cashAccountId,
                      clientSuggestionId: row.clientSuggestionId,
                      caseFileSuggestionId: row.caseFileSuggestionId
                    }}
                    options={data.actionOptions}
                    systemMovements={data.systemMovements}
                  />
                )
              }
            ]}
          />
        )}
        <Pagination basePath={basePath} searchParams={searchParams} page={page} totalPages={data.pagination.totalPages} />
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <article className="surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <PrivacyAmount as="div" className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">
        {value}
      </PrivacyAmount>
    </article>
  );
}

function Pagination({
  basePath,
  searchParams,
  page,
  totalPages
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <Link
        href={buildHref(basePath, { ...searchParams, page: String(Math.max(1, page - 1)) })}
        className={cn("secondary-action min-h-[44px] px-4 text-sm leading-none", page <= 1 && "pointer-events-none opacity-50")}
      >
        Önceki
      </Link>
      <span className="text-sm font-medium text-slate-600">
        {page} / {totalPages}
      </span>
      <Link
        href={buildHref(basePath, { ...searchParams, page: String(Math.min(totalPages, page + 1)) })}
        className={cn("secondary-action min-h-[44px] px-4 text-sm leading-none", page >= totalPages && "pointer-events-none opacity-50")}
      >
        Sonraki
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function buildHref(path: string, params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "ALL") search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function insightTone(tone: "green" | "rose" | "amber" | "blue" | "neutral") {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-900";
  }
}
