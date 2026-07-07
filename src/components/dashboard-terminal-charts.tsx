"use client";

import {
  CashFlowChart,
  CategoryPieChart,
  FinanceChartPanel,
  HorizontalBarChart,
  IncomeExpenseChart,
  MiniLineChart,
  type FinanceFlowPoint,
  type FinanceSeriesPoint
} from "@/components/finance-charts";

export type DashboardFlowPoint = FinanceFlowPoint;
export type DashboardSeriesPoint = FinanceSeriesPoint;

export type DashboardTerminalChartData = {
  sevenDayFlow: DashboardFlowPoint[];
  monthDailyFlow: DashboardFlowPoint[];
  cashSevenDayFlow?: DashboardFlowPoint[];
  cashMonthDailyFlow?: DashboardFlowPoint[];
  monthlyComparison: Omit<DashboardFlowPoint, "net">[];
  cashAccountDistribution?: DashboardSeriesPoint[];
  expenseCategories: DashboardSeriesPoint[];
  clientBalances: DashboardSeriesPoint[];
};

type DashboardTerminalChartsProps = {
  data: DashboardTerminalChartData;
};

export function DashboardTerminalCharts({ data }: DashboardTerminalChartsProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-12">
      <FinanceChartPanel
        title="Son 7 Gün Kasa Giriş/Çıkış"
        description="Kısa dönem dijital kasa nabzı"
        badge="LIVE"
        className="xl:col-span-5"
      >
        <MiniLineChart
          data={data.cashSevenDayFlow ?? data.sevenDayFlow}
          series={[
            { dataKey: "tahsilat", name: "Giriş", tone: "income", strokeWidth: 3 },
            { dataKey: "gider", name: "Çıkış", tone: "expense" }
          ]}
        />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Bu Ay Günlük Nakit Akışı"
        description="Gün gün net kasa akışı"
        badge="LIVE"
        className="xl:col-span-7"
      >
        <CashFlowChart data={data.cashMonthDailyFlow ?? data.monthDailyFlow} />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Gelir/Gider Karşılaştırma"
        description="Son 6 ayın aylık karşılaştırması"
        badge="LIVE"
        className="xl:col-span-5"
      >
        <IncomeExpenseChart data={data.monthlyComparison} />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="En Yüksek 5 Müvekkil Bakiyesi"
        description="Açık bakiye yoğunluğu"
        badge="LIVE"
        className="xl:col-span-4"
      >
        <HorizontalBarChart data={data.clientBalances} dataKeyName="Bakiye" tone="balance" yAxisWidth={114} />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Kasa Hesap Dağılımı"
        description="Hesap bazlı bakiye kompozisyonu"
        badge="LIVE"
        className="xl:col-span-4"
      >
        <CategoryPieChart data={data.cashAccountDistribution ?? []} />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Gider Kategorileri"
        description="Bu ay kategori dağılımı"
        badge="LIVE"
        className="xl:col-span-3"
      >
        <CategoryPieChart data={data.expenseCategories} />
      </FinanceChartPanel>
    </section>
  );
}
