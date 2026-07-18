"use client";

import { Download, FileText, LoaderCircle } from "lucide-react";
import { useId } from "react";

import { usePdfDownload } from "@/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

type PdfDownloadButtonProps = {
  href: string;
  label?: string;
  pendingLabel?: string;
  fallbackFileName?: string;
  successMessage?: string;
  tone?: "primary" | "secondary" | "dark";
  icon?: "download" | "file";
  className?: string;
};

export function PdfDownloadButton({
  href,
  label = "PDF indir",
  pendingLabel = "PDF hazırlanıyor",
  fallbackFileName,
  successMessage,
  tone = "secondary",
  icon = "download",
  className
}: PdfDownloadButtonProps) {
  const { downloadPdf, pending, error } = usePdfDownload({ href, fallbackFileName, successMessage });
  const errorId = `pdf-download-error-${useId()}`;
  const Icon = icon === "file" ? FileText : Download;

  return (
    <>
      <button
        type="button"
        className={cn(pdfButtonTone(tone), "min-h-11 px-3", className)}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        onClick={() => void downloadPdf()}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        <span>{pending ? pendingLabel : label}</span>
      </button>
      {error ? <span id={errorId} className="sr-only">{error}</span> : null}
    </>
  );
}

export function PdfActionMenuItem({
  href,
  label = "PDF indir",
  pendingLabel = "PDF hazırlanıyor",
  fallbackFileName,
  successMessage,
  className
}: Omit<PdfDownloadButtonProps, "tone" | "icon">) {
  const { downloadPdf, pending, error } = usePdfDownload({ href, fallbackFileName, successMessage });
  const errorId = `pdf-download-error-${useId()}`;

  return (
    <>
      <button
        type="button"
        role="menuitem"
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-start gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-wait disabled:opacity-60",
          className
        )}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        onClick={() => void downloadPdf()}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        <span>{pending ? pendingLabel : label}</span>
      </button>
      {error ? <span id={errorId} className="sr-only">{error}</span> : null}
    </>
  );
}

function pdfButtonTone(tone: NonNullable<PdfDownloadButtonProps["tone"]>) {
  if (tone === "primary") return "primary-action";
  if (tone === "dark") return "secondary-action border-white/15 bg-white/10 text-white hover:bg-white/15";
  return "secondary-action";
}
