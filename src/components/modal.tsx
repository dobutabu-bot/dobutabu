"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function Modal({ open, title, description, children, onOpenChange }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Pencereyi kapat" onClick={() => onOpenChange(false)} />
      <section className="scroll-y-stable relative max-h-[92dvh] w-full max-w-2xl rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-slate-950">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button type="button" className="icon-button shrink-0" aria-label="Kapat" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}
