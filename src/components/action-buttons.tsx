"use client";

import { Eye, type LucideIcon } from "lucide-react";
import Link from "@/components/app-link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ActionButtonsProps = {
  children?: ReactNode;
  className?: string;
  detailHref?: string;
  detailLabel?: string;
};

type ActionButtonProps = {
  label: string;
  icon: LucideIcon;
  type?: "button" | "submit";
  tone?: "neutral" | "danger" | "primary";
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
};

export function ActionButtons({ children, className, detailHref, detailLabel = "Detay" }: ActionButtonsProps) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center justify-end gap-2", className)}>
      {detailHref ? (
        <Link href={detailHref} className={actionButtonClass("primary")}>
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {detailLabel}
        </Link>
      ) : null}
      {children}
    </div>
  );
}

export function ActionButton({
  label,
  icon: Icon,
  type = "button",
  tone = "neutral",
  className,
  disabled,
  ariaLabel,
  onClick
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(actionButtonClass(tone), className)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function actionButtonClass(tone: NonNullable<ActionButtonProps["tone"]>) {
  const base =
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "danger") {
    return cn(base, "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-200");
  }

  if (tone === "primary") {
    return cn(base, "bg-slate-950 text-white hover:bg-slate-800 focus-visible:ring-slate-300");
  }

  return cn(base, "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300");
}
