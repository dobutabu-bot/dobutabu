"use client";

import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export type ChartSize = "sm" | "md" | "lg";

export const chartHeights: Record<ChartSize, string> = {
  sm: "h-52",
  md: "h-64",
  lg: "h-72"
};

const chartMinHeights: Record<ChartSize, number> = {
  sm: 208,
  md: 256,
  lg: 288
};

export function ChartFrame({
  size = "md",
  className,
  children
}: {
  size?: ChartSize;
  className?: string;
  children: ReactElement;
}) {
  return (
    <div
      className={cn("min-w-0 overflow-hidden", chartHeights[size], className)}
      style={{ minHeight: chartMinHeights[size] }}
      data-testid="chart-frame"
    >
      {children}
    </div>
  );
}

export function ResponsiveChartContainer({
  size = "md",
  className,
  children
}: {
  size?: ChartSize;
  className?: string;
  children: ReactElement;
}) {
  return (
    <ChartFrame size={size} className={className}>
      <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={chartMinHeights[size]}>
        {children}
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function EmptyChartState({
  title = "Grafik için veri yok",
  description = "Seçilen aralıkta bu grafiği oluşturacak kayıt bulunamadı."
}: {
  title?: string;
  description?: string;
}) {
  return <EmptyState title={title} description={description} />;
}

export function ChartSkeleton({
  title,
  description,
  size = "md",
  className
}: {
  title: string;
  description?: string;
  size?: ChartSize;
  className?: string;
}) {
  return (
    <div className={cn("surface min-h-80 p-4", className)} data-testid="chart-skeleton">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
          Yükleniyor
        </span>
      </div>
      <div className="mt-6 h-3 w-64 max-w-full animate-pulse rounded-full bg-slate-100" />
      <ChartFrame size={size} className="mt-8 animate-pulse rounded-3xl bg-slate-100">
        <div aria-hidden />
      </ChartFrame>
    </div>
  );
}
