import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { createStoredDocumentName, writePrivateDocumentFile } from "../../src/lib/document-storage";
import { hashBuffer } from "../../src/lib/documents/hash";
import { processDocumentOcrJob } from "../../src/lib/jobs/document-ocr-job";
import { createSimpleJobQueue, type JobSnapshot, type SimpleJobQueue } from "../../src/lib/jobs/job-queue";
import type { OcrAdapter } from "../../src/lib/ocr/tesseract-adapter";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 optional document OCR worker", () => {
  test("JPG receipt OCR job stores extracted text and processing logs", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "OCR job testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const buffer = minimalJpeg();
    const stamp = uniqueStamp();
    const storedName = createStoredDocumentName(".jpg");
    const storagePath = await writePrivateDocumentFile(storedName, buffer);
    const document = await prisma.document.create({
      data: {
        userId: user!.id,
        title: `E2E JPG fiş OCR ${stamp}`,
        documentType: "EXPENSE_RECEIPT",
        fileName: storedName,
        originalFileName: `fis-${stamp}.jpg`,
        mimeType: "image/jpeg",
        fileSize: buffer.length,
        storagePath,
        fileHash: hashBuffer(buffer)
      }
    });
    const adapter: OcrAdapter = {
      name: "fake-tesseract",
      supportedMimeTypes: ["image/jpeg"],
      async recognize(input) {
        expect(input.mimeType).toBe("image/jpeg");
        expect(input.buffer.equals(buffer)).toBeTruthy();
        return {
          status: "COMPLETED",
          text: `JPG fiş OCR sonucu ${stamp}`,
          message: "Fake OCR tamamlandı.",
          durationMs: 12
        };
      }
    };

    try {
      const result = await processDocumentOcrJob({
        userId: user!.id,
        documentId: document.id,
        adapter,
        timeoutMs: 1_000
      });

      expect(result.extractionStatus).toBe("COMPLETED");
      expect(result.textLength).toBeGreaterThan(0);

      const updated = await prisma.document.findUnique({
        where: { id: document.id },
        select: { extractionStatus: true, extractedText: true }
      });
      expect(updated?.extractionStatus).toBe("COMPLETED");
      expect(updated?.extractedText).toContain(`JPG fiş OCR sonucu ${stamp}`);

      const completedLog = await prisma.documentProcessingLog.findFirst({
        where: { documentId: document.id, status: "COMPLETED", message: { contains: "fake-tesseract" } }
      });
      expect(completedLog).toBeTruthy();
    } finally {
      await prisma.document.updateMany({ where: { id: document.id }, data: { deletedAt: new Date() } });
    }
  });

  test("job queue marks OCR-like long jobs as failed on timeout", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Queue timeout testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const queue = createSimpleJobQueue({ name: `timeout-${uniqueStamp()}`, concurrency: 1, defaultTimeoutMs: 10 });
    const job = queue.enqueue({
      key: `timeout-${uniqueStamp()}`,
      timeoutMs: 10,
      run: async () => {
        await delay(80);
        return "late";
      }
    });

    const completed = await waitForTerminalJob<string>(queue, job.id);
    expect(completed.status).toBe("FAILED");
    expect(completed.error).toContain("zaman aşımına");
  });

  test("job queue keeps OCR concurrency under control", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Queue concurrency testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const queue = createSimpleJobQueue({ name: `concurrency-${uniqueStamp()}`, concurrency: 1, defaultTimeoutMs: 1_000 });
    let running = 0;
    let maxRunning = 0;
    const jobs = [1, 2, 3].map((index) =>
      queue.enqueue({
        key: `concurrency-${index}-${uniqueStamp()}`,
        run: async () => {
          running += 1;
          maxRunning = Math.max(maxRunning, running);
          await delay(25);
          running -= 1;
          return index;
        }
      })
    );

    const completed = await Promise.all(jobs.map((job) => waitForTerminalJob<number>(queue, job.id)));
    expect(completed.every((job) => job.status === "COMPLETED")).toBeTruthy();
    expect(maxRunning).toBe(1);
  });
});

async function waitForTerminalJob<TResult>(queue: SimpleJobQueue, jobId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 3_000) {
    const job = queue.get<TResult>(jobId);
    if (job && (job.status === "COMPLETED" || job.status === "FAILED")) {
      return job as JobSnapshot<TResult>;
    }
    await delay(10);
  }

  throw new Error("Job terminal duruma geçmedi.");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function minimalJpeg() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
}
