import type { DocumentExtractionStatus } from "@prisma/client";

import { extractDocumentTextFromStoredFile } from "@/lib/documents/extract-text";
import { prisma } from "@/lib/prisma";

export type DocumentExtractionResult = {
  status: DocumentExtractionStatus;
  text: string | null;
  message: string;
};

export async function processDocumentExtraction(userId: string, documentId: string): Promise<DocumentExtractionResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, deletedAt: null },
    select: {
      id: true,
      mimeType: true,
      originalFileName: true,
      storagePath: true
    }
  });

  if (!document) {
    throw new DocumentExtractionError("Belge bulunamadı.");
  }

  await setExtractionState(userId, document.id, "PROCESSING", "Belge metin çıkarma işlemi başladı.");

  const result = await extractDocumentTextFromStoredFile(document);

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: result.status,
        extractedText: result.text
      }
    });

    await tx.documentProcessingLog.create({
      data: {
        userId,
        documentId: document.id,
        status: result.status,
        message: result.message
      }
    });
  });

  return result;
}

export async function tryProcessDocumentExtraction(userId: string, documentId: string) {
  try {
    return await processDocumentExtraction(userId, documentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Metin çıkarma sırasında beklenmeyen hata oluştu.";
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { extractionStatus: "FAILED", extractedText: null }
      });

      await tx.documentProcessingLog.create({
        data: {
          userId,
          documentId,
          status: "FAILED",
          message: safeLogMessage(message)
        }
      });
    });

    return {
      status: "FAILED" as const,
      text: null,
      message: safeLogMessage(message)
    };
  }
}

async function setExtractionState(userId: string, documentId: string, status: DocumentExtractionStatus, message: string) {
  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { extractionStatus: status }
    });

    await tx.documentProcessingLog.create({
      data: {
        userId,
        documentId,
        status,
        message
      }
    });
  });
}

function safeLogMessage(message: string) {
  return message.slice(0, 500);
}

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}
