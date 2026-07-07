"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SearchResultsList } from "@/components/search/search-results-list";
import type { GlobalSearchData } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const emptyData: GlobalSearchData = { query: "", total: 0, groups: [] };

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<GlobalSearchData>(emptyData);
  const [loading, setLoading] = useState(false);
  const shortcutLabel = useMemo(() => "⌘K / Ctrl K", []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("tr-TR") === "k") {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const normalized = query.trim();
    if (normalized.length < 2) {
      setData({ query: normalized, total: 0, groups: [] });
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) return;
        const payload = (await response.json()) as GlobalSearchData;
        setData(payload);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setData({ query: normalized, total: 0, groups: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function submitSearch() {
    const normalized = query.trim();
    if (!normalized) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  return (
    <>
      <button
        type="button"
        className="hidden min-h-10 w-[min(24rem,34vw)] items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/75 px-3 text-left text-sm text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 lg:flex"
        onClick={() => setOpen(true)}
        aria-label="Akıllı aramayı aç"
        data-testid="global-search-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">Müvekkil, dosya, belge, banka hareketi ara...</span>
        </span>
        <kbd className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">{shortcutLabel}</kbd>
      </button>

      <button
        type="button"
        className="icon-button lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Akıllı aramayı aç"
        data-testid="global-search-mobile-trigger"
      >
        <Search className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 p-0 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Akıllı arama"
          data-testid="global-search-dialog"
        >
          <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Aramayı kapat" onClick={() => setOpen(false)} />
          <div className="relative mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(46rem,calc(100vh-2rem))] sm:rounded-3xl">
            <div className="border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Akıllı arama</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">Tüm sistemde ara</h2>
                </div>
                <button type="button" className="icon-button" aria-label="Aramayı kapat" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <form
                className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSearch();
                }}
              >
                <label className="relative block">
                  <span className="sr-only">Arama</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    ref={inputRef}
                    className="field min-h-12 pl-11 text-base"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Müvekkil, dosya no, tutar, belge metni, banka açıklaması, varlık sembolü..."
                    data-testid="global-search-input"
                  />
                </label>
                <button type="submit" className="primary-action min-h-12 justify-center px-5">
                  Ara
                </button>
              </form>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-4">
              <div className="mb-3 flex min-h-6 items-center justify-between gap-3 text-xs text-slate-500">
                <span>{query.trim().length >= 2 ? `${data.total} sonuç` : "En az 2 karakter yazın"}</span>
                {loading ? (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Aranıyor
                  </span>
                ) : null}
              </div>
              <SearchResultsList data={data} compact onNavigate={() => setOpen(false)} />
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <span className={cn("font-medium", query.trim().length >= 2 ? "text-slate-700" : "text-slate-500")}>Enter</span> ile tam arama sayfasını açabilirsiniz.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
