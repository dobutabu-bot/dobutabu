import { Download, History, LineChart, TrendingUp } from "lucide-react";
import Link from "next/link";

import { AmountText } from "@/components/amount-text";
import { CapitalSnapshotButton } from "@/components/capital-snapshot-button";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FinanceChartPanel, HorizontalBarChart, MiniLineChart } from "@/components/finance-charts";
import { MetricCard } from "@/components/metric-card";
import type { getCapitalCenterData } from "@/lib/capital/capital-data";
import { assetValuationSourceLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";

type CapitalCenterData = Awaited<ReturnType<typeof getCapitalCenterData>>;

export function CapitalHistoryScreen({ data }: { data: CapitalCenterData }) {
  return (
    <div className="space-y-5">
      <section className="surface-dark p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Sermaye Geçmişi</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Varlık Değer Geçmişi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Manuel değer güncellemeleri, snapshot kayıtları ve net sermaye değişimini takip edin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CapitalSnapshotButton currency={data.currency} />
            <Link href="/capital" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              Sermaye merkezi
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Net Sermaye" value={data.summary.netWorthLabel} detail="Son hesaplanan durum" icon={TrendingUp} tone={data.summary.netWorth >= 0 ? "green" : "rose"} />
        <MetricCard title="Değerleme Kaydı" value={`${data.latestValuations.length} adet`} detail="Son 200 kayıt listelenir" icon={History} />
        <MetricCard title="Snapshot Trend" value={`${data.netWorthTrend.length} nokta`} detail="Sermaye snapshot kayıtları" icon={LineChart} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <FinanceChartPanel title="Net Sermaye Trendi" description="Snapshot kayıtlarına göre net sermaye çizgisi." badge="TREND">
          <MiniLineChart data={data.netWorthTrend} series={[{ dataKey: "value", name: "Net sermaye", tone: "net", strokeWidth: 3 }]} size="md" />
        </FinanceChartPanel>
        <FinanceChartPanel title="Aylık Sermaye Değişimi" description="Snapshotlar arasındaki net değişim." badge="AYLIK">
          <HorizontalBarChart data={data.monthlyChange} dataKeyName="Değişim" tone="balance" size="md" />
        </FinanceChartPanel>
      </section>

      <section className="surface p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Değerleme Geçmişi</h2>
            <p className="mt-1 text-xs text-slate-500">Manuel değer güncellemeleri ve ileride import/sistem kaynaklı kayıtlar burada izlenir.</p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Link href="/api/export?resource=assetValuations&format=csv" className="secondary-action min-h-[44px] px-4 text-sm leading-none">
              <Download className="h-4 w-4" aria-hidden />
              CSV indir
            </Link>
            <Link href="/api/reports/capital/pdf" className="secondary-action min-h-[44px] px-4 text-sm leading-none">
              <Download className="h-4 w-4" aria-hidden />
              PDF indir
            </Link>
          </div>
        </div>
        {data.latestValuations.length === 0 ? (
          <EmptyState title="Değerleme geçmişi yok" description="Varlık kartlarından değer güncellemesi yaptığınızda geçmiş burada görünür." />
        ) : (
          <DataTable
            rows={data.latestValuations}
            empty="Değerleme kaydı bulunamadı"
            columns={[
              { header: "Tarih", cell: (row) => row.valuationDateLabel },
              { header: "Varlık", cell: (row) => row.assetName },
              { header: "Tür", cell: (row) => row.assetTypeLabel },
              { header: "Miktar", cell: (row) => row.quantity?.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) ?? "-" },
              { header: "Birim Fiyat", cell: (row) => (row.unitPrice != null ? formatMoney(row.unitPrice, row.valuationCurrency) : "-") },
              { header: "Toplam", cell: (row) => <AmountText value={row.totalValue} currency={row.valuationCurrency} showSign={false} size="sm" variant="strong" /> },
              { header: "Kaynak", cell: (row) => assetValuationSourceLabels[row.source] },
              { header: "Not", cell: (row) => row.note || "-" }
            ]}
          />
        )}
      </section>
    </div>
  );
}
