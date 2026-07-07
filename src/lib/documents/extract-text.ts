import type { DocumentExtractionStatus } from "@prisma/client";
import { createRequire } from "node:module";
import path from "node:path";

import { readPrivateDocumentFile } from "@/lib/document-storage";

export type ExtractableDocument = {
  mimeType: string;
  originalFileName: string;
  storagePath: string;
};

export type DocumentTextExtractionResult = {
  status: DocumentExtractionStatus;
  text: string | null;
  message: string;
};

const maxExtractedTextLength = 120_000;
const requirePdfParse = createRequire(import.meta.url);

const textLikeMimeTypes = new Set([
  "text/plain",
  "text/csv",
  "text/tab-separated-values",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml"
]);

const textLikeExtensions = new Set([".txt", ".csv", ".tsv", ".md", ".markdown", ".json", ".xml"]);

export async function extractDocumentTextFromStoredFile(document: ExtractableDocument): Promise<DocumentTextExtractionResult> {
  const buffer = await readPrivateDocumentFile(document.storagePath);

  if (isPdfDocument(document)) {
    return extractPdfTextLayer(buffer);
  }

  if (isTextLikeDocument(document)) {
    return extractTextLikeContent(buffer);
  }

  if (document.mimeType.startsWith("image/")) {
    return {
      status: "FAILED",
      text: null,
      message: "Görsel OCR desteği bu sürümde aktif değil. Kullanıcı manuel metadata girebilir."
    };
  }

  return {
    status: "NOT_PROCESSED",
    text: null,
    message: "Bu dosya türü için otomatik metin çıkarma uygulanmadı."
  };
}

export function isPdfDocument(document: Pick<ExtractableDocument, "mimeType" | "originalFileName">) {
  return document.mimeType === "application/pdf" || document.originalFileName.toLowerCase().endsWith(".pdf");
}

export function isTextLikeDocument(document: Pick<ExtractableDocument, "mimeType" | "originalFileName">) {
  const extension = path.extname(document.originalFileName).toLowerCase();
  return textLikeMimeTypes.has(document.mimeType) || textLikeExtensions.has(extension);
}

export async function extractPdfTextLayer(buffer: Buffer): Promise<DocumentTextExtractionResult> {
  let parser: { getText: (params?: { pageJoiner?: string }) => Promise<{ text?: string }>; destroy: () => Promise<void> } | null = null;

  try {
    const { PDFParse } = requirePdfParse("pdf-parse") as {
      PDFParse: {
        new (input: { data: Buffer }): {
          getText: (params?: { pageJoiner?: string }) => Promise<{ text?: string }>;
          destroy: () => Promise<void>;
        };
        setWorker?: (workerSrc?: string) => string;
      };
    };

    PDFParse.setWorker?.(path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs"));
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText({ pageJoiner: "\n\n" });
    const text = normalizeExtractedText(parsed.text ?? "");

    if (!text) {
      return {
        status: "FAILED",
        text: null,
        message: "PDF içinde seçilebilir metin bulunamadı. Görsel PDF olabilir; manuel metadata girilebilir."
      };
    }

    return {
      status: "COMPLETED",
      text,
      message: `PDF metni çıkarıldı. ${formatCharacterCount(text.length)} karakter arama için indekslendi.`
    };
  } catch {
    return {
      status: "FAILED",
      text: null,
      message: "PDF metni çıkarılamadı. Belge kaydı korundu; manuel metadata girilebilir."
    };
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

export async function extractTextLikeContent(buffer: Buffer): Promise<DocumentTextExtractionResult> {
  try {
    const text = normalizeExtractedText(new TextDecoder("utf-8", { fatal: false }).decode(buffer));

    if (!text) {
      return {
        status: "FAILED",
        text: null,
        message: "Metin benzeri içerikte çıkarılabilir metin bulunamadı."
      };
    }

    return {
      status: "COMPLETED",
      text,
      message: `Metin içeriği çıkarıldı. ${formatCharacterCount(text.length)} karakter arama için indekslendi.`
    };
  } catch {
    return {
      status: "FAILED",
      text: null,
      message: "Metin içeriği çıkarılamadı. Belge kaydı korundu; manuel metadata girilebilir."
    };
  }
}

export function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxExtractedTextLength);
}

function formatCharacterCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}
