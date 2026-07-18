"use client";

import { useCallback, useRef, useState } from "react";

import { showToast } from "@/components/toast";

const MINIMUM_PDF_BYTES = 1_000;
const OBJECT_URL_LIFETIME_MS = 60_000;

type PdfDownloadOptions = {
  href: string;
  fallbackFileName?: string;
  successMessage?: string;
};

type PdfErrorPayload = {
  message?: unknown;
  requestId?: unknown;
  supportCode?: unknown;
};

export function usePdfDownload({
  href,
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
      const response = await fetch(href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/pdf"
        }
      });

      if (!response.ok) {
        throw await pdfDownloadError(response);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("Sunucu geçerli bir PDF dosyası döndürmedi.");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isValidPdf(bytes)) {
        throw new Error("İndirilen PDF boş veya geçersiz görünüyor.");
      }

      const fileName = pdfFileName(response.headers.get("content-disposition"), fallbackFileName);
      startBrowserDownload(bytes, fileName);
      showToast(successMessage);
      return true;
    } catch (downloadError) {
      const message = safeDownloadErrorMessage(downloadError);
      setError(message);
      showToast(message);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [fallbackFileName, href, successMessage]);

  return { downloadPdf, pending, error };
}

async function pdfDownloadError(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: PdfErrorPayload | null = null;

  if (contentType.includes("application/json")) {
    try {
      payload = (await response.json()) as PdfErrorPayload;
    } catch {
      payload = null;
    }
  }

  const message = safeServerMessage(payload?.message) ?? statusMessage(response.status);
  const supportCode = safeSupportCode(payload?.supportCode);
  const requestId = safeRequestId(payload?.requestId ?? response.headers.get("x-request-id"));
  const reference = supportCode ?? requestId;
  return new Error(reference ? `${message} Destek kodu: ${reference}` : message);
}

function statusMessage(status: number) {
  if (status === 400 || status === 422) return "PDF isteği veya rapor filtreleri geçersiz.";
  if (status === 401) return "Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.";
  if (status === 403) return "Bu PDF raporunu indirme yetkiniz bulunmuyor.";
  if (status === 404) return "PDF raporu bulunamadı veya kayıt kaldırılmış.";
  if (status === 409) return "Rapor henüz PDF üretimine hazır değil.";
  return "PDF şu anda indirilemedi. Lütfen tekrar deneyin.";
}

function safeServerMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 240) return null;
  if (/stack|prisma|database_url|auth_secret|session_secret|bearer|token/i.test(normalized)) return null;
  return normalized;
}

function safeRequestId(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9._-]{8,64}$/.test(value) ? value : null;
}

function safeSupportCode(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[A-Z]{2,12}-[A-Z0-9]{5,12}$/.test(value) ? value : null;
}

function safeDownloadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "PDF indirilirken bağlantı hatası oluştu.";
}

function isValidPdf(bytes: Uint8Array) {
  return (
    bytes.byteLength >= MINIMUM_PDF_BYTES &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function pdfFileName(contentDisposition: string | null, fallback: string) {
  const utf8Match = contentDisposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return sanitizePdfFileName(decodeURIComponent(stripQuotes(utf8Match[1])));
    } catch {
      // Fall back to the ASCII filename when the UTF-8 value is malformed.
    }
  }

  const asciiMatch = contentDisposition?.match(/filename\s*=\s*("[^"]*"|[^;]+)/i);
  return sanitizePdfFileName(asciiMatch?.[1] ? stripQuotes(asciiMatch[1]) : fallback);
}

function sanitizePdfFileName(value: string) {
  const normalized = value
    .replace(/[\r\n]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const withName = normalized || "rapor.pdf";
  return withName.toLowerCase().endsWith(".pdf") ? withName : `${withName}.pdf`;
}

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function startBrowserDownload(bytes: Uint8Array, fileName: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS);
}
