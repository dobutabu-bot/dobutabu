import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Landmark, Link2Off, Scale, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "@/components/app-link";

import { AmountText } from "@/components/amount-text";
import { BankRowActionPanel } from "@/components/bank-row-action-panel";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  AutoMatchButton,
  ManualReconciliationForm,
  ReconciliationActionButton
} from "@/components/reconciliation-actions";
import { StatusBadge } from "@/components/status-badge";
import type { getReconciliationData } from "@/lib/reconciliation/reconciliation-service";
import { cn, formatDate } from "@/lib/utils";

type ReconciliationData = Awaited<ReturnType<typeof getReconciliationData>>;

export function ReconciliationScreen({
  data,
  selectedImportId,
  page
}: {
  data: ReconciliationData;
  selectedImportId?: string | null;
  page: number;
}) {
  const basePath = selectedImportId ? `/bank-statements/${selectedImportId}/reconciliation` : "/reconciliation";

  return (
    <div className="w-full max-w-full min-w-0 space-y-5">
      <section className="surface-dark p-5">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">V3 Mutabakat Merkezi</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Banka - Dijital Kasa Mutabakatı</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Banka hareketlerini dijital kasa, tahsilat ve gider kayıtlarıyla karşılaştırın. Otomatik öneriler kalıcı işlem yapmaz; eşleştirme sadece onaydan sonra yazılır.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <AutoMatchButton />
            <a href="#manual-match" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              Manuel eşleştirme
            </a>
          </div>
        </div>

        {data.selectedImport ? (
          <div className="mt-5 min-w-0 rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200 [overflow-wrap:anywhere]">
            <span className="font-semibold text-white">{data.selectedImport.bankName}</span> · {data.selectedImport.originalFileName} ·{" "}
            {data.selectedImport.cashAccount?.name ?? "Kasa seçilmedi"}
          </div>
        ) : null}
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Banka Bakiyesi" value={<AmountText value={data.balances.bankBalance} currency={data.balances.currency} showSign size="md" variant="strong" />} icon={<Landmark className="h-4 w-4" aria-hidden />} />
        <Metric label="Sistem Kasa Bakiyesi" value={<AmountText value={data.balances.systemBalance} currency={data.balances.currency} showSign size="md" variant="strong" />} icon={<Scale className="h-4 w-4" aria-hidden />} />
        <Metric label="Fark" value={<AmountText value={data.balances.difference} currency={data.balances.currency} showSign size="md" variant="strong" />} icon={<SearchCheck className="h-4 w-4" aria-hidden />} tone={data.balances.tone} />
        <Metric label="Eşleşmiş Hareket" value={`${data.counts.matched} adet`} icon={<ShieldCheck className="h-4 w-4" aria-hidden />} tone="green" />
        <Metric label="Eşleşmemiş Banka" value={`${data.counts.unmatchedBank} adet`} icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} tone={data.counts.unmatchedBank > 0 ? "amber" : "green"} />
        <Metric label="Eşleşmemiş Sistem" value={`${data.counts.unmatchedSystem} adet`} icon={<ArrowDownRight className="h-4 w-4" aria-hidden />} tone={data.counts.unmatchedSystem > 0 ? "amber" : "green"} />
        <Metric label="Muhtemel Eşleşme" value={`${data.counts.suggestions} adet`} icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} tone={data.counts.suggestions > 0 ? "amber" : "neutral"} />
        <Metric label="Yoksayılan" value={`${data.counts.ignored} adet`} icon={<Link2Off className="h-4 w-4" aria-hidden />} />
      </section>

      {!selectedImportId && data.imports.length > 0 ? (
        <section className="surface min-w-0 p-4">
          <h2 className="text-sm font-semibold text-slate-950">Ekstre Seç</h2>
          <p className="mt-1 text-xs text-slate-500">Belirli bir ekstreden mutabakat yapmak için import seçebilirsiniz.</p>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <Link href="/reconciliation" className="secondary-action min-h-11 px-4 text-sm leading-none">
              Tüm ekstreler
            </Link>
            {data.imports.slice(0, 12).map((item) => (
              <Link key={item.id} href={`/bank-statements/${item.id}/reconciliation`} className="secondary-action min-h-11 px-4 text-sm leading-none">
                {item.bankName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section id="match-suggestions" className="surface p-4 scroll-mt-24">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Muhtemel Eşleşmeler</h2>
          <p className="mt-1 text-xs text-slate-500">Aynı tutar, yön, tarih toleransı, açıklama, müvekkil/dosya ve IBAN benzerliğiyle üretilen öneriler.</p>
        </div>
        {data.suggestions.length === 0 ? (
          <EmptyState title="Muhtemel eşleşme yok" description="Aynı tutar ve tarih toleransına uyan güvenli bir öneri bulunmadı." />
        ) : (
          <div className="grid min-w-0 gap-3">
            {data.suggestions.map((suggestion) => (
              <article key={`${suggestion.bankRowId}-${suggestion.systemEntryId}`} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                  <MovementBox
                    title="Banka hareketi"
                    date={suggestion.bankDate}
                    description={suggestion.bankDescription}
                    amount={suggestion.bankDirection === "OUT" ? -suggestion.bankAmount : suggestion.bankAmount}
                    currency={data.balances.currency}
                  />
                  <div className="flex items-center justify-center">
                    <StatusBadge tone={suggestion.confidence >= 0.9 ? "green" : suggestion.confidence >= 0.6 ? "amber" : "neutral"}>
                      {suggestion.confidenceLabel} %{Math.round(suggestion.confidence * 100)}
                    </StatusBadge>
                  </div>
                  <MovementBox
                    title="Sistem hareketi"
                    date={suggestion.systemDate}
                    description={suggestion.systemDescription}
                    amount={suggestion.systemDirection === "OUT" ? -suggestion.systemAmount : suggestion.systemAmount}
                    currency={data.balances.currency}
                  />
                </div>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="min-w-0 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
                    Tarih farkı: {suggestion.dateDiffDays} gün · {suggestion.reasons.join(", ")}
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <ReconciliationActionButton
                      endpoint="/api/reconciliation/match"
                      payload={{ bankRowId: suggestion.bankRowId, targetType: "LEDGER", targetId: suggestion.systemEntryId, matchMode: "AUTO_MATCHED" }}
                      label="Onayla"
                      variant="success"
                    />
                    <ReconciliationActionButton
                      endpoint="/api/reconciliation/ignore"
                      payload={{ bankRowId: suggestion.bankRowId }}
                      label="Reddet"
                      variant="danger"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="manual-match" className="surface p-4 scroll-mt-24">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Manuel Eşleştirme</h2>
          <p className="mt-1 text-xs text-slate-500">Otomatik öneri yoksa banka hareketini sistem kasa hareketiyle elle eşleştirin.</p>
        </div>
        <ManualReconciliationForm bankRows={data.manualOptions.bankRows} systemMovements={data.manualOptions.systemMovements} />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ListPanel title="Eşleşmemiş Banka Hareketleri" description="Bu hareketlerden tahsilat/gider oluşturabilir, mevcut kayıtla eşleştirebilir veya yoksayabilirsiniz.">
          <DataTable
            rows={data.unmatchedBankRows}
            empty="Eşleşmemiş banka hareketi yok"
            columns={[
              { header: "Tarih", cell: (row) => (row.date ? formatDate(row.date) : "-") },
              { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
              { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
              { header: "Kategori", cell: (row) => row.category },
              {
                header: "İşlem",
                cell: (row) => (
                  <BankRowActionPanel row={row} options={data.actionOptions} systemMovements={data.manualOptions.systemMovements} />
                )
              }
            ]}
          />
          <Pagination basePath={basePath} page={page} totalPages={data.pagination.totalPages} />
        </ListPanel>

        <ListPanel title="Eşleşmemiş Sistem Hareketleri" description="Bu dijital kasa hareketleri banka hareketiyle eşleşmemiş görünüyor.">
          <DataTable
            rows={data.unmatchedSystemMovements.slice(0, 25)}
            empty="Eşleşmemiş sistem hareketi yok"
            columns={[
              { header: "Tarih", cell: (row) => formatDate(row.date) },
              { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
              { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
              { header: "Tür", cell: (row) => row.entryType },
              { header: "Kasa", cell: (row) => row.cashAccountName }
            ]}
          />
        </ListPanel>
      </section>

      <section className="surface min-w-0 p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Eşleştirilmiş Hareketler</h2>
          <p className="mt-1 text-xs text-slate-500">Eşleşme kilitli kabul edilir; gerektiğinde bağlantı kaldırılabilir.</p>
        </div>
        <DataTable
          rows={data.matchedRows}
          empty="Henüz eşleşmiş hareket yok"
          columns={[
            { header: "Tarih", cell: (row) => (row.date ? formatDate(row.date) : "-") },
            { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
            { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
            { header: "Durum", cell: (row) => <StatusBadge tone="green">{matchTypeLabel(row.matchType)}</StatusBadge> },
            {
              header: "İşlem",
              cell: (row) => <ReconciliationActionButton endpoint="/api/reconciliation/unmatch" payload={{ bankRowId: row.id }} label="Bağlantıyı kaldır" />
            }
          ]}
        />
      </section>

      {data.ignoredRows.length > 0 ? (
        <section className="surface min-w-0 p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-950">Yoksayılan Hareketler</h2>
            <p className="mt-1 text-xs text-slate-500">Yanlışlıkla yoksayılan hareketleri buradan yeniden mutabakat listesine alabilirsiniz.</p>
          </div>
          <DataTable
            rows={data.ignoredRows}
            empty="Yoksayılan hareket yok"
            columns={[
              { header: "Tarih", cell: (row) => (row.date ? formatDate(row.date) : "-") },
              { header: "Açıklama", cell: (row) => <span className="line-clamp-2">{row.description}</span> },
              { header: "Tutar", cell: (row) => <AmountText value={row.signedAmount} currency={row.currency} showSign size="sm" variant="strong" /> },
              { header: "Durum", cell: () => <StatusBadge tone="neutral">Yoksayıldı</StatusBadge> },
              {
                header: "İşlem",
                cell: (row) => <BankRowActionPanel row={row} options={data.actionOptions} systemMovements={data.manualOptions.systemMovements} />
              }
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}

function matchTypeLabel(value: string) {
  if (value === "CREATED_FROM_BANK") return "Bankadan oluşturuldu";
  if (value === "AUTO_MATCHED") return "Öneri onaylandı";
  if (value === "MANUALLY_MATCHED") return "Manuel eşleşti";
  return "Eşleşti";
}

function Metric({
  label,
  value,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: "green" | "rose" | "amber" | "neutral";
}) {
  return (
    <article className="surface min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 break-words text-xs font-medium uppercase text-slate-500">{label}</p>
        <span className={toneClass(tone)}>{icon}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">{value}</div>
    </article>
  );
}

function MovementBox({
  title,
  date,
  description,
  amount,
  currency
}: {
  title: string;
  date: string | null;
  description: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{date ? formatDate(date) : "-"}</p>
      <p className="mt-2 line-clamp-2 min-w-0 break-words text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{description}</p>
      <div className="mt-2">
        <AmountText value={amount} currency={currency} showSign size="sm" variant="strong" />
      </div>
    </div>
  );
}

function ListPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="surface w-full max-w-full min-w-0 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Pagination({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <Link href={`${basePath}?page=${Math.max(1, page - 1)}`} className={cn("secondary-action min-h-[44px] px-4 text-sm leading-none", page <= 1 && "pointer-events-none opacity-50")}>
        Önceki
      </Link>
      <span className="text-sm font-medium text-slate-600">
        {page} / {totalPages}
      </span>
      <Link href={`${basePath}?page=${Math.min(totalPages, page + 1)}`} className={cn("secondary-action min-h-[44px] px-4 text-sm leading-none", page >= totalPages && "pointer-events-none opacity-50")}>
        Sonraki
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function toneClass(tone: "green" | "rose" | "amber" | "neutral") {
  if (tone === "green") return "text-emerald-600";
  if (tone === "rose") return "text-rose-600";
  if (tone === "amber") return "text-amber-600";
  return "text-slate-400";
}
