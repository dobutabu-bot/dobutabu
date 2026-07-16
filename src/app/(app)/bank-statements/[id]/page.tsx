import { ArrowDownRight, ArrowUpRight, BarChart3, Download, FileText, Landmark, Repeat, Scale, SearchCheck, Sparkles } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { AmountText } from "@/components/amount-text";
import { DataTable } from "@/components/data-table";
import { DetailActivityLog } from "@/components/detail-activity-log";
import { DetailBreadcrumb, DetailHero, DetailTabs } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getStatementAnalysis } from "@/lib/bank-analysis/analyze-statement";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toNumber } from "@/lib/utils";

type BankStatementDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BankStatementDetailPage({ params }: BankStatementDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const bankImport = await prisma.bankStatementImport.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      cashAccount: { select: { name: true, currency: true } },
      document: { select: { id: true } },
      rows: {
        where: { deletedAt: null },
        orderBy: { rowNumber: "asc" },
        include: {
          clientSuggestion: { select: { name: true } },
          caseFileSuggestion: { select: { title: true, fileNumber: true } },
          matchedCashLedgerEntry: { select: { id: true, description: true } }
        },
        take: 500
      }
    }
  });

  if (!bankImport) {
    notFound();
  }

  const analysis = await getStatementAnalysis(bankImport.id, user.id);
  const cashIn = analysis.summary.totalIn;
  const cashOut = analysis.summary.totalOut;
  const net = analysis.summary.netCashFlow;

  return (
    <div className="space-y-5">
      <DetailBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Banka Ekstreleri", href: "/bank-statements" }, { label: bankImport.bankName }]} />
      <DetailHero
        eyebrow="Banka Ekstresi Analizi"
        title={bankImport.bankName}
        description={`${bankImport.originalFileName} · ${bankImport.cashAccount?.name ?? "Kasa hesabı seçilmedi"} · ${formatDate(bankImport.periodStart)} - ${formatDate(bankImport.periodEnd)}`}
        status={<StatusBadge tone={bankImport.failedRows > 0 ? "amber" : "green"}>{bankImport.failedRows > 0 ? "Kontrol gerekli" : "Hazır"}</StatusBadge>}
        actions={
          <>
          {bankImport.document ? (
            <a href={`/api/documents/${bankImport.document.id}/download`} className="secondary-action min-h-11 px-4 text-sm leading-none">
              <Download className="h-4 w-4" aria-hidden />
              Orijinal Dosya
            </a>
          ) : null}
          <a href={`/api/reports/bank-analysis/${bankImport.id}/pdf`} className="secondary-action min-h-11 px-4 text-sm leading-none">
            <FileText className="h-4 w-4" aria-hidden />
            PDF Analiz
          </a>
          <Link href={`/bank-statements/${bankImport.id}/analysis`} className="secondary-action min-h-11 px-4 text-sm leading-none">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Son 12 Ay
          </Link>
          <Link href={`/bank-statements/${bankImport.id}/reconciliation`} className="secondary-action min-h-11 px-4 text-sm leading-none">
            <SearchCheck className="h-4 w-4" aria-hidden />
            Mutabakat
          </Link>
          </>
        }
      />
      <DetailTabs />

      <section id="overview" className="grid scroll-mt-24 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Toplam Giriş" value={<AmountText value={cashIn} currency={bankImport.currency} showSign size="md" variant="strong" />} />
        <SummaryCard label="Toplam Çıkış" value={<AmountText value={-cashOut} currency={bankImport.currency} showSign size="md" variant="strong" />} />
        <SummaryCard label="Net Akış" value={<AmountText value={net} currency={bankImport.currency} showSign size="md" variant="strong" />} />
        <SummaryCard label="Kapanış Bakiyesi" value={bankImport.closingBalance ? formatMoney(bankImport.closingBalance, bankImport.currency) : "-"} />
        <SummaryCard label="Toplam Satır" value={String(bankImport.totalRows)} />
        <SummaryCard label="Başarılı" value={String(bankImport.successfulRows)} />
        <SummaryCard label="Hatalı" value={String(bankImport.failedRows)} />
        <SummaryCard label="Duplicate" value={String(bankImport.duplicateRows)} />
      </section>

      {bankImport.notes ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">{bankImport.notes}</section>
      ) : null}

      <section id="finance" className="surface-dark scroll-mt-24 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden />
              <h2 className="text-lg font-semibold text-white">Akıllı Finans Analizi</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Son 1 yıllık nakit akışı, kategori dağılımı, düzenli işlemler, yüksek tutarlı hareketler ve mutabakat önerileri.
              Bu ekran yatırım tavsiyesi vermez; yalnızca kayıt sınıflandırması ve eşleştirme önerisi üretir.
            </p>
          </div>
          <StatusBadge tone={analysis.ledgerMatches.suggestedMatches.length > 0 ? "amber" : "green"}>
            {analysis.ledgerMatches.suggestedMatches.length > 0 ? "Eşleşme önerisi var" : "Mutabakat sakin"}
          </StatusBadge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DarkInsightCard
            icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
            label="Son 12 Ay Giriş"
            value={<AmountText value={analysis.last12Months.totals.income} currency={bankImport.currency} showSign size="sm" variant="strong" />}
          />
          <DarkInsightCard
            icon={<ArrowDownRight className="h-4 w-4" aria-hidden />}
            label="Son 12 Ay Çıkış"
            value={<AmountText value={-analysis.last12Months.totals.expense} currency={bankImport.currency} showSign size="sm" variant="strong" />}
          />
          <DarkInsightCard
            icon={<Scale className="h-4 w-4" aria-hidden />}
            label="Net Nakit Akışı"
            value={<AmountText value={analysis.last12Months.totals.net} currency={bankImport.currency} showSign size="sm" variant="strong" />}
          />
          <DarkInsightCard
            icon={<Repeat className="h-4 w-4" aria-hidden />}
            label="Düzenli İşlem"
            value={`${analysis.recurring.income.length + analysis.recurring.expense.length} adet`}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AnalysisPanel title="Aylık Nakit Akışı" description={`${analysis.last12Months.startDate} - ${analysis.last12Months.endDate}`}>
          <div className="space-y-2">
            {analysis.last12Months.monthly.map((point) => (
              <div key={point.month} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-600">{point.label}</span>
                <AmountText value={point.income} currency={bankImport.currency} showSign size="xs" />
                <AmountText value={-point.expense} currency={bankImport.currency} showSign size="xs" />
              </div>
            ))}
          </div>
        </AnalysisPanel>

        <AnalysisPanel title="Kategori Dağılımı" description="Yüksek güven önerileri kullanıcı onayına hazırdır.">
          <CompactDistributionList items={analysis.categoryDistribution.slice(0, 8)} currency={bankImport.currency} />
        </AnalysisPanel>

        <AnalysisPanel title="Mutabakat" description="Banka hareketi ile sistem kasa hareketi karşılaştırması.">
          <div className="grid gap-2">
            <MiniStat label="Eşleşmiş hareket" value={`${analysis.ledgerMatches.matchedRows} adet`} />
            <MiniStat label="Eşleşme önerisi" value={`${analysis.ledgerMatches.suggestedMatches.length} adet`} />
            <MiniStat label="Eşleşmeyen banka hareketi" value={`${analysis.unmatchedBankRows.length} adet`} />
            <MiniStat label="Eşleşmeyen sistem hareketi" value={`${analysis.unmatchedSystemMovements.length} adet`} />
          </div>
        </AnalysisPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AnalysisPanel title="En Yüksek 20 Gider" description="Büyük harcamalar hızlı kontrol için sıralanır.">
          <TransactionList rows={analysis.largeTransactions.expense} currency={bankImport.currency} negative />
        </AnalysisPanel>
        <AnalysisPanel title="En Yüksek 20 Gelir" description="Gelir kaynakları ve yüksek girişler.">
          <TransactionList rows={analysis.largeTransactions.income} currency={bankImport.currency} />
        </AnalysisPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AnalysisPanel title="Düzenli Giderler" description="Tekrarlayan ödeme adayları.">
          <RecurringList rows={analysis.recurring.expense} currency={bankImport.currency} negative />
        </AnalysisPanel>
        <AnalysisPanel title="Düzenli Gelirler" description="Tekrarlayan giriş adayları.">
          <RecurringList rows={analysis.recurring.income} currency={bankImport.currency} />
        </AnalysisPanel>
      </section>

      <section id="documents" className="surface scroll-mt-24 p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Satır Analizi</h2>
          <p className="mt-1 text-xs text-slate-500">İlk 500 satır gösterilir. Duplicate ve hatalı satırlar kasa bakiyesine otomatik işlenmez.</p>
        </div>
        <DataTable
          rows={bankImport.rows}
          empty="Bu içe aktarıma ait satır yok"
          columns={[
            { header: "#", cell: (row) => row.rowNumber },
            { header: "Tarih", cell: (row) => formatDate(row.transactionDate) },
            { header: "Açıklama", cell: (row) => row.description },
            {
              header: "Yön",
              cell: (row) => (
                <StatusBadge tone={row.direction === "IN" ? "green" : row.direction === "OUT" ? "rose" : "neutral"}>
                  {row.direction === "IN" ? "Giriş" : row.direction === "OUT" ? "Çıkış" : "Nötr"}
                </StatusBadge>
              )
            },
            {
              header: "Tutar",
              cell: (row) =>
                row.amount ? (
                  <AmountText value={toNumber(row.amount)} currency={row.currency} showSign size="sm" variant="strong" />
                ) : (
                  "-"
                )
            },
            { header: "Bakiye", cell: (row) => (row.balance ? formatMoney(row.balance, row.currency) : "-") },
            { header: "Kategori", cell: (row) => row.categorySuggestion ?? "-" },
            { header: "Müvekkil", cell: (row) => row.clientSuggestion?.name ?? "-" },
            { header: "Dosya", cell: (row) => row.caseFileSuggestion?.title ?? "-" },
            { header: "Eşleşme", cell: (row) => row.matchedCashLedgerEntry?.description ?? (row.matchType === "SUGGESTED" ? "Önerildi" : "-") },
            {
              header: "Durum",
              cell: (row) => <StatusBadge tone={row.status === "SUCCESS" ? "green" : row.status === "DUPLICATE" ? "amber" : "rose"}>{row.status === "SUCCESS" ? "Başarılı" : row.status === "DUPLICATE" ? "Duplicate" : row.errorMessage ?? "Hatalı"}</StatusBadge>
            }
          ]}
        />
      </section>
      <DetailActivityLog userId={user.id} entityType="BANK_STATEMENT_IMPORT" entityId={bankImport.id} />
    </div>
  );
}

function DarkInsightCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between gap-3 text-slate-400">
        <p className="text-xs font-medium uppercase tracking-[0.14em]">{label}</p>
        {icon}
      </div>
      <div className="mt-3 text-lg font-semibold text-white tabular-nums">{value}</div>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <Landmark className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-950 tabular-nums">{value}</div>
    </article>
  );
}

function AnalysisPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <article className="surface p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {children}
    </article>
  );
}

function CompactDistributionList({
  items,
  currency
}: {
  items: Array<{ category: string; group: string; count: number; total: number; averageConfidence: number }>;
  currency: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Kategori önerisi yok.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={`${item.group}-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{item.category}</p>
            <p className="text-xs text-slate-500">
              {item.count} hareket · güven %{Math.round(item.averageConfidence * 100)}
            </p>
          </div>
          <AmountText value={item.group === "EXPENSE" ? -item.total : item.total} currency={currency} showSign size="xs" />
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950 tabular-nums">{value}</span>
    </div>
  );
}

function TransactionList({
  rows,
  currency,
  negative = false
}: {
  rows: Array<{ rowId: string; date: string | null; description: string; amount: number; category: string; confidence: number }>;
  currency: string;
  negative?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Kayıt bulunamadı.</p>;
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {rows.map((row) => (
        <div key={row.rowId} className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{row.description}</p>
              <p className="text-xs text-slate-500">
                {row.date ? formatDate(row.date) : "-"} · {row.category} · güven %{Math.round(row.confidence * 100)}
              </p>
            </div>
            <AmountText value={negative ? -row.amount : row.amount} currency={currency} showSign size="xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecurringList({
  rows,
  currency,
  negative = false
}: {
  rows: Array<{
    key: string;
    label: string;
    category: string;
    count: number;
    averageAmount: number;
    totalAmount: number;
    nextExpectedDate: string | null;
  }>;
  currency: string;
  negative?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Düzenli işlem adayı yok.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{row.label || row.category}</p>
              <p className="text-xs text-slate-500">
                {row.count} kez · sonraki tahmin {row.nextExpectedDate ? formatDate(row.nextExpectedDate) : "-"}
              </p>
            </div>
            <AmountText value={negative ? -row.averageAmount : row.averageAmount} currency={currency} showSign size="xs" />
          </div>
        </div>
      ))}
    </div>
  );
}
