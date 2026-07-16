"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { ChartSkeleton } from "@/components/charts/chart-frame";
import type { ReportFinancialPicturePoint } from "@/lib/reporting";

const FinancialPictureChart = dynamic(
  () => import("@/components/finance-charts").then((module) => module.FinancialPictureChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton title="Finans dengesi" description="Seçilen dönem görselleştiriliyor" size="lg" />
  }
);

export function LazyFinancialPictureChart({ data }: { data: ReportFinancialPicturePoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartSkeleton title="Finans dengesi" description="Seçilen dönem görselleştiriliyor" size="lg" />;
  return <FinancialPictureChart data={data} />;
}
