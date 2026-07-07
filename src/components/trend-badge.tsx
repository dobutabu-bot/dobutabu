import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn, toNumber } from "@/lib/utils";

type TrendBadgeProps = {
  value: unknown;
  label?: string;
  direction?: "up" | "down" | "flat";
  trend?: "up" | "down" | "flat";
  className?: string;
};

const trendClasses = {
  up: "border-emerald-200 bg-emerald-50 text-emerald-800",
  down: "border-rose-200 bg-rose-50 text-rose-800",
  flat: "border-slate-200 bg-slate-100 text-slate-700"
};

export function TrendBadge({ value, trend, direction, label, className }: TrendBadgeProps) {
  const resolvedDirection = direction ?? trend ?? directionFromValue(value);
  const Icon = resolvedDirection === "up" ? ArrowUpRight : resolvedDirection === "down" ? ArrowDownRight : ArrowRight;
  const displayValue = formatTrendValue(value);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
        trendClasses[resolvedDirection],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{label ? `${label}: ${displayValue}` : displayValue}</span>
    </span>
  );
}

function directionFromValue(value: unknown): "up" | "down" | "flat" {
  const numericValue = toNumber(value);
  if (numericValue > 0) return "up";
  if (numericValue < 0) return "down";
  return "flat";
}

function formatTrendValue(value: unknown) {
  if (value == null || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    return value > 0 ? `+${value}` : String(value);
  }

  return String(value);
}
