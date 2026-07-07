import type { LucideIcon } from "lucide-react";

import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "neutral" | "green" | "rose" | "amber";
};

const tones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200"
};

const valueTones = {
  neutral: "text-slate-950",
  green: "text-emerald-700",
  rose: "text-rose-700",
  amber: "text-amber-800"
};

export function MetricCard({ title, value, detail, icon: Icon, tone = "neutral" }: MetricCardProps) {
  return (
    <div className="premium-card premium-card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{title}</p>
          <PrivacyAmount as="p" className={cn("mt-2 truncate text-2xl font-semibold tabular-nums sm:text-3xl", valueTones[tone])}>
            {value}
          </PrivacyAmount>
        </div>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_12px_24px_rgba(15,23,42,0.07)]", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      {detail ? <p className="mt-3 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
