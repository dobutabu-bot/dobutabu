"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

type FormModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
};

export function FormModal({ open, title, children, description, onOpenChange }: FormModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button
        type="button"
        className="absolute inset-0 hidden h-full w-full cursor-default sm:block"
        aria-label="Düzenleme penceresini kapat"
        onClick={() => onOpenChange(false)}
      />
      <div className="scroll-y-stable relative flex h-dvh w-full flex-col bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-2xl backdrop-blur-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-3xl sm:p-4">
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/90 px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-2xl sm:static sm:mb-4 sm:bg-transparent sm:shadow-none">
          <div className="min-w-0">
            <span className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" aria-hidden />
            <h2 id={titleId} className="truncate text-base font-semibold text-slate-950">
              {title}
            </h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button type="button" className="icon-button shrink-0" aria-label="Kapat" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
