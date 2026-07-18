"use client";

import { useCallback, useRef, useState } from "react";

import { showToast } from "@/components/toast";
import {
  downloadPdf as startPdfDownload,
  safePdfDownloadErrorMessage
} from "@/lib/pdf/download-pdf";

type PdfDownloadOptions = {
  endpoint?: string;
  href?: string;
  fileNameFallback?: string;
  fallbackFileName?: string;
  successMessage?: string;
};

export function usePdfDownload({
  endpoint,
  href,
  fileNameFallback,
  fallbackFileName = "rapor.pdf",
  successMessage = "PDF indirme işlemi başlatıldı."
}: PdfDownloadOptions) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const downloadPdf = useCallback(async () => {
    if (pendingRef.current) return false;

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const resolvedEndpoint = endpoint ?? href;
      if (!resolvedEndpoint) {
        throw new Error("PDF endpoint yapılandırması eksik.");
      }

      await startPdfDownload({
        endpoint: resolvedEndpoint,
        fileNameFallback: fileNameFallback ?? fallbackFileName
      });
      showToast(successMessage);
      return true;
    } catch (downloadError) {
      const message = safePdfDownloadErrorMessage(downloadError);
      setError(message);
      showToast(message);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [endpoint, fallbackFileName, fileNameFallback, href, successMessage]);

  return { downloadPdf, pending, error };
}
