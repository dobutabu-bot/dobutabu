import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusPillTone = "green" | "rose" | "amber" | "blue" | "neutral";

type StatusPillProps = {
  children: ReactNode;
  tone?: StatusPillTone;
  prefix?: string;
};

const toneClasses: Record<StatusPillTone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-slate-200 bg-slate-100 text-slate-700"
};

export function StatusPill({ children, tone = "neutral", prefix }: StatusPillProps) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", toneClasses[tone])}>
      {prefix ? <span aria-hidden>{prefix}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
