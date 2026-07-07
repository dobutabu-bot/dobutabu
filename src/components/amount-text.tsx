import { serializeMoney } from "@/lib/serialization";
import { cn } from "@/lib/utils";

type AmountTextProps = {
  value: unknown;
  currency?: string;
  showSign?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "strong" | "muted" | "terminal";
  className?: string;
};

const sizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl"
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
  className
}: AmountTextProps) {
  const money = serializeMoney(value, currency);
  const numericValue = money.amount;
  const tone = numericValue > 0 ? "amount-positive" : numericValue < 0 ? "amount-negative" : "amount-neutral";
  const sign = showSign && numericValue > 0 ? "+" : showSign && numericValue < 0 ? "-" : "";
  const displayValue = showSign ? money.absoluteLabel : money.label;

  return (
    <span className={cn("tabular-finance privacy-amount", tone, sizeClasses[size], variantClasses[variant], className)}>
      {sign}
      {displayValue}
    </span>
  );
}
