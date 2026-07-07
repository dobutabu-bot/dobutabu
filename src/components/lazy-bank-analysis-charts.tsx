"use client";

import dynamic from "next/dynamic";

import type { BankAnalysisChartsData } from "@/components/bank-analysis-charts";

const BankAnalysisCharts = dynamic(
  () => import("@/components/bank-analysis-charts").then((module) => module.BankAnalysisCharts),
  { ssr: false, loading: () => <BankAnalysisChartsLoading /> }
);

export function LazyBankAnalysisCharts({ data }: { data: BankAnalysisChartsData }) {
  return <BankAnalysisCharts data={data} />;
}

function BankAnalysisChartsLoading() {
  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Banka analizi grafikleri yükleniyor">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="surface min-h-80 animate-pulse p-4">
          <div className="h-4 w-44 rounded-full bg-slate-200" />
          <div className="mt-3 h-3 w-64 max-w-full rounded-full bg-slate-100" />
          <div className="mt-8 h-56 rounded-3xl bg-slate-100" />
        </div>
      ))}
    </section>
  );
}
