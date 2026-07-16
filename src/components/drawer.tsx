"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  side?: "right" | "bottom";
  onOpenChange: (open: boolean) => void;
};

export function Drawer({ open, title, description, children, side = "right", onOpenChange }: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Paneli kapat" onClick={() => onOpenChange(false)} />
      <aside
        data-testid="drawer-panel"
        className={cn(
          "absolute z-10 flex min-h-0 min-w-0 flex-col bg-white/95 shadow-2xl backdrop-blur-2xl",
          side === "right"
            ? "inset-0 h-dvh w-full sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:max-w-[32rem] sm:rounded-l-3xl"
            : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl"
        )}
      >
        <div className="shrink-0 border-b border-slate-200/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] sm:border-b-0 sm:pb-0 sm:pt-4">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-slate-950">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button type="button" className="icon-button shrink-0" aria-label="Kapat" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
          </div>
        </div>
        <div className="scroll-y-stable min-h-0 min-w-0 flex-1 overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:pb-4">
          {children}
        </div>
      </aside>
    </div>,
    document.body
  );
}
