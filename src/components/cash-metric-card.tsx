import type { LucideIcon } from "lucide-react";

import { AmountText } from "@/components/amount-text";
import { cn } from "@/lib/utils";

type CashMetricCardProps = {
  label: string;
  amount: number;
  currency?: string;
  icon?: LucideIcon;
  tone?: "green" | "rose" | "neutral";
  showSign?: boolean;
};

export function CashMetricCard({ label, amount, currency = "TRY", icon: Icon, tone = "neutral", showSign = true }: CashMetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
        tone === "green" && "border-emerald-200 bg-emerald-50/85",
        tone === "rose" && "border-rose-200 bg-rose-50/85",
        tone === "neutral" && "border-slate-200 bg-white/70"
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.10em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 truncate text-sm">
        <AmountText value={amount} currency={currency} showSign={showSign} />
      </p>
    </div>
  );
}
