import { AmountText } from "@/components/amount-text";
import { TrendBadge } from "@/components/trend-badge";
import { cn, toNumber } from "@/lib/utils";

type FinanceDeltaProps = {
  label: string;
  value: unknown;
  currency?: string;
  percent?: unknown;
  detail?: string;
  className?: string;
};

export function FinanceDelta({ label, value, currency = "TRY", percent, detail, className }: FinanceDeltaProps) {
  const numericValue = toNumber(value);
  const direction = numericValue > 0 ? "up" : numericValue < 0 ? "down" : "flat";

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm backdrop-blur-xl", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          {detail ? <p className="mt-1 truncate text-xs text-slate-500">{detail}</p> : null}
        </div>
        {percent != null ? <TrendBadge value={formatPercent(percent)} direction={direction} /> : null}
      </div>
      <p className="mt-3">
        <AmountText value={numericValue} currency={currency} size="lg" variant="strong" />
      </p>
    </div>
  );
}

function formatPercent(value: unknown) {
  const numericValue = toNumber(value);

  if (numericValue === 0) {
    return "%0";
  }

  const sign = numericValue > 0 ? "+" : "-";
  return `${sign}%${Math.abs(numericValue).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}
