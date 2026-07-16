import type { LucideIcon } from "lucide-react";

import { AmountText } from "@/components/amount-text";
import { cn } from "@/lib/utils";

type FinanceMetricTone = "neutral" | "positive" | "negative" | "warning" | "info";

type FinanceMetricProps = {
  label: string;
  value: unknown;
  currency?: string;
  icon?: LucideIcon;
  tone?: FinanceMetricTone;
  detail?: string;
  className?: string;
};

const toneClasses: Record<FinanceMetricTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negative: "bg-rose-50 text-rose-700 ring-rose-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200"
};

export function FinanceMetric({ label, value, currency = "TRY", icon: Icon, tone = "neutral", detail, className }: FinanceMetricProps) {
  return (
    <div className={cn("premium-card flex h-full min-w-0 flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{label}</p>
          <AmountText value={value} currency={currency} showSign size="xl" variant="strong" className="mt-2 block" />
        </div>
        {Icon ? (
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1", toneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
      </div>
      {detail ? <p className="mt-auto truncate pt-3 text-xs text-slate-500" title={detail}>{detail}</p> : null}
    </div>
  );
}
