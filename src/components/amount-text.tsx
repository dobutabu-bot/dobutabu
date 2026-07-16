import { serializeMoney } from "@/lib/serialization";
import { cn } from "@/lib/utils";

type AmountTextProps = {
  value: unknown;
  currency?: string;
  showSign?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "strong" | "muted" | "terminal";
  compact?: boolean;
  className?: string;
};

const sizeClasses = {
  xs: "text-[clamp(0.72rem,0.9vw,0.75rem)]",
  sm: "text-[clamp(0.78rem,1vw,0.875rem)]",
  md: "text-[clamp(0.875rem,1.2vw,1rem)]",
  lg: "text-[clamp(1rem,1.6vw,1.25rem)]",
  xl: "text-[clamp(1.25rem,2vw,2.25rem)]"
};

const variantClasses = {
  default: "font-semibold",
  strong: "font-bold",
  muted: "font-medium",
  terminal: "font-semibold tracking-normal"
};

export function AmountText({
  value,
  currency = "TRY",
  showSign = true,
  size = "md",
  variant = "default",
  compact = false,
  className
}: AmountTextProps) {
  const money = serializeMoney(value, currency);
  const numericValue = money.amount;
  const tone = numericValue > 0 ? "amount-positive" : numericValue < 0 ? "amount-negative" : "amount-neutral";
  const sign = showSign && numericValue > 0 ? "+" : showSign && numericValue < 0 ? "-" : "";
  const shouldCompact = compact || Math.abs(numericValue) >= 1_000_000;
  const displayValue = shouldCompact ? compactMoneyLabel(numericValue, currency, showSign) : showSign ? money.absoluteLabel : money.label;
  const fullLabel = `${sign}${showSign ? money.absoluteLabel : money.label}`;

  return (
    <span
      className={cn("tabular-finance privacy-amount inline-block max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-none", tone, sizeClasses[size], variantClasses[variant], className)}
      title={fullLabel}
      aria-label={fullLabel}
    >
      {shouldCompact ? null : sign}
      {displayValue}
    </span>
  );
}

function compactMoneyLabel(value: number, currency: string, showSign: boolean) {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value)}`;
}
