"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { ChartSkeleton } from "@/components/charts/chart-frame";
import type { ReportAnalytics } from "@/lib/reporting";

const ReportAnalyticsCharts = dynamic(
  () => import("@/components/report-analytics-charts").then((module) => module.ReportAnalyticsCharts),
  { ssr: false, loading: () => <ReportChartsLoading /> }
);

export function LazyReportAnalyticsCharts({ analytics }: { analytics: ReportAnalytics }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ReportChartsLoading />;
  return <ReportAnalyticsCharts analytics={analytics} />;
}

function ReportChartsLoading() {
  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Rapor grafikleri yükleniyor">
      {Array.from({ length: 6 }).map((_, index) => (
        <ChartSkeleton key={index} title="Rapor grafiği" description="Veri görselleştirmesi yükleniyor" size="lg" />
      ))}
    </section>
  );
}
