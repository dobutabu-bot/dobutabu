import { createHmac } from "crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 document text extraction", () => {
  test("extracts text-layer PDF content without breaking upload", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Extraction API testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const expectedText = `Metinli PDF extraction testi ${stamp}`;
    let documentId: string | null = null;

    try {
      const response = await uploadDocument(request, cookie, {
        title: `E2E metinli PDF ${stamp}`,
        name: `e2e-text-layer-${stamp}.pdf`,
        mimeType: "application/pdf",
        buffer: await createPdfBuffer(expectedText)
      });
      expect(response.extractionStatus).toBe("COMPLETED");
      documentId = response.id;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { extractionStatus: true, extractedText: true }
      });
      expect(document?.extractionStatus).toBe("COMPLETED");
      expect(document?.extractedText).toContain(expectedText);

      const completedLog = await prisma.documentProcessingLog.findFirst({
        where: { documentId, status: "COMPLETED", message: { contains: "PDF metni çıkarıldı" } }
      });
      expect(completedLog).toBeTruthy();
    } finally {
      await softDeleteDocument(documentId);
    }
  });

  test("extracts CSV text-like content for search metadata", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Extraction API testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const csvText = `tarih,tutar,aciklama\n2026-07-06,4500,CSV metin extraction ${stamp}\n`;
    let documentId: string | null = null;

    try {
      const response = await uploadDocument(request, cookie, {
        title: `E2E CSV extraction ${stamp}`,
        name: `e2e-csv-extraction-${stamp}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(csvText, "utf8")
      });
      expect(response.extractionStatus).toBe("COMPLETED");
      documentId = response.id;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { extractionStatus: true, extractedText: true }
      });
      expect(document?.extractionStatus).toBe("COMPLETED");
      expect(document?.extractedText).toContain(`CSV metin extraction ${stamp}`);
    } finally {
      await softDeleteDocument(documentId);
    }
  });

  test("keeps upload successful when extraction fails for image OCR placeholder", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Extraction API testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    let documentId: string | null = null;

    try {
      const response = await uploadDocument(request, cookie, {
        title: `E2E OCR kapalı ${stamp}`,
        name: `e2e-ocr-disabled-${stamp}.png`,
        mimeType: "image/png",
        buffer: onePixelPng()
      });
      expect(response.extractionStatus).toBe("FAILED");
      documentId = response.id;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { extractionStatus: true, extractedText: true }
      });
      expect(document?.extractionStatus).toBe("FAILED");
      expect(document?.extractedText).toBeNull();

      const failedLog = await prisma.documentProcessingLog.findFirst({
        where: { documentId, status: "FAILED", message: { contains: "OCR desteği" } }
      });
      expect(failedLog).toBeTruthy();
    } finally {
      await softDeleteDocument(documentId);
    }
  });

  test("reprocess endpoint reruns extraction and updates logs", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Extraction API testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const expectedText = `Reprocess PDF extraction ${stamp}`;
    let documentId: string | null = null;

    try {
      const response = await uploadDocument(request, cookie, {
        title: `E2E reprocess PDF ${stamp}`,
        name: `e2e-reprocess-${stamp}.pdf`,
        mimeType: "application/pdf",
        buffer: await createPdfBuffer(expectedText)
      });
      documentId = response.id;

      await prisma.document.update({
        where: { id: documentId },
        data: { extractionStatus: "NOT_PROCESSED", extractedText: null }
      });

      const reprocess = await request.post(`/api/documents/${documentId}/reprocess`, { headers: { cookie } });
      const reprocessBody = await reprocess.text();
      expect(reprocess.status(), reprocessBody).toBe(200);
      const payload = JSON.parse(reprocessBody) as { extractionStatus: string; message: string };
      expect(payload.extractionStatus).toBe("COMPLETED");

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { extractionStatus: true, extractedText: true }
      });
      expect(document?.extractionStatus).toBe("COMPLETED");
      expect(document?.extractedText).toContain(expectedText);

      const logCount = await prisma.documentProcessingLog.count({
        where: { documentId, status: { in: ["PROCESSING", "COMPLETED"] } }
      });
      expect(logCount).toBeGreaterThanOrEqual(4);
    } finally {
      await softDeleteDocument(documentId);
    }
  });
});

type UploadDocumentInput = {
  title: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
};

type UploadDocumentResponse = {
  id: string;
  extractionStatus: string;
  extractionMessage: string;
};

async function uploadDocument(request: APIRequestContext, cookie: string, input: UploadDocumentInput) {
  const response = await request.post("/api/documents/upload", {
    headers: { cookie },
    multipart: {
      title: input.title,
      documentType: "OTHER",
      file: {
        name: input.name,
        mimeType: input.mimeType,
        buffer: input.buffer
      }
    }
  });

  const body = await response.text();
  expect(response.status(), body).toBe(200);
  return JSON.parse(body) as UploadDocumentResponse;
}

async function softDeleteDocument(documentId: string | null) {
  if (!documentId) {
    return;
  }

  await prisma.document.updateMany({ where: { id: documentId }, data: { deletedAt: new Date() } });
}

function createSessionTokenForTest(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    })
  ).toString("base64url");

  return `${payload}.${createHmac("sha256", testAuthSecret()).update(payload).digest("base64url")}`;
}

function testAuthSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createPdfBuffer(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(16).text(text);
    doc.end();
  });
}

function onePixelPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
}
