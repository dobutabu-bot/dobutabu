"use client";

import {
  CashFlowChart,
  CategoryPieChart,
  FinanceChartPanel,
  HorizontalBarChart,
  IncomeExpenseChart,
  MiniLineChart
} from "@/components/finance-charts";
import type { ReportAnalytics } from "@/lib/reporting";

type ReportAnalyticsChartsProps = {
  analytics: ReportAnalytics;
};

export function ReportAnalyticsCharts({ analytics }: ReportAnalyticsChartsProps) {
  const { charts } = analytics;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <FinanceChartPanel
        title="Günlük Nakit Akışı"
        description="Seçilen aralıkta kasa giriş, çıkış ve net akış"
      >
        <CashFlowChart data={charts.cashDailyFlow} size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Aylık Gelir/Gider Trendi"
        description="Seçilen aralıkta nakit giriş ve çıkış hareketi"
      >
        <IncomeExpenseChart data={charts.monthlyTrend} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Kasa Hesap Bazlı Dağılım"
        description="Aktif kasa hesaplarının bakiye kompozisyonu"
      >
        <CategoryPieChart data={charts.cashAccountDistribution} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Gelir Kategorileri Dağılımı"
        description="Tahsilatların kategori bazlı yoğunluğu"
      >
        <CategoryPieChart data={charts.incomeCategories} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Gider Kategorileri Dağılımı"
        description="Gider kalemlerinin kategori bazlı yoğunluğu"
      >
        <CategoryPieChart data={charts.expenseCategories} size="lg" showLegend />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Net Kâr/Zarar Trendi"
        description="Tahsilat eksi gider sonucu oluşan dönemsel net"
      >
        <MiniLineChart
          data={charts.netTrend}
          size="lg"
          series={[{ dataKey: "value", name: "Net", tone: "net", strokeWidth: 3 }]}
        />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="En Yüksek Tahsilatlı Müvekkiller"
        description="Müvekkil bazlı tahsilat performansı"
      >
        <HorizontalBarChart data={charts.topClientsByIncome} dataKeyName="Tahsilat" tone="income" size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Müvekkil Bazlı Açık Bakiye"
        description="Açık belge, yansıtılabilir masraf ve avans dengesi"
      >
        <HorizontalBarChart data={charts.clientOpenBalances} dataKeyName="Bakiye" tone="balance" size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Dosya Bazlı Kârlılık / Net Durum"
        description="En yoğun dosyalarda tahsilat, gider ve net durum"
      >
        <IncomeExpenseChart data={charts.caseFinanceSummary} size="lg" showLegend showNet />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="En Yüksek Gider Kalemleri"
        description="Seçilen dönemin en büyük gider hareketleri"
      >
        <HorizontalBarChart data={charts.topExpenseItems} dataKeyName="Gider" tone="expense" size="lg" />
      </FinanceChartPanel>

      <FinanceChartPanel
        title="Geciken Hatırlatmalar Timeline"
        description="Vadesi geçmiş açık hatırlatmaların tarih yoğunluğu"
      >
        <HorizontalBarChart
          data={charts.overdueReminderTimeline}
          dataKeyName="Adet"
          tone="document"
          size="lg"
          valueFormatter={formatCount}
          tooltipFormatter={formatCount}
        />
      </FinanceChartPanel>
    </section>
  );
}

function formatCount(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("tr-TR")} adet`;
}
