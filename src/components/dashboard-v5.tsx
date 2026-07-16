import type { ReactNode } from "react";

import { AmountText } from "@/components/amount-text";
import { cn } from "@/lib/utils";

export function TodaySummaryStrip({ income, expense, net }: { income: number; expense: number; net: number }) {
  const items = [
    { label: "Bugün giriş", value: income, tone: "positive" },
    { label: "Bugün çıkış", value: -expense, tone: "negative" },
    { label: "Bugün net", value: net, tone: net >= 0 ? "positive" : "negative" }
  ] as const;

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0a1a32] shadow-[0_18px_50px_rgba(2,6,23,0.20)]" aria-label="Bugünün finans özeti" data-testid="v5-today-summary">
      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div key={item.label} data-testid={`v5-today-${item.label === "Bugün giriş" ? "income" : item.label === "Bugün çıkış" ? "expense" : "net"}`} className="flex min-w-0 items-center justify-between gap-4 px-5 py-4 sm:block sm:text-center lg:flex lg:text-left">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
            <AmountText
              value={item.value}
              showSign
              size="lg"
              variant="terminal"
              className={cn("block", item.tone === "positive" ? "text-emerald-300" : "text-rose-300")}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
