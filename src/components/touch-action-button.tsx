"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TouchActionButtonTone = "default" | "danger" | "primary" | "success";

type TouchActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: TouchActionButtonTone;
  iconOnly?: boolean;
};

export function TouchActionButton({
  tone = "default",
  iconOnly = false,
  className,
  type = "button",
  children,
  ...props
}: TouchActionButtonProps) {
  return (
    <button type={type} className={touchActionButtonClass(tone, iconOnly, className)} {...props}>
      {children}
    </button>
  );
}

export function touchActionButtonClass(tone: TouchActionButtonTone = "default", iconOnly = false, className?: string) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold leading-none transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60";
  const iconOnlyClass = iconOnly ? "min-w-11 px-0" : "min-w-0";

  if (tone === "danger") {
    return cn(
      base,
      iconOnlyClass,
      "border border-rose-200 bg-rose-50 text-rose-700 shadow-[0_10px_24px_rgba(190,18,60,0.08)] hover:bg-rose-100 focus-visible:ring-rose-500/20",
      className
    );
  }

  if (tone === "primary" || tone === "success") {
    return cn(
      base,
      iconOnlyClass,
      "bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.20)] hover:brightness-110 focus-visible:ring-slate-900/10",
      className
    );
  }

  return cn(
    base,
    iconOnlyClass,
    "border border-white/70 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl hover:bg-white focus-visible:ring-slate-900/10",
    className
  );
}
