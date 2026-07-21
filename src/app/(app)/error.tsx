"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CHUNK_RECOVERY_WINDOW_MS = 15_000;

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunkLoadFailure = useMemo(
    () =>
      /ChunkLoadError|Loading chunk [0-9]+ failed|Failed to load chunk/i.test(
        `${error.name} ${error.message}`,
      ),
    [error.message, error.name],
  );
  const [recoveringChunk, setRecoveringChunk] = useState(chunkLoadFailure);

  useEffect(() => {
    if (!chunkLoadFailure) return;

    const retryKey = `buro-finans-chunk-boundary-v1:${window.location.pathname}`;
    const lastRetry = Number(window.sessionStorage.getItem(retryKey) ?? "0");
    if (Date.now() - lastRetry < CHUNK_RECOVERY_WINDOW_MS) {
      setRecoveringChunk(false);
      return;
    }

    window.sessionStorage.setItem(retryKey, String(Date.now()));
    const url = new URL(window.location.href);
    url.searchParams.set("__chunk_retry", String(Date.now()));
    window.location.replace(url.toString());
  }, [chunkLoadFailure]);

  if (recoveringChunk) {
    return (
      <section aria-live="polite" className="surface-dark flex min-h-[320px] items-center justify-center p-6">
        <p className="text-sm font-medium text-slate-200">Sayfa güvenli biçimde yeniden yükleniyor...</p>
      </section>
    );
  }

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
