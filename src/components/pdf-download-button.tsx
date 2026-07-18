"use client";

import { Download, FileText, LoaderCircle } from "lucide-react";
import { useId } from "react";

import { usePdfDownload } from "@/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

type PdfEndpointProps =
  | { endpoint: string; href?: never }
  | { endpoint?: never; href: string };

type PdfDownloadBaseProps = {
  fileNameFallback?: string;
  /** @deprecated Use fileNameFallback. */
  fallbackFileName?: string;
  label?: string;
  pendingLabel?: string;
  iconOnly?: boolean;
  variant?: "primary" | "secondary" | "dark";
  /** @deprecated Use variant. */
  tone?: "primary" | "secondary" | "dark";
  size?: "sm" | "md" | "lg" | "icon";
  disabled?: boolean;
  successMessage?: string;
  icon?: "download" | "file";
  className?: string;
};

export type PdfDownloadButtonProps = PdfDownloadBaseProps & PdfEndpointProps;

export function PdfDownloadButton({
  endpoint,
  href,
  label = "PDF indir",
  pendingLabel = "PDF hazırlanıyor",
  fileNameFallback,
  fallbackFileName,
  successMessage,
  iconOnly = false,
  variant,
  tone = "secondary",
  size = "md",
  disabled = false,
  icon = "download",
  className
}: PdfDownloadButtonProps) {
  const resolvedEndpoint = endpoint ?? href;
  const { downloadPdf, pending, error } = usePdfDownload({
    endpoint: resolvedEndpoint,
    fileNameFallback: fileNameFallback ?? fallbackFileName,
    successMessage
  });
  const errorId = `pdf-download-error-${useId()}`;
  const Icon = icon === "file" ? FileText : Download;
  const visibleLabel = pending ? pendingLabel : label;

  return (
    <>
      <button
        type="button"
        className={cn(
          pdfButtonVariant(variant ?? tone),
          pdfButtonSize(iconOnly ? "icon" : size),
          className
        )}
        disabled={disabled || pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        aria-label={iconOnly ? visibleLabel : undefined}
        title={iconOnly ? visibleLabel : undefined}
        onClick={() => void downloadPdf()}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        {iconOnly ? <span className="sr-only">{visibleLabel}</span> : <span>{visibleLabel}</span>}
      </button>
      {error ? <span id={errorId} className="sr-only">{error}</span> : null}
    </>
  );
}

export function PdfActionMenuItem({
  endpoint,
  href,
  label = "PDF indir",
  pendingLabel = "PDF hazırlanıyor",
  fileNameFallback,
  fallbackFileName,
  successMessage,
  disabled = false,
  className
}: Omit<PdfDownloadButtonProps, "iconOnly" | "variant" | "tone" | "size" | "icon">) {
  const resolvedEndpoint = endpoint ?? href;
  const { downloadPdf, pending, error } = usePdfDownload({
    endpoint: resolvedEndpoint,
    fileNameFallback: fileNameFallback ?? fallbackFileName,
    successMessage
  });
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
        disabled={disabled || pending}
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

function pdfButtonVariant(variant: NonNullable<PdfDownloadBaseProps["variant"]>) {
  if (variant === "primary") return "primary-action";
  if (variant === "dark") return "secondary-action border-white/15 bg-white/10 text-white hover:bg-white/15";
  return "secondary-action";
}

function pdfButtonSize(size: NonNullable<PdfDownloadBaseProps["size"]>) {
  if (size === "sm") return "min-h-11 gap-1.5 px-2.5 text-xs";
  if (size === "lg") return "min-h-12 gap-2 px-5 text-base";
  if (size === "icon") return "min-h-11 min-w-11 justify-center p-0";
  return "min-h-11 gap-2 px-3 text-sm";
}
