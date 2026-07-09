import type { DocumentExtractionStatus } from "@prisma/client";
import { spawn } from "node:child_process";
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
const maxPdfWorkerOutputBytes = 140_000;
const pdfWorkerTimeoutMs = 15_000;

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
  try {
    const text = normalizeExtractedText(await extractPdfTextInWorker(buffer));

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
  }
}

async function extractPdfTextInWorker(buffer: Buffer): Promise<string> {
  const workerPath = path.join(process.cwd(), "src/lib/documents/pdf-text-worker.cjs");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      settle(new Error("PDF text worker timed out"));
      child.kill("SIGKILL");
    }, pdfWorkerTimeoutMs);

    function settle(error: Error | null, value = "") {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      if (Buffer.concat(stdoutChunks).length < maxPdfWorkerOutputBytes) {
        stdoutChunks.push(chunk);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.concat(stderrChunks).length < 8_000) {
        stderrChunks.push(chunk);
      }
    });

    child.on("error", (error) => settle(error));
    child.stdin.on("error", (error) => settle(error));
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        const message = Buffer.concat(stderrChunks).toString("utf8").trim() || `PDF text worker exited with ${code}`;
        settle(new Error(message));
        return;
      }

      try {
        const payload = JSON.parse(Buffer.concat(stdoutChunks).toString("utf8")) as { text?: string };
        settle(null, payload.text ?? "");
      } catch {
        settle(new Error("PDF text worker returned invalid output"));
      }
    });

    child.stdin.end(buffer);
  });
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
