import type { LucideIcon } from "lucide-react";
import Link from "@/components/app-link";

import { cn } from "@/lib/utils";

type QuickActionButtonProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "negative" | "info" | "warning";
  className?: string;
};

const toneClasses = {
  default: "bg-slate-950 text-white",
  positive: "bg-emerald-700 text-white",
  negative: "bg-rose-700 text-white",
  info: "bg-blue-700 text-white",
  warning: "bg-amber-600 text-white"
};

export function QuickActionButton({ href, label, icon: Icon, tone = "default", className }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10", toneClasses[tone], className)}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
