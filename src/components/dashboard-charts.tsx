"use client";

import { FinanceChartPanel, IncomeExpenseChart } from "@/components/finance-charts";

type MonthlyPoint = {
  month: string;
  tahsilat: number;
  gider: number;
};

type DashboardChartsProps = {
  monthlyData: MonthlyPoint[];
};

export function DashboardCharts({ monthlyData }: DashboardChartsProps) {
  return (
    <FinanceChartPanel
      title="Aylık Gelir/Gider Grafiği"
      description="Son 6 ayın sade nakit akışı"
      badge="LIVE"
    >
      <IncomeExpenseChart
        data={monthlyData.map((point) => ({
          label: point.month,
          tahsilat: point.tahsilat,
          gider: point.gider
        }))}
        size="lg"
        showLegend
      />
    </FinanceChartPanel>
  );
}
