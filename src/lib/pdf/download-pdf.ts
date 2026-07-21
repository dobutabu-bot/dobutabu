"use client";

import { pdfFileNameFromContentDisposition } from "@/lib/pdf/content-disposition";

const MINIMUM_PDF_BYTES = 1_000;
const OBJECT_URL_LIFETIME_MS = 60_000;

type DownloadPdfOptions = {
  endpoint: string;
  fileNameFallback?: string;
};

type PdfErrorPayload = {
  message?: unknown;
  requestId?: unknown;
  supportCode?: unknown;
};

export class PdfDownloadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "PdfDownloadError";
  }
}

export async function downloadPdf({
  endpoint,
  fileNameFallback = "rapor.pdf"
}: DownloadPdfOptions) {
  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/pdf"
    }
  });

  if (!response.ok) {
    throw await createPdfDownloadError(response);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new PdfDownloadError("PDF hazırlanamadı. Lütfen tekrar deneyin.", 500);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isValidPdf(bytes)) {
    throw new PdfDownloadError("PDF hazırlanamadı. Lütfen tekrar deneyin.", 500);
  }

  const fileName = pdfFileNameFromContentDisposition(
    response.headers.get("content-disposition"),
    fileNameFallback
  );
  startBrowserDownload(bytes, fileName);

  return { fileName };
}

export function safePdfDownloadErrorMessage(error: unknown) {
  if (error instanceof PdfDownloadError && error.message) return error.message;
  return "PDF hazırlanamadı. Lütfen tekrar deneyin.";
}

async function createPdfDownloadError(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: PdfErrorPayload | null = null;

  if (contentType.includes("application/json")) {
    try {
      payload = (await response.json()) as PdfErrorPayload;
    } catch {
      payload = null;
    }
  }

  const message = statusMessage(response.status) ?? safeServerMessage(payload?.message);
  const supportCode = safeSupportCode(payload?.supportCode);
  const requestId = safeRequestId(
    payload?.requestId ?? response.headers.get("x-request-id")
  );
  const reference = supportCode ?? requestId;
  const safeMessage = message ?? "PDF hazırlanamadı. Lütfen tekrar deneyin.";

  return new PdfDownloadError(
    reference ? `${safeMessage} Destek kodu: ${reference}` : safeMessage,
    response.status
  );
}

function statusMessage(status: number) {
  if (status === 400) return "PDF isteği geçerli değil.";
  if (status === 401) return "Oturumunuz sona erdi. Yeniden giriş yapınız.";
  if (status === 403) return "Bu raporu indirmek için yetkiniz bulunmuyor.";
  if (status === 404) return "Rapor kaydı bulunamadı.";
  if (status === 409) return "Bu kayıt için rapor şu anda oluşturulamıyor.";
  if (status === 422) return "Rapor parametreleri geçerli değil.";
  if (status >= 500) return "PDF hazırlanamadı. Lütfen tekrar deneyin.";
  return null;
}

function safeServerMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 240) return null;
  if (
    /stack|prisma|database_url|auth_secret|session_secret|bearer|token/i.test(
      normalized
    )
  ) {
    return null;
  }
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
