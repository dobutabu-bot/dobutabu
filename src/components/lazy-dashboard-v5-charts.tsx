"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { LoadingSkeleton } from "@/components/loading-skeleton";
import type { DashboardV5DailyPoint, DashboardV5Period, DashboardV5Point } from "@/lib/dashboard/v5-dashboard-data";

const NetWorthChart = dynamic(() => import("@/components/dashboard-v5-charts").then((module) => module.NetWorthChart), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[360px] rounded-2xl bg-white/10" />
});

const DashboardMetricCards = dynamic(() => import("@/components/dashboard-v5-charts").then((module) => module.DashboardMetricCards), {
  ssr: false,
  loading: () => <MetricCardsSkeleton />
});

export function LazyNetWorthChart(props: { data: DashboardV5Point[]; currentValue: number; currentValueLabel: string; period: DashboardV5Period }) {
  const mounted = useMounted();
  if (!mounted) return <LoadingSkeleton className="h-[360px] rounded-2xl bg-white/10" />;
  return <NetWorthChart {...props} />;
}

export function LazyDashboardMetricCards(props: {
  daily: DashboardV5DailyPoint[];
  monthDaily: DashboardV5DailyPoint[];
  month: { income: number; expense: number; net: number };
  openReceivable: number;
  unmatchedBankCount: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <MetricCardsSkeleton />;
  return <DashboardMetricCards {...props} />;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function MetricCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5" aria-label="Finans kartları yükleniyor">
      {Array.from({ length: 5 }).map((_, index) => <LoadingSkeleton key={index} className="h-[230px] rounded-3xl" />)}
    </div>
  );
}
