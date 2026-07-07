import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  FileText,
  HandCoins,
  History,
  Landmark,
  LineChart,
  Plus,
  ReceiptText,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AmountText } from "@/components/amount-text";
import { DashboardMetricDrilldown, type DashboardMetricDrilldownCard } from "@/components/dashboard-metric-drilldown";
import { FinanceTicker, type FinanceTickerItem } from "@/components/finance-ticker";
import { LazyDashboardTerminalCharts } from "@/components/lazy-dashboard-terminal-charts";
import { Panel, StackedList } from "@/components/panel";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { RecentActivityList } from "@/components/recent-activity-list";
import { ReminderAlertCard } from "@/components/reminder-alert-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import {
  getCashAccountDistribution,
  getCurrentMonthDailyCashFlow,
  getLast7DaysCashFlow,
  getMonthlyCashInOut,
  getRecentCashMovements,
  getTodayCashInOut,
  getTotalCashBalance
} from "@/lib/cash/cash-dashboard-data";
import {
  getDashboardCharts,
  getDashboardMetricDrilldowns,
  getDashboardReminders,
  getDashboardSummary,
  getRecentTransactions,
  getTopBalanceClients,
  type DashboardReminderItem,
  type TopBalanceClient
} from "@/lib/dashboard/dashboard-data";
import { getDashboardV3Data, type DashboardV3Data } from "@/lib/dashboard/v3-dashboard-data";
import { cashAccountTypeLabels, cashLedgerDirectionLabels, cashLedgerEntryTypeLabels } from "@/lib/labels";
import { serializeEntity } from "@/lib/serialization";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const [
    summary,
    chartData,
    highestBalanceClients,
    recentTransactions,
    dashboardReminders,
    totalCashBalance,
    todayCash,
    monthlyCash,
    cashSevenDayFlow,
    cashMonthDailyFlow,
    cashAccountDistribution,
    recentCashMovements,
    metricDrilldowns,
    v3Data
  ] = await Promise.all([
    getDashboardSummary(user.id),
    getDashboardCharts(user.id),
    getTopBalanceClients(user.id),
    getRecentTransactions(user.id),
    getDashboardReminders(user.id),
    getTotalCashBalance(user.id),
    getTodayCashInOut(user.id),
    getMonthlyCashInOut(user.id),
    getLast7DaysCashFlow(user.id),
    getCurrentMonthDailyCashFlow(user.id),
    getCashAccountDistribution(user.id),
    getRecentCashMovements(user.id, 20),
    getDashboardMetricDrilldowns(user.id),
    getDashboardV3Data(user.id)
  ]);
  const { todayFinance } = summary;
  const { incomeActivityItems, expenseActivityItems, auditActivityItems } = recentTransactions;
  const cashTickerItems: FinanceTickerItem[] = [
    { label: "Toplam kasa", value: totalCashBalance.totalLabel, tone: moneyTone(totalCashBalance.total) },
    { label: "Bugün giriş", value: formatSignedMoney(todayCash.inTotal), tone: todayCash.inTotal > 0 ? "green" : "neutral" },
    { label: "Bugün çıkış", value: formatSignedMoney(-todayCash.outTotal), tone: todayCash.outTotal > 0 ? "rose" : "neutral" },
    { label: "Bugün net", value: formatSignedMoney(todayCash.net), tone: moneyTone(todayCash.net) },
    { label: "Bu ay net", value: formatSignedMoney(monthlyCash.net), tone: moneyTone(monthlyCash.net) },
    {
      label: "3 gün içinde gider",
      value: formatSignedMoney(-dashboardReminders.upcomingExpenseTotal),
      tone: dashboardReminders.upcomingExpenseTotal > 0 ? "rose" : "neutral"
    },
    {
      label: "Gecikmiş hatırlatma",
      value: `${dashboardReminders.overdueCount} adet`,
      tone: dashboardReminders.overdueCount > 0 ? "rose" : "green"
    },
    {
      label: "Ödenmemiş belge",
      value: formatSignedMoney(summary.unpaidDocumentAmount),
      tone: summary.unpaidDocumentAmount > 0 ? "green" : "neutral"
    }
  ];
  const v2ChartData = {
    ...chartData,
    cashSevenDayFlow: cashSevenDayFlow.map(cashFlowToFinanceFlow),
    cashMonthDailyFlow: cashMonthDailyFlow.map(cashFlowToFinanceFlow),
    cashAccountDistribution: cashAccountDistribution
      .map((account) => ({ label: account.label, value: Math.abs(account.value) }))
      .filter((account) => account.value > 0)
  };
  const cashActivityItems = recentCashMovements.map((entry) => ({
    id: entry.id,
    title: entry.description || cashLedgerEntryTypeLabels[entry.entryType],
    description: [
      cashLedgerEntryTypeLabels[entry.entryType],
      cashLedgerDirectionLabels[entry.direction],
      entry.cashAccountName,
      entry.clientName || "",
      entry.caseFileTitle || ""
    ]
      .filter(Boolean)
      .join(" · "),
    meta: entry.date,
    value: entry.signedAmountLabel,
    tone: entry.tone
  }));
  const metricCards: DashboardMetricDrilldownCard[] = [
    {
      id: "today-incomes",
      title: "Bugünkü Tahsilat",
      value: formatSignedMoney(todayFinance.collectionTotal),
      detail: "Bugün girilen gelir",
      icon: "handCoins",
      tone: "green",
      drilldownLabel: "Bugünkü son 5 tahsilat",
      emptyLabel: "Bugün tahsilat kaydı yok.",
      items: metricDrilldowns.todayIncomes
    },
    {
      id: "today-expenses",
      title: "Bugünkü Gider",
      value: formatSignedMoney(-todayFinance.expenseTotal),
      detail: "Bugün girilen gider",
      icon: "trendingDown",
      tone: "rose",
      drilldownLabel: "Bugünkü son 5 gider",
      emptyLabel: "Bugün gider kaydı yok.",
      items: metricDrilldowns.todayExpenses
    },
    {
      id: "today-net",
      title: "Bugünkü Net",
      value: formatSignedMoney(todayFinance.net),
      detail: "Tahsilat - gider",
      icon: "circleDollar",
      tone: todayFinance.net >= 0 ? "green" : "rose",
      drilldownLabel: "Neti oluşturan son 5 hareket",
      emptyLabel: "Bugün nete yansıyan hareket yok.",
      items: metricDrilldowns.todayNet
    },
    {
      id: "today-cash-movements",
      title: "Bugün Kasa Hareketi",
      value: `${todayCash.movementCount} hareket`,
      detail: "Dijital kasa kayıt adedi",
      icon: "activity",
      tone: "neutral",
      drilldownLabel: "Bugünkü son 10 kasa hareketi",
      emptyLabel: "Bugün kasa hareketi yok.",
      items: metricDrilldowns.todayCashMovements
    },
    {
      id: "upcoming-expenses",
      title: "Yaklaşan Ödeme/Gider",
      value: formatSignedMoney(-dashboardReminders.upcomingExpenseTotal),
      detail: "3 gün içindeki gider hatırlatmaları",
      icon: "calendar",
      tone: dashboardReminders.upcomingExpenseTotal > 0 ? "rose" : "green",
      drilldownLabel: "Yaklaşan 5 ödeme/gider",
      emptyLabel: "3 gün içinde yaklaşan gider yok.",
      items: metricDrilldowns.upcomingExpenses
    },
    {
      id: "overdue-reminders",
      title: "Gecikmiş Alacak/Hatırlatma",
      value: `${dashboardReminders.overdueCount} kayıt`,
      detail: "Bugün itibarıyla geciken uyarılar",
      icon: "bell",
      tone: dashboardReminders.overdueCount > 0 ? "rose" : "green",
      drilldownLabel: "Geciken son 5 kayıt",
      emptyLabel: "Gecikmiş hatırlatma yok.",
      items: metricDrilldowns.overdueReminders
    },
    {
      id: "month-cash-net",
      title: "Bu Ay Kasa Net",
      value: formatSignedMoney(monthlyCash.net),
      detail: "Kasa girişleri - çıkışları",
      icon: "walletCards",
      tone: monthlyCash.net >= 0 ? "green" : "rose",
      drilldownLabel: "Bu ay neti oluşturan son 10 kasa hareketi",
      emptyLabel: "Bu ay kasa hareketi yok.",
      items: metricDrilldowns.monthCashNet
    },
    {
      id: "open-receivable",
      title: "Açık Alacak Toplamı",
      value: formatSignedMoney(summary.openReceivableTotal),
      detail: "Kesilmiş/ödenmemiş belge",
      icon: "landmark",
      tone: summary.openReceivableTotal > 0 ? "green" : "neutral",
      drilldownLabel: "Açık alacak son 5 belge",
      emptyLabel: "Açık alacak belgesi yok.",
      items: metricDrilldowns.openReceivables
    }
  ];
  const safeTickerItems = serializeEntity(cashTickerItems) as FinanceTickerItem[];
  const safeMetricCards = serializeEntity(metricCards) as DashboardMetricDrilldownCard[];
  const safeV2ChartData = serializeEntity(v2ChartData) as typeof v2ChartData;
  const safeV3Data = serializeEntity(v3Data) as DashboardV3Data;

  return (
    <div className="space-y-5">
      <section className="finance-terminal-panel overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_420px] lg:p-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-slate-400">Büro Finans Paneli V2</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal sm:text-5xl">
              Dijital Kasa
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Bugünkü finans durumunuz, kasa hareketleriniz ve yaklaşan ödemeleriniz tek ekranda.
            </p>
            <div className="mt-5 grid gap-3 sm:max-w-3xl sm:grid-cols-3">
              <TerminalBadge label="Toplam Kasa" value={totalCashBalance.totalLabel} positive={totalCashBalance.total >= 0} />
              <TerminalBadge label="Bugün Net" value={formatSignedMoney(todayCash.net)} positive={todayCash.net >= 0} />
              <TerminalBadge label="Alarm" value={`${dashboardReminders.alarmCount} kayıt`} positive={dashboardReminders.alarmCount === 0} />
            </div>
          </div>

          <div className="digital-glass hidden p-4 lg:block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Hızlı aksiyonlar</p>
                <h2 className="mt-1 text-sm font-semibold text-white">Kasa işlemini tek dokunuşla başlat</h2>
              </div>
              <span className="digital-chip hidden px-3 py-1 text-[11px] font-semibold text-slate-300 sm:inline-flex">
                {summary.todayLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <QuickAction href="/collections" label="Tahsilat Ekle" icon={<HandCoins className="h-4 w-4" aria-hidden />} />
              <QuickAction href="/expenses" label="Gider Ekle" icon={<ReceiptText className="h-4 w-4" aria-hidden />} />
              <QuickAction href="/reminders" label="Hatırlatma Ekle" icon={<BellRing className="h-4 w-4" aria-hidden />} />
              <QuickAction href="/cash/ledger" label="Kasa Hareketi" icon={<Activity className="h-4 w-4" aria-hidden />} intent="open" />
              <QuickAction href="/reports" label="Rapor Aç" icon={<LineChart className="h-4 w-4" aria-hidden />} intent="open" />
            </div>
            <div className="mt-4 grid gap-3">
              <RadarLine label="KDV Kontrol" value={summary.monthVatTotalLabel} detail={`Stopaj: ${summary.monthWithholdingTotalLabel}`} />
              <RadarLine label="Yansıtılabilir Masraf" value={summary.monthReimbursableExpenseTotalLabel} detail="Bu ay" />
              <RadarLine label="Yatırıma Ayrılabilir" value={summary.investableEstimateLabel} detail="Net - vergi kontrolü" />
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.07] bg-black/[0.08]">
          <FinanceTicker items={safeTickerItems} />
        </div>
      </section>

      <DashboardV3Intelligence data={safeV3Data} />

      <DashboardMetricDrilldown cards={safeMetricCards} />

      <section className="surface overflow-hidden">
        <div className="grid gap-4 p-4 lg:grid-cols-[360px_1fr]">
          <div className="digital-drilldown-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Kasa Bakiyesi</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums sm:text-4xl">
              <AmountText value={totalCashBalance.total} showSign={false} className="text-white" />
            </p>
            <p className="mt-2 text-sm text-slate-400">Tüm aktif kasa hesaplarının toplam güncel bakiyesi.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <CashRadarLine label="Bugün giriş" value={formatSignedMoney(todayCash.inTotal)} positive />
              <CashRadarLine label="Bugün çıkış" value={formatSignedMoney(-todayCash.outTotal)} positive={false} />
              <CashRadarLine label="Bu ay net" value={formatSignedMoney(monthlyCash.net)} positive={monthlyCash.net >= 0} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {totalCashBalance.accounts.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
                Henüz kasa hesabı yok.
              </div>
            ) : (
              totalCashBalance.accounts.map((account) => (
                <div key={account.accountId} className="rounded-3xl border border-slate-200 bg-white/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{account.accountName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{cashAccountTypeLabels[account.type]} · {account.currency}</p>
                    </div>
                    <StatusBadge tone={account.tone}>{account.tone === "rose" ? "Eksi" : account.tone === "green" ? "Artı" : "Nötr"}</StatusBadge>
                  </div>
                  <p className="mt-5 truncate text-xl font-semibold">
                    <AmountText value={account.balance} currency={account.currency} showSign={false} />
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="surface-dark p-4 lg:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Hızlı işlemler</p>
            <h2 className="mt-1 text-sm font-semibold text-white">Günün finans hareketini tek dokunuşla gir</h2>
          </div>
          <span className="digital-row-soft hidden px-3 py-2 text-xs text-slate-300 sm:inline-flex">
            Mobil uyumlu kayıt akışı
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QuickAction href="/collections" label="Tahsilat ekle" icon={<HandCoins className="h-4 w-4" aria-hidden />} />
          <QuickAction href="/expenses" label="Gider ekle" icon={<ReceiptText className="h-4 w-4" aria-hidden />} />
          <QuickAction href="/reminders" label="Hatırlatma ekle" icon={<BellRing className="h-4 w-4" aria-hidden />} />
          <QuickAction href="/cash/ledger" label="Kasa hareketi" icon={<Activity className="h-4 w-4" aria-hidden />} intent="open" />
          <QuickAction href="/reports" label="Rapor aç" icon={<LineChart className="h-4 w-4" aria-hidden />} intent="open" />
        </div>
      </section>

      <LazyDashboardTerminalCharts data={safeV2ChartData} />

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Alarm / Hatırlatma Alanı" icon={<BellRing className="h-4 w-4" aria-hidden />}>
          <div className="grid gap-3 p-2 sm:grid-cols-2">
            <ReminderAlertCard label="Bugün vadesi gelenler" value={`${dashboardReminders.todayDueCount} kayıt`} tone={dashboardReminders.todayDueCount > 0 ? "amber" : "green"} />
            <ReminderAlertCard label="3 gün içinde gider" value={dashboardReminders.upcomingExpenseTotalLabel} tone={dashboardReminders.upcomingExpenseTotal > 0 ? "rose" : "green"} />
            <ReminderAlertCard label="Gecikmiş hatırlatmalar" value={`${dashboardReminders.overdueCount} kayıt`} tone={dashboardReminders.overdueCount > 0 ? "rose" : "green"} />
            <ReminderAlertCard label="Kritik hatırlatmalar" value={`${dashboardReminders.criticalCount} kayıt`} tone={dashboardReminders.criticalCount > 0 ? "rose" : "green"} />
          </div>
          <StackedList empty="Aksiyon gerektiren hatırlatma yok">
            {dashboardReminders.alarmReminders.map((reminder) => (
              <ReminderItem key={reminder.id} reminder={reminder} />
            ))}
          </StackedList>
        </Panel>

        <Panel title="En Yüksek 5 Müvekkil Bakiyesi" icon={<Scale className="h-4 w-4" aria-hidden />}>
          <StackedList empty="Bakiye bilgisi yok">
            {highestBalanceClients.map((client) => (
              <BalanceItem key={client.id} client={client} />
            ))}
          </StackedList>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Panel title="Son 20 Kasa Hareketi" icon={<Activity className="h-4 w-4" aria-hidden />}>
          <RecentActivityList
            items={cashActivityItems}
            empty="Henüz kasa hareketi yok"
            scrollable
          />
        </Panel>

        <Panel title="Son 10 Tahsilat" icon={<TrendingUp className="h-4 w-4" aria-hidden />}>
          <RecentActivityList items={incomeActivityItems} empty="Henüz tahsilat yok" />
        </Panel>

        <Panel title="Son 10 Gider" icon={<ReceiptText className="h-4 w-4" aria-hidden />}>
          <RecentActivityList items={expenseActivityItems} empty="Henüz gider yok" />
        </Panel>

        <Panel
          title="Son 10 İşlem"
          icon={<History className="h-4 w-4" aria-hidden />}
          action={
            <Link href="/activity" className="text-xs font-medium text-slate-600 hover:text-slate-950">
              Tümünü gör
            </Link>
          }
        >
          <RecentActivityList items={auditActivityItems} empty="Henüz işlem kaydı yok" />
        </Panel>
      </section>
    </div>
  );
}

function DashboardV3Intelligence({ data }: { data: DashboardV3Data }) {
  const balanceTone =
    data.smartAlerts.balanceDifferenceStatus === "ok"
      ? "green"
      : data.smartAlerts.balanceDifferenceStatus === "warning"
        ? "amber"
        : "rose";
  const typedBalanceTone = balanceTone as "green" | "amber" | "rose";
  const undocumentedCount = data.smartAlerts.undocumentedIncomeCount + data.smartAlerts.undocumentedExpenseCount;
  const pulseTabs = [
    {
      href: "/documents",
      label: "Belge",
      value: `${data.documentStatus.total} kayıt`,
      detail: `${data.documentStatus.unlinked} bağsız · ${data.documentStatus.waitingProcessing} işlem bekliyor`,
      tone: data.documentStatus.unlinked > 0 || data.documentStatus.waitingProcessing > 0 ? ("amber" as const) : ("green" as const),
      icon: <FileText className="h-4 w-4" aria-hidden />,
      testId: "v3-dashboard-tab-documents"
    },
    {
      href: "/bank-statements/analysis",
      label: "Banka",
      value: data.bankAnalysis.netLabel,
      detail: `${data.bankAnalysis.unmatchedCount} eşleşmemiş hareket`,
      tone: data.bankAnalysis.net >= 0 ? ("green" as const) : ("rose" as const),
      icon: <Landmark className="h-4 w-4" aria-hidden />,
      testId: "v3-dashboard-tab-bank"
    },
    {
      href: "/cash/reconciliation",
      label: "Mutabakat",
      value: data.smartAlerts.balanceDifferenceLabel,
      detail: data.smartAlerts.balanceDifferenceDetail,
      tone: typedBalanceTone,
      icon: <Scale className="h-4 w-4" aria-hidden />,
      testId: "v3-dashboard-tab-reconciliation"
    },
    {
      href: "/documents/missing",
      label: "Belgesiz",
      value: `${undocumentedCount} kayıt`,
      detail: "Tahsilat ve gider kanıt zinciri",
      tone: undocumentedCount > 0 ? ("amber" as const) : ("green" as const),
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      testId: "v3-dashboard-tab-missing-documents"
    },
    {
      href: "/capital",
      label: "Sermaye",
      value: data.capitalSummary.netWorthLabel,
      detail: `Borç ${data.capitalSummary.totalDebtsLabel}`,
      tone: data.capitalSummary.netWorth >= 0 ? ("green" as const) : ("rose" as const),
      icon: <WalletCards className="h-4 w-4" aria-hidden />,
      testId: "v3-dashboard-tab-capital"
    }
  ];
  const quickActions = [
    {
      href: "/documents/new",
      label: "Belge yükle",
      detail: "Dekont, PDF veya görsel",
      icon: <FileText className="h-4 w-4" aria-hidden />,
      tone: "blue" as const
    },
    {
      href: "/bank-statements/import",
      label: "Banka ekstresi yükle",
      detail: "CSV, XLSX veya PDF",
      icon: <Landmark className="h-4 w-4" aria-hidden />,
      tone: "green" as const
    },
    {
      href: "/reconciliation",
      label: "Mutabakat aç",
      detail: "Banka ve kasa karşılaştır",
      icon: <Scale className="h-4 w-4" aria-hidden />,
      tone: "amber" as const
    },
    {
      href: "/capital/assets",
      label: "Sermaye varlığı ekle",
      detail: "Varlık merkezini güncelle",
      icon: <WalletCards className="h-4 w-4" aria-hidden />,
      tone: "neutral" as const
    },
    {
      href: "/api/reports/monthly/pdf",
      label: "PDF rapor al",
      detail: "Aylık finans çıktısı",
      icon: <ReceiptText className="h-4 w-4" aria-hidden />,
      tone: "rose" as const
    }
  ];

  return (
    <section className="space-y-4">
      <div className="surface-dark overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">V3 Akıllı Merkez</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Finans, belge ve sermaye sinyalleri</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Banka hareketleri, belge durumu, mutabakat farkları ve sermaye özeti tek ekranda hafif özetlerle izlenir.
            </p>
          </div>
        </div>

        <div className="mt-5 scroll-x-stable flex gap-3 pb-1" aria-label="V3 akıllı finans sekmeleri">
          {pulseTabs.map((tab) => (
            <V3PulseTab key={tab.href} {...tab} />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            href="/bank-statements/analysis"
            className="digital-row inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
          >
            Banka analizini aç
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="digital-glass p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Akıllı Finans Uyarıları</p>
                <h3 className="mt-1 text-base font-semibold text-white">Öncelikli kontrol listesi</h3>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SmartAlertCard
                label="Eşleşmemiş banka hareketleri"
                value={`${data.smartAlerts.unmatchedBankRows} kayıt`}
                detail="Banka ekstresinde sistem kaydı bekleyen satırlar"
                href="/reconciliation"
                tone={data.smartAlerts.unmatchedBankRows > 0 ? "amber" : "green"}
              />
              <SmartAlertCard
                label="Banka-sistem bakiye farkı"
                value={data.smartAlerts.balanceDifferenceLabel}
                detail={data.smartAlerts.balanceDifferenceDetail}
                href="/cash/reconciliation"
                tone={typedBalanceTone}
              />
              <SmartAlertCard
                label="3 gün içinde gider"
                value={data.smartAlerts.upcomingExpenseReminderTotalLabel}
                detail={`${data.smartAlerts.upcomingExpenseReminderCount} açık ödeme hatırlatması`}
                href="/reminders"
                tone={data.smartAlerts.upcomingExpenseReminderTotal > 0 ? "rose" : "green"}
              />
              <SmartAlertCard
                label="Yüksek tutarlı giderler"
                value={data.smartAlerts.highExpenseTotalLabel}
                detail={`Bu ay ${data.smartAlerts.highExpenseCount} gider 10.000 TL ve üzeri`}
                href="/expenses"
                tone={data.smartAlerts.highExpenseCount > 0 ? "rose" : "green"}
              />
              <SmartAlertCard
                label="Belgesiz giderler"
                value={`${data.smartAlerts.undocumentedExpenseCount} kayıt`}
                detail="Fiş, fatura veya dekont bağlantısı olmayan giderler"
                href="/expenses"
                tone={data.smartAlerts.undocumentedExpenseCount > 0 ? "amber" : "green"}
              />
              <SmartAlertCard
                label="Belgesiz tahsilatlar"
                value={`${data.smartAlerts.undocumentedIncomeCount} kayıt`}
                detail="Dekont veya makbuz bağlantısı olmayan tahsilatlar"
                href="/collections"
                tone={data.smartAlerts.undocumentedIncomeCount > 0 ? "amber" : "green"}
              />
              <SmartAlertCard
                label="Mutabakat bekleyen"
                value={`${data.smartAlerts.pendingReconciliationCount} kayıt`}
                detail="Onay veya manuel eşleştirme bekleyen banka hareketleri"
                href="/reconciliation"
                tone={data.smartAlerts.pendingReconciliationCount > 0 ? "amber" : "green"}
              />
            </div>
          </div>

          <div className="digital-glass p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">V3 hızlı aksiyonlar</p>
            <div className="mt-4 grid gap-2">
              {quickActions.map((action) => (
                <V3QuickAction key={action.href} {...action} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DocumentStatusPanel data={data.documentStatus} />
        <BankAnalysisPanel data={data.bankAnalysis} />
        <CapitalSummaryPanel data={data.capitalSummary} />
      </div>
    </section>
  );
}

function V3PulseTab({
  href,
  label,
  value,
  detail,
  tone,
  icon,
  testId
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "rose" | "amber" | "blue" | "neutral";
  icon: ReactNode;
  testId: string;
}) {
  const classes = toneClass(tone);

  return (
    <Link
      href={href}
      data-testid={testId}
      className={`digital-row-soft flex min-h-28 w-64 shrink-0 flex-col justify-between px-4 py-3 transition duration-200 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 ${classes.border}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          <span className={`flex h-8 w-8 items-center justify-center rounded-2xl ${classes.icon}`}>{icon}</span>
          {label}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} aria-hidden />
      </span>
      <span>
        <PrivacyAmount as="span" className={`block truncate text-xl font-semibold tabular-nums ${classes.text}`}>
          {value}
        </PrivacyAmount>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{detail}</span>
      </span>
    </Link>
  );
}

function SmartAlertCard({
  label,
  value,
  detail,
  href,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: "green" | "rose" | "amber" | "blue" | "neutral";
}) {
  const classes = toneClass(tone);

  return (
    <Link
      href={href}
      className={`digital-row-soft group flex min-h-28 flex-col justify-between gap-3 px-4 py-3 transition duration-200 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 ${classes.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} aria-hidden />
      </div>
      <div>
        <PrivacyAmount as="p" className={`text-xl font-semibold tabular-nums ${classes.text}`}>
          {value}
        </PrivacyAmount>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </Link>
  );
}

function DocumentStatusPanel({ data }: { data: DashboardV3Data["documentStatus"] }) {
  return (
    <Panel title="Belge Durumu" icon={<FileText className="h-4 w-4" aria-hidden />}>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <MiniSignal label="Toplam belge" value={`${data.total}`} tone="blue" />
        <MiniSignal label="Bu ay yüklenen" value={`${data.uploadedThisMonth}`} tone="green" />
        <MiniSignal label="İşlenmeyi bekleyen" value={`${data.waitingProcessing}`} tone={data.waitingProcessing > 0 ? "amber" : "green"} />
        <MiniSignal label="Tahsilata bağlı" value={`${data.linkedToIncomes}`} tone="green" />
        <MiniSignal label="Gidere bağlı" value={`${data.linkedToExpenses}`} tone="rose" />
        <MiniSignal label="Bağsız belge" value={`${data.unlinked}`} tone={data.unlinked > 0 ? "amber" : "green"} />
      </div>
    </Panel>
  );
}

function BankAnalysisPanel({ data }: { data: DashboardV3Data["bankAnalysis"] }) {
  return (
    <Panel title="Banka Analizi" icon={<Landmark className="h-4 w-4" aria-hidden />}>
      <div className="space-y-3 p-3">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-4">
          <p className="text-xs font-medium text-slate-500">Son import</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{data.lastImportLabel}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{data.lastImportDetail}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniSignal label="Son 12 ay giriş" value={data.totalInLabel} tone="green" />
          <MiniSignal label="Son 12 ay çıkış" value={data.totalOutLabel} tone="rose" />
          <MiniSignal label="Net nakit akışı" value={data.netLabel} tone={data.net >= 0 ? "green" : "rose"} />
          <MiniSignal label="Eşleşmemiş" value={`${data.unmatchedCount} kayıt`} tone={data.unmatchedCount > 0 ? "amber" : "green"} />
        </div>
      </div>
    </Panel>
  );
}

function CapitalSummaryPanel({ data }: { data: DashboardV3Data["capitalSummary"] }) {
  return (
    <Panel title="Sermaye Özeti" icon={<WalletCards className="h-4 w-4" aria-hidden />}>
      <div className="space-y-4 p-3">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-4">
          <p className="text-xs font-medium text-slate-500">Toplam net sermaye</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            <AmountText value={data.netWorth} showSign={false} />
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniSignal label="Nakit/Banka" value={data.cashBankTotalLabel} tone="blue" />
          <MiniSignal label="Döviz" value={data.fxTotalLabel} tone="neutral" />
          <MiniSignal label="Altın" value={data.goldTotalLabel} tone="amber" />
          <MiniSignal label="Borsa/Fon" value={data.stockTotalLabel} tone="green" />
          <MiniSignal label="Crypto" value={data.cryptoTotalLabel} tone="neutral" />
          <MiniSignal label="Borçlar" value={data.totalDebtsLabel} tone={data.totalDebts > 0 ? "rose" : "green"} />
        </div>
        <CapitalDistribution data={data.assetTypeDistribution} />
      </div>
    </Panel>
  );
}

function V3QuickAction({
  href,
  label,
  detail,
  icon,
  tone
}: {
  href: string;
  label: string;
  detail: string;
  icon: ReactNode;
  tone: "green" | "rose" | "amber" | "blue" | "neutral";
}) {
  const classes = toneClass(tone);

  return (
    <Link
      href={href}
      className="digital-row flex min-h-16 items-center justify-between gap-3 px-4 py-3 text-white transition duration-200 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${classes.icon}`}>{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{detail}</span>
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}

function MiniSignal({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "green" | "rose" | "amber" | "blue" | "neutral";
}) {
  const classes = toneClass(tone);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)]">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <PrivacyAmount as="p" className={`mt-2 truncate text-base font-semibold tabular-nums ${classes.lightText}`}>
        {value}
      </PrivacyAmount>
    </div>
  );
}

function CapitalDistribution({ data }: { data: DashboardV3Data["capitalSummary"]["assetTypeDistribution"] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
        Varlık dağılımı için henüz veri yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Varlık dağılımı</p>
        <span className="text-xs text-slate-500">İlk 6 tür</span>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700">{item.label}</span>
              <PrivacyAmount className="text-slate-500">{item.valueLabel}</PrivacyAmount>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, Math.min(item.percent, 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toneClass(tone: "green" | "rose" | "amber" | "blue" | "neutral") {
  const map = {
    green: {
      text: "text-emerald-300",
      lightText: "text-emerald-700",
      dot: "bg-emerald-300",
      border: "border border-emerald-300/10",
      icon: "bg-emerald-400/15 text-emerald-200"
    },
    rose: {
      text: "text-rose-300",
      lightText: "text-rose-700",
      dot: "bg-rose-300",
      border: "border border-rose-300/10",
      icon: "bg-rose-400/15 text-rose-200"
    },
    amber: {
      text: "text-amber-300",
      lightText: "text-amber-700",
      dot: "bg-amber-300",
      border: "border border-amber-300/10",
      icon: "bg-amber-400/15 text-amber-100"
    },
    blue: {
      text: "text-sky-300",
      lightText: "text-sky-700",
      dot: "bg-sky-300",
      border: "border border-sky-300/10",
      icon: "bg-sky-400/15 text-sky-100"
    },
    neutral: {
      text: "text-slate-200",
      lightText: "text-slate-700",
      dot: "bg-slate-400",
      border: "border border-white/10",
      icon: "bg-white/10 text-slate-100"
    }
  };

  return map[tone];
}

function TerminalBadge({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <span className="digital-row inline-flex min-h-9 items-center gap-2 px-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <PrivacyAmount className={positive ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>{value}</PrivacyAmount>
    </span>
  );
}

function RadarLine({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="digital-row-soft flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-300">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
      </div>
      <PrivacyAmount as="p" className="shrink-0 text-sm font-semibold text-white">
        {value}
      </PrivacyAmount>
    </div>
  );
}

function CashRadarLine({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="digital-row flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <PrivacyAmount className={positive ? "text-sm font-semibold text-emerald-300 tabular-nums" : "text-sm font-semibold text-rose-300 tabular-nums"}>
        {value}
      </PrivacyAmount>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
  intent = "create"
}: {
  href: string;
  label: string;
  icon: ReactNode;
  intent?: "create" | "open";
}) {
  return (
    <Link
      href={href}
      className="digital-row inline-flex min-h-14 items-center justify-between gap-3 px-4 text-sm font-semibold text-white transition duration-200 hover:bg-white/[0.09] active:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
    >
      <span className="inline-flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-[0_12px_24px_rgba(255,255,255,0.10)]">{icon}</span>
        {label}
      </span>
      {intent === "create" ? <Plus className="h-4 w-4 text-slate-300" aria-hidden /> : <ArrowUpRight className="h-4 w-4 text-slate-300" aria-hidden />}
    </Link>
  );
}

function formatSignedMoney(value: number) {
  if (value === 0) {
    return formatMoney(0);
  }

  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(value))}`;
}

function moneyTone(value: number): FinanceTickerItem["tone"] {
  if (value > 0) return "green";
  if (value < 0) return "rose";
  return "neutral";
}

function cashFlowToFinanceFlow(point: { label: string; giris: number; cikis: number; net: number }) {
  return {
    label: point.label,
    tahsilat: point.giris,
    gider: point.cikis,
    net: point.net
  };
}

function BalanceItem({
  client
}: {
  client: TopBalanceClient;
}) {
  const tone = client.balance > 0 ? "amber" : client.balance < 0 ? "green" : "neutral";
  const label = client.balance > 0 ? "Açık bakiye" : client.balance < 0 ? "Avans fazlası" : "Dengede";

  return (
    <div className="px-2 py-3 sm:px-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-950">{client.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Alacak <PrivacyAmount>{client.openDocumentTotalLabel}</PrivacyAmount> · Masraf <PrivacyAmount>{client.clientExpenseTotalLabel}</PrivacyAmount> · Avans{" "}
            <PrivacyAmount>{client.advanceTotalLabel}</PrivacyAmount>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <PrivacyAmount as="p" className="text-sm font-semibold text-slate-950">
            {client.balanceLabel}
          </PrivacyAmount>
          <div className="mt-1">
            <StatusBadge tone={tone}>{label}</StatusBadge>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderItem({
  reminder
}: {
  reminder: DashboardReminderItem;
}) {
  const financialToneClass = reminder.amountLabel.startsWith("+")
    ? "text-emerald-700"
    : reminder.amountLabel.startsWith("-")
      ? "text-rose-700"
      : "text-slate-600";

  return (
    <div className="px-2 py-3 sm:px-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-950">{reminder.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            <span>{reminder.reminderTypeLabel}</span>
            {reminder.amountLabel ? (
              <PrivacyAmount className={`font-semibold tabular-finance ${financialToneClass}`}> · {reminder.amountLabel}</PrivacyAmount>
            ) : null}
            {reminder.context ? ` · ${reminder.context}` : reminder.description ? ` · ${reminder.description}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge tone={reminder.stateTone}>{reminder.stateLabel}</StatusBadge>
          <p className="mt-1 text-xs text-slate-500">{reminder.dueDateLabel}</p>
        </div>
      </div>
    </div>
  );
}
