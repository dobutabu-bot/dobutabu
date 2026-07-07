import {
  ArrowDownUp,
  Download,
  FileText,
  Filter,
  Info,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DataTable } from "@/components/data-table";
import { FinanceTicker } from "@/components/finance-ticker";
import { LazyReportAnalyticsCharts } from "@/components/lazy-report-analytics-charts";
import { MetricCard } from "@/components/metric-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildV3ReportsData, type V3Metric, type V3ReportsData, type V3SeriesPoint } from "@/lib/reports/v3-report-data";
import { serializeEntity } from "@/lib/serialization";
import {
  appendReportFilters,
  buildReportAnalytics,
  buildFinancialReport,
  normalizeReportFilters,
  reportRangeLabels,
  reportTypeLabels,
  type ReportFilters
} from "@/lib/reporting";

type ReportsPageProps = {
  searchParams: Promise<ReportFilters>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const [report, analytics, v3Reports, clients, cases] = await Promise.all([
    buildFinancialReport(user.id, filters),
    buildReportAnalytics(user.id, filters),
    buildV3ReportsData(user.id, filters),
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        client: { archivedAt: null, deletedAt: null }
      },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    })
  ]);
  const clientOptions = [
    { label: "Tüm müvekkiller", value: "" },
    ...clients.map((client) => ({ label: client.archivedAt ? `${client.name} (Arşiv)` : client.name, value: client.id }))
  ];
  const caseOptions = [
    { label: "Tüm dosyalar", value: "" },
    ...cases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
      value: caseFile.id
    }))
  ];
  const csvParams = new URLSearchParams({ resource: "reports", format: "csv" });
  const pdfParams = new URLSearchParams();
  appendReportFilters(csvParams, filters);
  appendReportFilters(pdfParams, filters);
  const csvHref = `/api/export?${csvParams.toString()}`;
  const monthlyPdfHref = `/api/reports/monthly/pdf?${pdfParams.toString()}`;
  const cashPdfHref = `/api/reports/cash/pdf?${pdfParams.toString()}`;
  const documentPdfHref = `/api/reports/documents/pdf?${pdfParams.toString()}`;
  const bankStatementPdfHref = `/api/reports/bank-statements/pdf?${pdfParams.toString()}`;
  const reconciliationPdfHref = `/api/reports/reconciliation/pdf?${pdfParams.toString()}`;
  const v3CsvHrefs = {
    documents: reportExportHref("v3Documents", filters),
    bankStatements: reportExportHref("v3BankStatements", filters),
    reconciliation: reportExportHref("v3Reconciliation", filters),
    capital: reportExportHref("v3Capital", filters)
  };
  const tickerItems = analytics.kpis.map((item) => ({
    label: item.label,
    value: item.value,
    tone: item.tone
  }));
  const safeTickerItems = serializeEntity(tickerItems) as typeof tickerItems;
  const safeAnalytics = serializeEntity(analytics) as typeof analytics;
  const analysisTables = [
    {
      title: "Kasa Raporu",
      description: "Hesap bazlı bakiye, giriş/çıkış ve dönem neti",
      rows: analytics.tables.cashAccounts,
      headers: ["Kasa Hesabı", "Güncel Bakiye", "Giriş", "Çıkış", "Net", "Hareket"],
      empty: "Seçilen aralıkta kasa hareketi yok"
    },
    {
      title: "Kasa Transferleri",
      description: "Transferler ayrı izlenir; tahsilat/gider toplamlarını şişirmez",
      rows: analytics.tables.cashTransfers,
      headers: ["Tarih", "Kasa", "Yön", "Açıklama", "Tutar"],
      empty: "Seçilen aralıkta kasa transferi yok"
    },
    {
      title: "Müvekkil Kârlılık Raporu",
      description: "Tahsilat, gider, yansıtılabilir gider, net durum ve açık bakiye",
      rows: analytics.tables.clientProfitability,
      headers: ["Müvekkil", "Toplam Tahsilat", "Toplam Gider", "Yansıtılabilir Gider", "Net Durum", "Açık Bakiye"],
      empty: "Seçilen aralıkta müvekkil kârlılık verisi yok"
    },
    {
      title: "Dosya Finans Raporu",
      description: "Dosya bazında tahsilat, gider, masraf, net ve son işlem tarihi",
      rows: analytics.tables.caseFinancials,
      headers: ["Müvekkil", "Dosya", "Tahsilat", "Gider", "Masraf", "Net", "Son İşlem"],
      empty: "Seçilen aralıkta dosya finans verisi yok"
    },
    {
      title: "Son Tahsilatlar",
      description: "Seçilen dönemdeki en güncel nakit girişleri",
      rows: analytics.tables.recentIncomes,
      headers: ["Tarih", "Müvekkil", "Dosya", "Kategori", "Tutar"],
      empty: "Seçilen aralıkta tahsilat yok"
    },
    {
      title: "Son Giderler",
      description: "Seçilen dönemdeki en güncel gider hareketleri",
      rows: analytics.tables.recentExpenses,
      headers: ["Tarih", "Müvekkil", "Dosya", "Kategori", "Tutar"],
      empty: "Seçilen aralıkta gider yok"
    },
    {
      title: "En Yüksek Gider Kalemleri",
      description: "Nakit çıkışını büyüten ana kalemler",
      rows: analytics.tables.topExpenses,
      headers: ["Tarih", "Kalem", "Kategori", "Kapsam", "Tutar"],
      empty: "Seçilen aralıkta gider kalemi yok"
    },
    {
      title: "En Çok Gelir Getiren Müvekkiller",
      description: "Tahsilat performansına göre müvekkil sıralaması",
      rows: analytics.tables.topIncomeClients,
      headers: ["Müvekkil", "Tahsilat", "Kayıt", "Son Tahsilat"],
      empty: "Seçilen aralıkta müvekkil tahsilatı yok"
    },
    {
      title: "Yaklaşan Gider Hatırlatmaları",
      description: "Önümüzdeki 30 gün içinde vadesi gelecek açık giderler",
      rows: analytics.tables.upcomingExpenseReminders,
      headers: ["Vade", "Başlık", "Müvekkil", "Dosya", "Öncelik", "Tutar"],
      empty: "Yaklaşan gider hatırlatması yok"
    },
    {
      title: "Geciken Hatırlatmalar",
      description: "Vadesi geçmiş açık hatırlatmalar",
      rows: analytics.tables.overdueReminders,
      headers: ["Vade", "Başlık", "Tür", "Müvekkil", "Dosya", "Öncelik", "Tutar"],
      empty: "Geciken hatırlatma yok"
    }
  ];

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase text-slate-400">Raporlar V2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-5xl">Finans Analiz Merkezi</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Dijital kasa, gelir/gider, müvekkil, dosya ve nakit akışı analizlerini tek premium panelde okuyun.
            </p>
          </div>
          <div className="digital-glass p-4 lg:min-w-80">
            <p className="text-xs font-medium uppercase text-slate-400">Aktif Aralık</p>
            <p className="mt-2 text-sm font-semibold text-white">{analytics.rangeLabel}</p>
            <Link href={csvHref} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
              <Download className="h-4 w-4" aria-hidden />
              Rapor tablosunu CSV indir
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.07] bg-black/[0.08]">
          <FinanceTicker items={safeTickerItems} />
        </div>
      </section>

      <section className="surface p-4">
        <details className="group" open>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-3 text-sm font-semibold text-slate-950 marker:hidden">
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4" aria-hidden />
              Rapor filtreleri
            </span>
            <span className="text-xs font-medium text-slate-500 group-open:hidden">Aç</span>
            <span className="hidden text-xs font-medium text-slate-500 group-open:inline">Kapat</span>
          </summary>

          <div className="scroll-x-stable mt-4 flex gap-2 pb-1">
            {Object.entries(reportRangeLabels).map(([value, label]) => (
              <Link
                key={value}
                href={rangeHref(value, filters)}
                className={[
                  "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition",
                  filters.range === value
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                    : "border-white/70 bg-white/80 text-slate-700 hover:bg-white"
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </div>

        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr_1fr_auto]" action="/reports">
          <label className="space-y-1">
            <span className="label">Rapor Türü</span>
            <select className="field" name="type" defaultValue={filters.type}>
              {Object.entries(reportTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Tarih Aralığı</span>
            <select className="field" name="range" defaultValue={filters.range}>
              {Object.entries(reportRangeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Başlangıç Tarihi</span>
            <input className="field" type="date" name="startDate" defaultValue={filters.startDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Bitiş Tarihi</span>
            <input className="field" type="date" name="endDate" defaultValue={filters.endDate} />
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="primary-action h-11 flex-1 xl:flex-none"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link
              href="/reports"
              className="secondary-action h-11 flex-1 xl:flex-none"
            >
              Temizle
            </Link>
          </div>
          <label className="space-y-1">
            <span className="label">Müvekkil</span>
            <select className="field" name="clientId" defaultValue={filters.clientId}>
              {clientOptions.map((option) => (
                <option key={option.value || "all-clients"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2 xl:col-span-3">
            <span className="label">Dosya</span>
            <select className="field" name="caseFileId" defaultValue={filters.caseFileId}>
              {caseOptions.map((option) => (
                <option key={option.value || "all-cases"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>
        </details>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {analytics.kpis.map((item, index) => (
          <MetricCard
            key={item.label}
            title={item.label}
            value={item.value}
            detail={item.detail}
            icon={kpiIcon(index)}
            tone={item.tone}
          />
        ))}
      </section>

      <section className="surface flex flex-col gap-3 p-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <p>PDF çıktıları server-side üretilir ve yalnızca oturumdaki kullanıcının verilerini içerir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={monthlyPdfHref} className="secondary-action min-h-10 px-3">
            <Download className="h-4 w-4" aria-hidden />
            Aylık PDF
          </Link>
          <Link href={cashPdfHref} className="secondary-action min-h-10 px-3">
            <Download className="h-4 w-4" aria-hidden />
            Kasa PDF
          </Link>
          <Link href="/api/reports/capital/pdf" className="secondary-action min-h-10 px-3">
            <Download className="h-4 w-4" aria-hidden />
            Sermaye PDF
          </Link>
        </div>
      </section>

      <ReportsV3Center
        data={v3Reports}
        documentPdfHref={documentPdfHref}
        bankStatementPdfHref={bankStatementPdfHref}
        reconciliationPdfHref={reconciliationPdfHref}
        capitalPdfHref="/api/reports/capital/pdf"
        csvHrefs={v3CsvHrefs}
      />

      <LazyReportAnalyticsCharts analytics={safeAnalytics} />

      <section className="grid gap-4 xl:grid-cols-2">
        {analysisTables.map((table) => (
          <section key={table.title} className="min-w-0 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{table.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{table.description}</p>
            </div>
            <DataTable<Record<string, string>>
              rows={table.rows}
              empty={table.empty}
              columns={table.headers.map((header) => ({
                header,
                cell: (row) => row[header] ?? "",
                className:
                  header === "Tutar" ||
                  header === "Tahsilat" ||
                  header === "Giriş" ||
                  header === "Çıkış" ||
                  header === "Net" ||
                  header === "Net Durum" ||
                  header === "Açık Bakiye" ||
                  header === "Güncel Bakiye"
                    ? "font-medium text-slate-950"
                    : undefined
              }))}
            />
          </section>
        ))}
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{report.title}</h2>
            <p className="mt-1 text-xs text-slate-500">Mevcut rapor tablosu ve CSV export çıktısı</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{report.rows.length} satır</span>
            <Link href={csvHref} className="secondary-action min-h-10 px-3">
              <Download className="h-4 w-4" aria-hidden />
              CSV indir
            </Link>
            <Link href={monthlyPdfHref} className="secondary-action min-h-10 px-3">
              <Download className="h-4 w-4" aria-hidden />
              PDF indir
            </Link>
          </div>
        </div>
        <DataTable<Record<string, string>>
          rows={report.rows}
          empty={report.empty}
          columns={report.headers.map((header) => ({
            header,
            cell: (row) => row[header] ?? "",
            className: header === "Net" || header === "Bakiye" ? "font-medium text-slate-950" : undefined
          }))}
        />
      </section>
    </div>
  );
}

function ReportsV3Center({
  data,
  documentPdfHref,
  bankStatementPdfHref,
  reconciliationPdfHref,
  capitalPdfHref,
  csvHrefs
}: {
  data: V3ReportsData;
  documentPdfHref: string;
  bankStatementPdfHref: string;
  reconciliationPdfHref: string;
  capitalPdfHref: string;
  csvHrefs: {
    documents: string;
    bankStatements: string;
    reconciliation: string;
    capital: string;
  };
}) {
  return (
    <section className="space-y-4">
      <section className="surface-dark overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Raporlar V3</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Akıllı finans, belge ve sermaye raporları</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Belge merkezi, banka ekstresi analizi, mutabakat ve sermaye verileri grafik odaklı özetlerle okunur. Silinen kayıtlar, duplicate banka satırları ve gelir/gideri şişiren transferler rapora dahil edilmez.
            </p>
          </div>
          <div className="digital-row-soft px-3 py-2 text-xs text-slate-300">
            PDF çıktıları satır limitli ve private route üzerinden üretilir.
          </div>
        </div>
      </section>

      <ReportsV3Tabs data={data} />

      <V3ReportBlock
        sectionId="v3-documents"
        title="Belge Raporu"
        description="Yüklenen belgeler, bağlı/bağsız durum, belge türleri ve belgesiz finans kayıtları"
        icon={<FileText className="h-5 w-5" aria-hidden />}
        metrics={data.documentReport.metrics}
        series={[
          { title: "Belge türlerine göre dağılım", data: data.documentReport.documentTypeDistribution },
          { title: "Bağlantı durumu", data: data.documentReport.linkDistribution }
        ]}
        tables={data.documentReport.tables}
        pdfHref={documentPdfHref}
        csvHref={csvHrefs.documents}
      />

      <V3ReportBlock
        sectionId="v3-bank"
        title="Banka Ekstresi Analiz Raporu"
        description="Son 12 ay giriş/çıkış, kategori dağılımı, düzenli ödemeler, yüksek tutarlı işlemler ve eşleşmeyen hareketler"
        icon={<Landmark className="h-5 w-5" aria-hidden />}
        metrics={data.bankStatementReport.metrics}
        series={[
          { title: "Gelir kaynak dağılımı", data: data.bankStatementReport.incomeDistribution },
          { title: "Gider kategori dağılımı", data: data.bankStatementReport.expenseDistribution }
        ]}
        timeline={data.bankStatementReport.monthlyCashFlow}
        tables={data.bankStatementReport.tables}
        pdfHref={bankStatementPdfHref}
        csvHref={csvHrefs.bankStatements}
      />

      <V3ReportBlock
        sectionId="v3-reconciliation"
        title="Mutabakat Raporu"
        description="Banka bakiyesi, sistem bakiyesi, fark, eşleşmiş/eşleşmemiş hareketler ve önerilen aksiyonlar"
        icon={<Scale className="h-5 w-5" aria-hidden />}
        metrics={data.reconciliationReport.metrics}
        suggestedActions={data.reconciliationReport.suggestedActions}
        tables={data.reconciliationReport.tables}
        pdfHref={reconciliationPdfHref}
        csvHref={csvHrefs.reconciliation}
      />

      <V3ReportBlock
        sectionId="v3-capital"
        title="Sermaye Raporu"
        description="Toplam varlık, toplam borç, net sermaye, varlık dağılımı ve değer geçmişi"
        icon={<WalletCards className="h-5 w-5" aria-hidden />}
        metrics={data.capitalReport.metrics}
        series={[
          { title: "Varlık dağılımı", data: data.capitalReport.assetDistribution },
          { title: "Para birimi dağılımı", data: data.capitalReport.currencyDistribution }
        ]}
        tables={data.capitalReport.tables}
        pdfHref={capitalPdfHref}
        csvHref={csvHrefs.capital}
      />
    </section>
  );
}

function ReportsV3Tabs({ data }: { data: V3ReportsData }) {
  const items = [
    {
      href: "#v3-documents",
      label: "Belge",
      value: metricValue(data.documentReport.metrics, "Yüklenen Belge"),
      detail: metricValue(data.documentReport.metrics, "Bağsız Belge", "0") + " bağsız",
      icon: <FileText className="h-4 w-4" aria-hidden />,
      tone: metricTone(data.documentReport.metrics, "Bağsız Belge")
    },
    {
      href: "#v3-bank",
      label: "Banka",
      value: metricValue(data.bankStatementReport.metrics, "Net Nakit Akışı"),
      detail: metricValue(data.bankStatementReport.metrics, "Eşleşmeyen", "0 kayıt"),
      icon: <Landmark className="h-4 w-4" aria-hidden />,
      tone: metricTone(data.bankStatementReport.metrics, "Net Nakit Akışı")
    },
    {
      href: "#v3-reconciliation",
      label: "Mutabakat",
      value: metricValue(data.reconciliationReport.metrics, "Fark", "-"),
      detail: metricValue(data.reconciliationReport.metrics, "Eşleşmeyen", "0 kayıt"),
      icon: <Scale className="h-4 w-4" aria-hidden />,
      tone: data.reconciliationReport.statusTone
    },
    {
      href: "#v3-capital",
      label: "Sermaye",
      value: metricValue(data.capitalReport.metrics, "Net Sermaye"),
      detail: metricValue(data.capitalReport.metrics, "Toplam Borç", "₺0,00") + " borç",
      icon: <WalletCards className="h-4 w-4" aria-hidden />,
      tone: metricTone(data.capitalReport.metrics, "Net Sermaye")
    }
  ];

  return (
    <section className="surface p-3">
      <div className="scroll-x-stable flex gap-3 pb-1" aria-label="V3 rapor sekmeleri">
        {items.map((item) => {
          const tone = v3Tone(item.tone);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-24 w-64 shrink-0 flex-col justify-between rounded-3xl border border-slate-200 bg-white/78 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-950 text-white">{item.icon}</span>
                  {item.label}
                </span>
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden />
              </span>
              <span>
                <span className={`block truncate text-xl font-semibold tabular-nums ${tone.text}`}>{item.value}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{item.detail}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function V3ReportBlock({
  sectionId,
  title,
  description,
  icon,
  metrics,
  series = [],
  timeline,
  suggestedActions = [],
  tables,
  pdfHref,
  csvHref
}: {
  sectionId?: string;
  title: string;
  description: string;
  icon: ReactNode;
  metrics: V3Metric[];
  series?: { title: string; data: V3SeriesPoint[] }[];
  timeline?: { label: string; tahsilat: number; gider: number; net: number }[];
  suggestedActions?: string[];
  tables: V3ReportsData["documentReport"]["tables"];
  pdfHref: string;
  csvHref: string;
}) {
  return (
    <section id={sectionId} className="surface scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_36px_rgba(15,23,42,0.14)]">
            {icon}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={csvHref} className="secondary-action min-h-10 px-3">
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </Link>
          <Link href={pdfHref} className="primary-action min-h-10 px-3">
            <Download className="h-4 w-4" aria-hidden />
            PDF
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <V3MetricCard key={`${title}-${metric.label}`} metric={metric} />
          ))}
        </div>

        <div className="grid gap-4">
          {timeline ? <MonthlyCashFlowBars data={timeline} /> : null}
          {series.map((item) => (
            <DistributionBars key={`${title}-${item.title}`} title={item.title} data={item.data} />
          ))}
          {suggestedActions.length > 0 ? <SuggestedActions actions={suggestedActions} /> : null}
          {!timeline && series.length === 0 && suggestedActions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm text-slate-500">
              Bu raporda grafik verisi henüz oluşmadı.
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200/70 p-4 xl:grid-cols-2">
        {tables.map((table) => (
          <section key={`${title}-${table.title}`} className="min-w-0 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">{table.title}</h4>
              <p className="mt-1 text-xs text-slate-500">{table.description}</p>
            </div>
            <DataTable<Record<string, string>>
              rows={table.rows}
              empty={table.empty}
              columns={table.headers.map((header) => ({
                header,
                cell: (row) => row[header] ?? "",
                className: isMoneyHeader(header) ? "font-medium text-slate-950 tabular-nums" : undefined
              }))}
            />
          </section>
        ))}
      </div>
    </section>
  );
}

function metricValue(metrics: V3Metric[], label: string, fallback = "-") {
  return metrics.find((metric) => metric.label === label)?.value ?? fallback;
}

function metricTone(metrics: V3Metric[], label: string) {
  return metrics.find((metric) => metric.label === label)?.tone ?? "neutral";
}

function V3MetricCard({ metric }: { metric: V3Metric }) {
  const tone = v3Tone(metric.tone);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      </div>
      <p className={`mt-3 truncate text-2xl font-semibold tabular-nums ${tone.text}`}>{metric.value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{metric.detail}</p>
    </div>
  );
}

function DistributionBars({ title, data }: { title: string; data: V3SeriesPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm text-slate-500">
        {title} için veri yok.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/78 p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <div className="mt-4 space-y-3">
        {data.map((item) => {
          const tone = v3Tone(item.tone ?? "blue");
          return (
            <div key={`${title}-${item.label}`}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-slate-700">{item.label}</span>
                <span className="shrink-0 text-slate-500">{item.valueLabel}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(4, Math.min(item.percent, 100))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyCashFlowBars({ data }: { data: { label: string; tahsilat: number; gider: number; net: number }[] }) {
  const max = Math.max(...data.flatMap((item) => [item.tahsilat, item.gider]).map(Math.abs), 1);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/78 p-4">
      <h4 className="text-sm font-semibold text-slate-950">Son 12 ay giriş/çıkış</h4>
      <div className="scroll-x-stable mt-4 flex min-h-48 items-end gap-2 pb-1">
        {data.map((item) => (
          <div key={item.label} className="flex w-14 shrink-0 flex-col items-center justify-end gap-1">
            <div className="flex h-32 items-end gap-1">
              <span className="w-4 rounded-t-lg bg-emerald-500" style={{ height: `${Math.max(4, (item.tahsilat / max) * 128)}px` }} title={`Giriş ${item.tahsilat}`} />
              <span className="w-4 rounded-t-lg bg-rose-500" style={{ height: `${Math.max(4, (item.gider / max) * 128)}px` }} title={`Çıkış ${item.gider}`} />
            </div>
            <span className="text-[11px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestedActions({ actions }: { actions: string[] }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
      <h4 className="text-sm font-semibold text-amber-950">Önerilen aksiyonlar</h4>
      <div className="mt-3 space-y-2">
        {actions.map((action) => (
          <p key={action} className="rounded-2xl bg-white/65 px-3 py-2 text-xs leading-5 text-amber-900">
            {action}
          </p>
        ))}
      </div>
    </div>
  );
}

function v3Tone(tone: V3Metric["tone"]) {
  const tones = {
    neutral: { text: "text-slate-950", dot: "bg-slate-400", bar: "bg-slate-800" },
    green: { text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500" },
    rose: { text: "text-rose-700", dot: "bg-rose-500", bar: "bg-rose-500" },
    amber: { text: "text-amber-800", dot: "bg-amber-500", bar: "bg-amber-500" },
    blue: { text: "text-sky-700", dot: "bg-sky-500", bar: "bg-sky-500" }
  };
  return tones[tone];
}

function isMoneyHeader(header: string) {
  return ["Tutar", "Toplam", "Ortalama", "Giriş", "Çıkış", "Net", "Fark", "Toplam Değer"].includes(header);
}

function kpiIcon(index: number) {
  const icons = [
    TrendingUp,
    TrendingDown,
    ArrowDownUp,
    PiggyBank,
    ReceiptText,
    WalletCards,
    Landmark,
    FileText
  ];
  return icons[index] ?? FileText;
}

function rangeHref(range: string, filters: ReturnType<typeof normalizeReportFilters>) {
  const params = new URLSearchParams();
  params.set("type", filters.type);
  params.set("range", range);

  if (range === "custom") {
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
  }

  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.caseFileId) params.set("caseFileId", filters.caseFileId);

  return `/reports?${params.toString()}`;
}

function reportExportHref(resource: string, filters: ReturnType<typeof normalizeReportFilters>) {
  const params = new URLSearchParams({ resource, format: "csv" });
  appendReportFilters(params, filters);
  return `/api/export?${params.toString()}`;
}
