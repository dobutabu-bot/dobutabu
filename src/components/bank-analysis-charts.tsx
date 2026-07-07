"use client";

import {
  CashFlowChart,
  CategoryPieChart,
  FinanceChartPanel,
  HorizontalBarChart,
  IncomeExpenseChart,
  MiniLineChart
} from "@/components/finance-charts";

export type BankAnalysisChartsData = {
  monthlyTrend: Array<{ label: string; tahsilat: number; gider: number; net: number }>;
  netCashFlow: Array<{ label: string; net: number }>;
  expenseCategories: Array<{ label: string; value: number }>;
  incomeSources: Array<{ label: string; value: number }>;
  recurringCalendar: Array<{ label: string; value: number }>;
  largestExpenses: Array<{ label: string; value: number }>;
  largestIncome: Array<{ label: string; value: number }>;
};

export function BankAnalysisCharts({ data }: { data: BankAnalysisChartsData }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <FinanceChartPanel title="Son 12 Ay Giriş/Çıkış Trendi" description="Banka ekstresi hareketlerine göre aylık karşılaştırma." badge="TREND">
        <IncomeExpenseChart data={data.monthlyTrend} size="lg" showLegend showNet />
      </FinanceChartPanel>

      <FinanceChartPanel title="Son 12 Ay Net Nakit Akışı" description="Aylık net giriş/çıkış dengesinin finans terminali görünümü." badge="NET">
        <CashFlowChart data={data.monthlyTrend} size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel title="Net Akış Çizgisi" description="Net nakit akışının ay bazlı yönü." badge="AKIŞ">
        <MiniLineChart data={data.netCashFlow} series={[{ dataKey: "net", name: "Net Akış", tone: "net", strokeWidth: 3 }]} size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel title="Gider Kategori Dağılımı" description="Çıkış hareketleri sınıflandırılmış gider kategorilerine ayrılır." badge="GİDER">
        <CategoryPieChart data={data.expenseCategories} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel title="Gelir Kaynak Dağılımı" description="Giriş hareketleri gelir kaynağı önerilerine göre gruplanır." badge="GELİR">
        <CategoryPieChart data={data.incomeSources} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel title="Düzenli Ödeme Takvimi" description="Tekrarlayan ödeme/giriş adaylarının ortalama tutarları." badge="DÜZENLİ">
        <HorizontalBarChart data={data.recurringCalendar} dataKeyName="Ortalama" tone="document" size="lg" yAxisWidth={140} />
      </FinanceChartPanel>

      <FinanceChartPanel title="En Büyük Giderler" description="Son 12 ayda tespit edilen en yüksek çıkışlar." badge="TOP">
        <HorizontalBarChart data={data.largestExpenses} dataKeyName="Gider" tone="expense" size="lg" yAxisWidth={150} />
      </FinanceChartPanel>

      <FinanceChartPanel title="En Büyük Gelirler" description="Son 12 ayda tespit edilen en yüksek girişler." badge="TOP">
        <HorizontalBarChart data={data.largestIncome} dataKeyName="Gelir" tone="income" size="lg" yAxisWidth={150} />
      </FinanceChartPanel>
    </section>
  );
}
