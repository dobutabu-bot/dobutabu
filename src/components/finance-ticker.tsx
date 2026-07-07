import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { cn } from "@/lib/utils";

export type FinanceTickerItem = {
  label: string;
  value: string;
  tone: "green" | "rose" | "amber" | "neutral";
};

type FinanceTickerProps = {
  items: FinanceTickerItem[];
  variant?: "dark" | "light";
};

export function FinanceTicker({ items, variant = "dark" }: FinanceTickerProps) {
  return (
    <div className={cn("scroll-x-stable flex gap-2", variant === "dark" ? "px-3 py-3" : "py-1")}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-2 px-3.5 text-sm transition duration-200",
            variant === "dark"
              ? "digital-chip"
              : "border-white/70 bg-white/80 backdrop-blur-xl"
          )}
        >
          <span className={variant === "dark" ? "text-slate-400" : "text-slate-500"}>{item.label}</span>
          <PrivacyAmount className={cn("font-semibold tabular-nums", tickerToneClass(item.tone, variant))}>{item.value}</PrivacyAmount>
        </div>
      ))}
    </div>
  );
}

function tickerToneClass(tone: FinanceTickerItem["tone"], variant: "dark" | "light") {
  if (variant === "dark") {
    return {
      green: "text-emerald-300",
      rose: "text-rose-300",
      amber: "text-amber-300",
      neutral: "text-slate-300"
    }[tone];
  }

  return {
    green: "text-emerald-800",
    rose: "text-rose-800",
    amber: "text-amber-800",
    neutral: "text-slate-600"
  }[tone];
}
