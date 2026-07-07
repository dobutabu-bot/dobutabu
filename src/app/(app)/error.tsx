"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;

  return (
    <section className="surface-dark flex min-h-[320px] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-semibold text-white">İşlem tamamlanamadı</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Sayfa yüklenirken beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Tekrar dene
        </button>
      </div>
    </section>
  );
}
