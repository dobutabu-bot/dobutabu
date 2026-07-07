"use client";

import { Loader2, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useId } from "react";

import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  loading?: boolean;
  error?: string | null;
  confirmIcon?: LucideIcon;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Vazgeç",
  tone = "danger",
  loading = false,
  error,
  confirmIcon: ConfirmIcon = Trash2,
  onConfirm,
  onOpenChange
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const ActiveIcon = loading ? Loader2 : ConfirmIcon;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Onay penceresini kapat"
        onClick={() => {
          if (!loading) onOpenChange(false);
        }}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-950">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="icon-button shrink-0"
            aria-label="Kapat"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? (
          <p id={errorId} className="mt-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="secondary-action"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              tone === "danger" ? "bg-rose-700 hover:bg-rose-800" : "bg-slate-950 hover:bg-slate-800"
            )}
            onClick={onConfirm}
            disabled={loading}
          >
            <ActiveIcon className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            {loading ? "İşleniyor" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
