"use client";

import {
  FinanceChartPanel,
  HorizontalBarChart,
  IncomeExpenseChart,
  type FinanceTone
} from "@/components/finance-charts";
import type { ReportChartPoint } from "@/lib/reporting";

type ReportChartsProps = {
  data: ReportChartPoint[];
};

const fallbackSeries: Array<{ key: keyof ReportChartPoint; label: string; tone: FinanceTone }> = [
  { key: "belge", label: "Belge", tone: "document" },
  { key: "masraf", label: "Masraf", tone: "expense" },
  { key: "net", label: "Net", tone: "net" }
];

export function ReportCharts({ data }: ReportChartsProps) {
  const hasFinancialFlow = data.some((point) => point.tahsilat !== undefined || point.gider !== undefined);
  const hasNet = data.some((point) => point.net !== undefined);

  return (
    <FinanceChartPanel
      title="Rapor Grafiği"
      description="Seçilen raporun özet finans görünümü"
    >
      {hasFinancialFlow ? (
        <IncomeExpenseChart
          data={data.map((point) => ({
            label: point.label,
            tahsilat: point.tahsilat ?? 0,
            gider: point.gider ?? 0,
            net: point.net ?? 0
          }))}
          size="lg"
          showLegend
          showNet={hasNet}
        />
      ) : (
        <FallbackSeriesChart data={data} />
      )}
    </FinanceChartPanel>
  );
}

function FallbackSeriesChart({ data }: ReportChartsProps) {
  const active = fallbackSeries.find((series) => data.some((point) => Number(point[series.key] ?? 0) !== 0));

  if (!active) {
    return <HorizontalBarChart data={[]} dataKeyName="Tutar" size="lg" />;
  }

  return (
    <HorizontalBarChart
      data={data.map((point) => ({ label: point.label, value: Number(point[active.key] ?? 0) }))}
      dataKeyName={active.label}
      tone={active.tone}
      size="lg"
    />
  );
}
