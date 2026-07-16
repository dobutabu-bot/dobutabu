import type { ReactElement, ReactNode } from "react";

import { ChartFrame, EmptyChartState, type ChartSize } from "@/components/charts/chart-frame";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  description?: string;
  children?: ReactElement;
  action?: ReactNode;
  empty?: boolean;
  size?: ChartSize;
  className?: string;
};

export function ChartCard({ title, description, children, action, empty = false, size = "md", className }: ChartCardProps) {
  return (
    <section className={cn("v4-chart-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">
        {empty || !children ? <EmptyChartState /> : <ChartFrame size={size}>{children}</ChartFrame>}
      </div>
    </section>
  );
}
