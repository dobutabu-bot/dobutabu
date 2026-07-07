import type { Document } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { readPrivateDocumentFile } from "@/lib/document-storage";
import { createSimpleJobQueue, type JobSnapshot } from "@/lib/jobs/job-queue";
import { isSupportedOcrImage, tesseractOcrAdapter, type OcrAdapter, type OcrRecognitionResult } from "@/lib/ocr/tesseract-adapter";
import { prisma } from "@/lib/prisma";

export type DocumentOcrJobResult = {
  documentId: string;
  extractionStatus: "COMPLETED" | "FAILED";
  message: string;
  textLength: number;
  adapter: string;
  durationMs: number;
};

export type QueueDocumentOcrInput = {
  userId: string;
  documentId: string;
  timeoutMs?: number;
  adapter?: OcrAdapter;
};

const defaultDocumentOcrTimeoutMs = Number(process.env.DOCUMENT_OCR_JOB_TIMEOUT_MS || 75_000);
const documentOcrQueue = createSimpleJobQueue({
  name: "document-ocr",
  concurrency: Number(process.env.DOCUMENT_OCR_CONCURRENCY || 1),
  defaultTimeoutMs: defaultDocumentOcrTimeoutMs
});

export async function queueDocumentOcr(input: QueueDocumentOcrInput): Promise<JobSnapshot<DocumentOcrJobResult>> {
  const key = documentOcrJobKey(input.userId, input.documentId);
  const existing = documentOcrQueue.findActiveByKey<DocumentOcrJobResult>(key);

  if (existing) {
    return existing;
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: input.documentId },
      data: { extractionStatus: "PROCESSING" }
    });

    await tx.documentProcessingLog.create({
      data: {
        userId: input.userId,
        documentId: input.documentId,
        status: "PROCESSING",
        message: "OCR işi kuyruğa alındı. Görsel metin çıkarma arka planda çalışacak."
      }
    });
  });

  return documentOcrQueue.enqueue<DocumentOcrJobResult>({
    key,
    timeoutMs: input.timeoutMs ?? defaultDocumentOcrTimeoutMs,
    run: () => processDocumentOcrJob(input)
  });
}

export function getDocumentOcrJob(jobId: string) {
  return documentOcrQueue.get<DocumentOcrJobResult>(jobId);
}

export async function processDocumentOcrJob(input: QueueDocumentOcrInput): Promise<DocumentOcrJobResult> {
  const adapter = input.adapter ?? tesseractOcrAdapter;
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, userId: input.userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      mimeType: true,
      originalFileName: true,
      storagePath: true,
      extractedText: true
    }
  });

  if (!document) {
    throw new DocumentOcrJobError("Belge bulunamadı.");
  }

  if (!isSupportedOcrImage(document.mimeType)) {
    return markOcrFailed(input.userId, document, "OCR yalnızca PNG ve JPEG görseller için çalışır. PDF OCR için görsele dönüştürme entegrasyonu bu sürümde yok.");
  }

  await prisma.documentProcessingLog.create({
    data: {
      userId: input.userId,
      documentId: document.id,
      status: "PROCESSING",
      message: `${adapter.name} OCR işlemi başladı.`
    }
  });

  const buffer = await readPrivateDocumentFile(document.storagePath);
  const result = await adapter.recognize({
    buffer,
    mimeType: document.mimeType,
    originalFileName: document.originalFileName,
    timeoutMs: input.timeoutMs
  });

  await persistOcrResult(input.userId, document, result, adapter.name);

  return {
    documentId: document.id,
    extractionStatus: result.status,
    message: result.message,
    textLength: result.text?.length ?? 0,
    adapter: adapter.name,
    durationMs: result.durationMs
  };
}

export function isOcrSupportedDocument(document: Pick<Document, "mimeType">) {
  return isSupportedOcrImage(document.mimeType);
}

function documentOcrJobKey(userId: string, documentId: string) {
  return `document-ocr:${userId}:${documentId}`;
}

async function markOcrFailed(
  userId: string,
  document: Pick<Document, "id" | "extractedText">,
  message: string
): Promise<DocumentOcrJobResult> {
  const startedAt = Date.now();
  const result: OcrRecognitionResult = {
    status: "FAILED",
    text: null,
    message,
    durationMs: Date.now() - startedAt
  };

  await persistOcrResult(userId, document, result, "none");

  return {
    documentId: document.id,
    extractionStatus: "FAILED",
    message,
    textLength: 0,
    adapter: "none",
    durationMs: result.durationMs
  };
}

async function persistOcrResult(
  userId: string,
  document: Pick<Document, "id" | "extractedText">,
  result: OcrRecognitionResult,
  adapterName: string
) {
  const nextText = result.status === "COMPLETED" ? result.text : document.extractedText;
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: result.status,
        extractedText: nextText
      }
    });

    await tx.documentProcessingLog.create({
      data: {
        userId,
        documentId: document.id,
        status: result.status,
        message: `${adapterName}: ${result.message}`.slice(0, 500)
      }
    });

    return updated;
  });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: document.id,
    action: "UPDATE",
    oldValue: document,
    newValue: updated,
    message: result.status === "COMPLETED" ? "Belge OCR metni çıkarıldı" : "Belge OCR işlemi tamamlanamadı",
    userId
  });
}

export class DocumentOcrJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentOcrJobError";
  }
}
