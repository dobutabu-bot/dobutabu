"use client";

import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getViewport(input: { scale: number }): { width: number; height: number };
    render(input: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
      transform?: number[];
    }): { promise: Promise<void>; cancel: () => void };
  }>;
  destroy(): Promise<void>;
};

type LoadingTask = {
  promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void>;
};

type PdfModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(input: { url: string; withCredentials: boolean }): LoadingTask;
};

type PdfJsViewerProps = {
  url: string;
  title: string;
};

export function PdfJsViewer({ url, title }: PdfJsViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.05);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("PDF yükleniyor...");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: LoadingTask | null = null;

    async function loadPdf() {
      setStatus("loading");
      setMessage("PDF yükleniyor...");

      try {
        const pdfjs = (await import("pdfjs-dist")) as PdfModule;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url, withCredentials: true });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          await pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageNumber(1);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("PDF önizlemesi oluşturulamadı. Dosyayı indirerek görüntüleyebilirsiniz.");
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      void loadingTask?.destroy().catch(() => undefined);
      void pdfRef.current?.destroy().catch(() => undefined);
      pdfRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;

    async function renderPage() {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;

      if (!pdf || !canvas || status !== "ready") {
        return;
      }

      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas context oluşturulamadı.");
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
        });
        await renderTask.promise;
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("PDF sayfası çizilemedi. Dosyayı indirerek görüntüleyebilirsiniz.");
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, scale, status]);

  const canGoBack = pageNumber > 1;
  const canGoForward = pageNumber < pageCount;

  return (
    <div className="bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">PDF.js önizleme</p>
          <p className="mt-1 max-w-xl truncate text-sm font-medium">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="secondary-action min-h-11 border-white/15 bg-white/10 px-3 text-white hover:bg-white/15" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={!canGoBack}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Önceki
          </button>
          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums">
            {pageCount ? `${pageNumber}/${pageCount}` : "-"}
          </span>
          <button type="button" className="secondary-action min-h-11 border-white/15 bg-white/10 px-3 text-white hover:bg-white/15" onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))} disabled={!canGoForward}>
            Sonraki
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="PDF uzaklaştır" className="icon-button border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setScale((current) => Math.max(0.65, Number((current - 0.15).toFixed(2))))}>
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="PDF yakınlaştır" className="icon-button border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setScale((current) => Math.min(1.9, Number((current + 0.15).toFixed(2))))}>
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-[520px] overflow-auto p-4">
        {status === "loading" ? (
          <div className="m-auto flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {message}
          </div>
        ) : null}
        {status === "error" ? (
          <div className="m-auto max-w-md rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-center text-sm leading-6 text-amber-50">
            {message}
          </div>
        ) : null}
        <canvas ref={canvasRef} className={status === "ready" ? "mx-auto rounded-2xl bg-white shadow-2xl" : "hidden"} />
      </div>
    </div>
  );
}
