import { createHmac } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";

import { LocalDocumentStorage } from "../../src/lib/documents/local-storage";
import { createStoredDocumentName, DocumentUploadError } from "../../src/lib/documents/storage";
import { hashBuffer } from "../../src/lib/documents/hash";
import { validateUploadedDocumentFile } from "../../src/lib/documents/validate-upload";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 private document storage", () => {
  test("local adapter writes UUID files and blocks path traversal", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Storage unit testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const root = await mkdtemp(path.join(os.tmpdir(), "buro-finans-documents-"));
    const storage = new LocalDocumentStorage(root);
    const fileName = createStoredDocumentName(".pdf");

    expect(fileName).toMatch(/^[0-9a-f-]{36}\.pdf$/i);

    try {
      const result = await storage.write({ fileName, buffer: Buffer.from("%PDF-private") });
      expect(result.storagePath).toBe(`documents/${fileName}`);

      const buffer = await storage.read(result.storagePath);
      expect(buffer.toString("utf8")).toBe("%PDF-private");
      expect(storage.resolvePhysicalPath(result.storagePath)).toBe(path.join(root, fileName));

      await expect(storage.write({ fileName: "../evil.pdf", buffer: Buffer.from("x") })).rejects.toBeInstanceOf(DocumentUploadError);
      await expect(storage.read("../evil.pdf")).rejects.toBeInstanceOf(DocumentUploadError);
      await expect(storage.read("documents/../../evil.pdf")).rejects.toBeInstanceOf(DocumentUploadError);
      await expect(storage.read("documents/not-a-uuid.pdf")).rejects.toBeInstanceOf(DocumentUploadError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("document upload and private file routes reject unauthorized requests", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Auth route testi tek projede çalışır.");

    const documentsPage = await request.get("/documents", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(documentsPage.status());

    const download = await request.get("/api/documents/not-existing/download");
    expect(download.status()).toBe(401);

    const preview = await request.get("/api/documents/not-existing/preview");
    expect(preview.status()).toBe(401);

    const upload = await request.post("/api/documents/upload", {
      multipart: {
        title: "Yetkisiz deneme",
        file: {
          name: "yetkisiz.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF")
        }
      }
    });
    expect(upload.status()).toBe(401);
  });

  test("upload validation accepts allowed signatures and rejects spoofed or oversized files", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Upload validation testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const allowedFiles = [
      makeFile(Buffer.from("%PDF-1.4\n%%EOF"), "ornek.pdf", "application/pdf"),
      makeFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), "ornek.jpg", "image/jpeg"),
      makeFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]), "ornek.png", "image/png"),
      makeFile(Buffer.from("tarih,tutar\n2026-07-06,100\n"), "ornek.csv", "text/csv"),
      makeFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), "ornek.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ];

    for (const file of allowedFiles) {
      await expect(validateUploadedDocumentFile(file, 1024 * 1024)).resolves.toMatchObject({
        originalFileName: file.name,
        mimeType: file.type
      });
    }

    await expect(validateUploadedDocumentFile(makeFile(Buffer.from("%PDF-1.4"), "spoof.png", "image/png"), 1024)).rejects.toBeInstanceOf(DocumentUploadError);
    await expect(validateUploadedDocumentFile(makeFile(Buffer.from("%PDF-1.4"), "buyuk.pdf", "application/pdf"), 4)).rejects.toBeInstanceOf(DocumentUploadError);
  });

  test("upload API detects duplicate SHA-256 hash and leaves explicit relink option", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Upload API duplicate testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const client = await prisma.client.findFirst({ where: { userId: user!.id, deletedAt: null }, select: { id: true } });
    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = Date.now().toString();
    const buffer = Buffer.from(`%PDF-1.4\n% E2E duplicate ${stamp}\n%%EOF`);
    const file = { name: `e2e-duplicate-${stamp}.pdf`, mimeType: "application/pdf", buffer };
    const title = `E2E duplicate belge ${stamp}`;
    let documentId: string | null = null;

    try {
      const first = await request.post("/api/documents/upload", {
        headers: { cookie },
        multipart: { title, documentType: "OTHER", file }
      });
      expect(first.status(), await first.text()).toBe(200);
      const firstPayload = (await first.json()) as { id: string };
      documentId = firstPayload.id;

      const second = await request.post("/api/documents/upload", {
        headers: { cookie },
        multipart: { title, documentType: "OTHER", file }
      });
      expect(second.status()).toBe(409);
      const duplicatePayload = (await second.json()) as {
        duplicate: boolean;
        duplicateDocumentId: string;
        canRelink: boolean;
        allowedDuplicateActions: string[];
      };
      expect(duplicatePayload).toMatchObject({
        duplicate: true,
        duplicateDocumentId: documentId,
        canRelink: true
      });
      expect(duplicatePayload.allowedDuplicateActions).toContain("link_existing");
      expect(hashBuffer(buffer)).toHaveLength(64);

      if (client) {
        const relink = await request.post("/api/documents/upload", {
          headers: { cookie },
          multipart: {
            title,
            documentType: "OTHER",
            duplicateAction: "link_existing",
            linkedClientId: client.id,
            file
          }
        });
        expect(relink.status(), await relink.text()).toBe(200);
        const updated = await prisma.document.findUnique({ where: { id: documentId }, select: { linkedClientId: true } });
        expect(updated?.linkedClientId).toBe(client.id);
      }
    } finally {
      if (documentId) {
        await prisma.document.updateMany({ where: { id: documentId }, data: { deletedAt: new Date() } });
      }
    }
  });

  test("PDF, image and CSV preview/download stay private and soft deleted documents disappear from list", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Preview testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    await setSessionCookie(page, user!.id);
    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = Date.now().toString();
    const pdfTitle = `E2E PDF preview ${stamp}`;
    const imageTitle = `E2E görsel preview ${stamp}`;
    const csvTitle = `E2E CSV preview ${stamp}`;
    const createdIds: string[] = [];

    try {
      const pdfId = await uploadDocument(request, cookie, {
        title: pdfTitle,
        name: `${pdfTitle}.pdf`,
        mimeType: "application/pdf",
        buffer: await createPdfBuffer("V3 PDF preview testi")
      });
      createdIds.push(pdfId);

      const imageId = await uploadDocument(request, cookie, {
        title: imageTitle,
        name: `${imageTitle}.png`,
        mimeType: "image/png",
        buffer: onePixelPng()
      });
      createdIds.push(imageId);

      const csvId = await uploadDocument(request, cookie, {
        title: csvTitle,
        name: `${csvTitle}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from("tarih,tutar,aciklama\n2026-07-06,100,Test tahsilat\n")
      });
      createdIds.push(csvId);

      await expectPrivatePreview(request, cookie, pdfId, "application/pdf");
      await expectPrivatePreview(request, cookie, imageId, "image/png");
      await expectPrivatePreview(request, cookie, csvId, "text/csv");

      const download = await request.get(`/api/documents/${pdfId}/download`, { headers: { cookie } });
      expect(download.ok()).toBeTruthy();
      expect(download.headers()["content-disposition"]).toContain("attachment");
      expect(await download.text()).not.toContain("storage/documents");

      await page.goto(`/documents/${pdfId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("PDF.js önizleme")).toBeVisible();

      await page.goto(`/documents/${csvId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("cell", { name: "tarih" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "100" })).toBeVisible();

      await page.goto(`/documents?q=${encodeURIComponent(csvTitle)}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(csvTitle).first()).toBeVisible();

      await prisma.document.update({ where: { id: csvId }, data: { deletedAt: new Date() } });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(csvTitle)).toHaveCount(0);
    } finally {
      if (createdIds.length > 0) {
        await prisma.document.updateMany({ where: { id: { in: createdIds } }, data: { deletedAt: new Date() } });
      }
    }
  });

  test("documents can be linked, unlinked and excluded from missing-document report without deleting the file", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Belge bağlantı testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const client = await prisma.client.findFirst({
      where: { userId: user!.id, deletedAt: null, archivedAt: null },
      select: { id: true, name: true }
    });
    test.skip(!client, "Aktif müvekkil bulunamadı.");

    await setSessionCookie(page, user!.id);
    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = Date.now().toString();
    const description = `E2E belgesiz tahsilat ${stamp}`;
    let documentId: string | null = null;
    let incomeId: string | null = null;

    try {
      const income = await prisma.income.create({
        data: {
          userId: user!.id,
          clientId: client!.id,
          amount: new Prisma.Decimal("123.45"),
          currency: "TRY",
          date: new Date(),
          paymentMethod: "BANK_TRANSFER",
          category: "LEGAL_FEE",
          description
        }
      });
      incomeId = income.id;

      documentId = await uploadDocument(request, cookie, {
        title: `E2E link belge ${stamp}`,
        name: `e2e-link-${stamp}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(`tarih,tutar,aciklama\n2026-07-06,123.45,${description}\n`)
      });

      const linkResponse = await request.post("/api/documents/links", {
        headers: { cookie },
        data: { documentId, entityType: "INCOME", entityId: incomeId }
      });
      expect(linkResponse.status(), await linkResponse.text()).toBe(200);
      await expect(page.goto(`/collections/${incomeId}`, { waitUntil: "domcontentloaded" })).resolves.toBeTruthy();
      await expect(page.getByText("Belge Bağlantıları")).toBeVisible();
      await expect(page.getByText(`E2E link belge ${stamp}`).first()).toBeVisible();

      const linkedDocument = await prisma.document.findUnique({
        where: { id: documentId },
        select: { linkedIncomeId: true, deletedAt: true }
      });
      expect(linkedDocument).toMatchObject({ linkedIncomeId: incomeId, deletedAt: null });

      const unlinkResponse = await request.delete("/api/documents/links", {
        headers: { cookie },
        data: { documentId, entityType: "INCOME", entityId: incomeId }
      });
      expect(unlinkResponse.status(), await unlinkResponse.text()).toBe(200);
      const unlinkedDocument = await prisma.document.findUnique({
        where: { id: documentId },
        select: { linkedIncomeId: true, deletedAt: true }
      });
      expect(unlinkedDocument).toMatchObject({ linkedIncomeId: null, deletedAt: null });

      await page.goto("/documents/missing", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("link", { name: description })).toBeVisible();

      const requirementResponse = await request.post("/api/documents/requirements", {
        headers: { cookie },
        data: { entityType: "INCOME", entityId: incomeId }
      });
      expect(requirementResponse.status(), await requirementResponse.text()).toBe(200);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(description)).toHaveCount(0);

      const markedIncome = await prisma.income.findUnique({
        where: { id: incomeId },
        select: { documentNotRequired: true }
      });
      expect(markedIncome?.documentNotRequired).toBe(true);
    } finally {
      if (documentId) {
        await prisma.document.updateMany({ where: { id: documentId }, data: { deletedAt: new Date() } });
      }
      if (incomeId) {
        await prisma.income.updateMany({ where: { id: incomeId }, data: { deletedAt: new Date() } });
      }
    }
  });

  test("unlinked documents page lists documents with no record links", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Bağsız belge testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    await setSessionCookie(page, user!.id);
    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = Date.now().toString();
    const title = `E2E bağsız belge ${stamp}`;
    let documentId: string | null = null;

    try {
      documentId = await uploadDocument(request, cookie, {
        title,
        name: `e2e-unlinked-${stamp}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from("tarih,tutar,aciklama\n2026-07-06,88,Baglantisiz belge\n")
      });

      await page.goto("/documents/unlinked", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Bağsız Belgeler")).toBeVisible();
      await expect(page.getByRole("link", { name: title })).toBeVisible();
    } finally {
      if (documentId) {
        await prisma.document.updateMany({ where: { id: documentId }, data: { deletedAt: new Date() } });
      }
    }
  });
});

function makeFile(buffer: Buffer, name: string, type: string) {
  return new File([buffer], name, { type });
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

async function setSessionCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: TEST_BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    }
  ]);
}

async function uploadDocument(
  request: APIRequestContext,
  cookie: string,
  input: { title: string; name: string; mimeType: string; buffer: Buffer }
) {
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

  expect(response.status(), await response.text()).toBe(200);
  const payload = (await response.json()) as { id: string };
  return payload.id;
}

async function expectPrivatePreview(request: APIRequestContext, cookie: string, documentId: string, contentType: string) {
  const unauthorized = await request.get(`/api/documents/${documentId}/preview`);
  expect(unauthorized.status()).toBe(401);

  const response = await request.get(`/api/documents/${documentId}/preview`, { headers: { cookie } });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain(contentType);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("storage/documents");
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
