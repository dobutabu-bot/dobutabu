import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, test } from "node:test";

import { Prisma } from "@prisma/client";

import { hashBuffer } from "@/lib/documents/hash";
import { documentStorageDirectory, LocalDocumentStorage } from "@/lib/documents/local-storage";
import { createStoredDocumentName } from "@/lib/documents/storage";
import { validateUploadedDocumentFile } from "@/lib/documents/validate-upload";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session";

const runId = `document-security-${Date.now()}-${process.pid}`;
const baseUrl = process.env.DOCUMENT_SECURITY_BASE_URL ?? "http://localhost:3010";
const storage = new LocalDocumentStorage();
const createdStoragePaths = new Set<string>();
const createdDocumentIds = new Set<string>();

let userId: string | null = null;
let clientId: string | null = null;
let incomeId: string | null = null;
let cookieHeader = "";

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("document storage rejects path traversal and unsafe storage names", async () => {
  const unsafePaths = [
    "../../.env",
    "../package.json",
    "documents/../../.env",
    "documents/../package.json",
    "/etc/passwd",
    "documents/not-a-uuid.pdf",
    "documents/12345678-1234-1234-9234-123456789abc.env"
  ];

  for (const storagePath of unsafePaths) {
    assert.throws(() => storage.resolvePhysicalPath(storagePath), /güvenli değil|desteklenmiyor/, storagePath);
  }
});

test("document upload validation rejects MIME spoofing and oversized files", async () => {
  await assert.rejects(
    () => validateUploadedDocumentFile(new File([Buffer.from("%PDF-1.4\n")], "spoof.jpg", { type: "image/jpeg" }), 1024),
    /MIME tipiyle uyuşm/
  );
  await assert.rejects(
    () => validateUploadedDocumentFile(new File([Buffer.from("MZ executable payload")], "spoof.pdf", { type: "application/pdf" }), 1024),
    /MIME tipiyle uyuşm/
  );
  await assert.rejects(
    () => validateUploadedDocumentFile(new File([validPdfBuffer()], "large.pdf", { type: "application/pdf" }), 4),
    /Dosya boyutu çok büyük/
  );
});

test("document files are not stored under public directory", () => {
  assert.equal(existsSync(join(process.cwd(), "public", "documents")), false);
  assert.equal(documentStorageDirectory().includes(join(process.cwd(), "public")), false);
});

test("document API security gates", async (t) => {
  const available = await isServerAvailable();
  if (!available) {
    t.skip(`${baseUrl} çalışmadığı için API entegrasyon testleri atlandı.`);
    return;
  }

  await createFixture();
  const document = await createStoredDocument({ linkedIncomeId: incomeId });

  await t.test("auth olmadan download ve preview kapalıdır", async () => {
    const [download, preview] = await Promise.all([
      fetch(`${baseUrl}/api/documents/${document.id}/download`),
      fetch(`${baseUrl}/api/documents/${document.id}/preview`)
    ]);

    assert.equal(download.status, 401);
    assert.equal(preview.status, 401);
  });

  await t.test("auth olan download private header döner ve path sızdırmaz", async () => {
    const response = await fetch(`${baseUrl}/api/documents/${document.id}/download`, {
      headers: { cookie: cookieHeader }
    });
    const body = Buffer.from(await response.arrayBuffer()).toString("utf8");
    const headerDump = [...response.headers.entries()].map(([key, value]) => `${key}: ${value}`).join("\n");

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
    assert.match(body, /%PDF-1.4/);
    assertNoSensitivePathLeak(`${headerDump}\n${body}`, document.storagePath);
  });

  await t.test("auth olan preview private inline header döner", async () => {
    const response = await fetch(`${baseUrl}/api/documents/${document.id}/preview`, {
      headers: { cookie: cookieHeader }
    });
    const headerDump = [...response.headers.entries()].map(([key, value]) => `${key}: ${value}`).join("\n");

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.match(response.headers.get("content-disposition") ?? "", /inline/);
    assertNoSensitivePathLeak(headerDump, document.storagePath);
  });

  await t.test("URL path traversal ve public storage/backup route erişimi başarılı olmaz", async () => {
    const traversalTargets = [
      `${baseUrl}/api/documents/../../.env/download`,
      `${baseUrl}/api/documents/../package.json/preview`,
      `${baseUrl}/storage/documents/${document.fileName}`,
      `${baseUrl}/backups/v3-document-security.zip`,
      `${baseUrl}/api/backup`
    ];

    for (const url of traversalTargets) {
      const response = await fetch(url, { headers: url.endsWith("/api/backup") ? {} : { cookie: cookieHeader } });
      assert.notEqual(response.status, 200, url);
      const body = await response.text();
      assertNoSensitivePathLeak(body, document.storagePath);
    }

    const documentPageLikePath = await fetch(`${baseUrl}/documents/${document.fileName}`, { headers: { cookie: cookieHeader } });
    const documentPageContentType = documentPageLikePath.headers.get("content-type") ?? "";
    const documentPageBody = await documentPageLikePath.text();
    assert.equal(documentPageContentType.includes("application/pdf"), false);
    assert.equal(documentPageBody.includes("%PDF-1.4"), false);
    assertNoSensitivePathLeak(documentPageBody, document.storagePath);
  });

  await t.test("upload API MIME spoofing dosyalarını reddeder", async () => {
    const jpgForm = new FormData();
    jpgForm.set("title", `${runId} spoof jpg`);
    jpgForm.set("documentType", "OTHER");
    jpgForm.set("file", new File([Buffer.from("%PDF-1.4\n")], "spoof.jpg", { type: "image/jpeg" }));

    const pdfForm = new FormData();
    pdfForm.set("title", `${runId} spoof pdf`);
    pdfForm.set("documentType", "OTHER");
    pdfForm.set("file", new File([Buffer.from("MZ executable payload")], "spoof.pdf", { type: "application/pdf" }));

    const [jpgResponse, pdfResponse] = await Promise.all([
      fetch(`${baseUrl}/api/documents/upload`, { method: "POST", headers: { cookie: cookieHeader }, body: jpgForm }),
      fetch(`${baseUrl}/api/documents/upload`, { method: "POST", headers: { cookie: cookieHeader }, body: pdfForm })
    ]);

    assert.equal(jpgResponse.status, 400);
    assert.equal(pdfResponse.status, 400);
  });

  await t.test("duplicate hash uyarısı döner", async () => {
    const first = await uploadValidPdf("duplicate-a.pdf");
    assert.equal(first.status, 200);
    const firstJson = (await first.json()) as { id?: string };
    assert.ok(firstJson.id);
    createdDocumentIds.add(firstJson.id);

    const second = await uploadValidPdf("duplicate-b.pdf");
    const secondJson = (await second.json()) as { duplicate?: boolean; canRelink?: boolean };
    assert.equal(second.status, 409);
    assert.equal(secondJson.duplicate, true);
    assert.equal(secondJson.canRelink, true);
  });

  await t.test("belge silme soft delete yapar ve silinmiş belge indirilemez", async () => {
    const softDeleteTarget = await createStoredDocument();
    const response = await fetch(`${baseUrl}/api/documents/${softDeleteTarget.id}`, {
      method: "DELETE",
      headers: { cookie: cookieHeader }
    });
    assert.equal(response.status, 200);

    const deleted = await prisma.document.findUniqueOrThrow({ where: { id: softDeleteTarget.id } });
    assert.ok(deleted.deletedAt);

    const download = await fetch(`${baseUrl}/api/documents/${softDeleteTarget.id}/download`, {
      headers: { cookie: cookieHeader }
    });
    assert.equal(download.status, 404);
  });

  await t.test("belge bağlantısı kaldırılınca belge silinmez", async () => {
    assert.ok(incomeId);
    const linked = await createStoredDocument({ linkedIncomeId: incomeId });
    const response = await fetch(`${baseUrl}/api/documents/links`, {
      method: "DELETE",
      headers: {
        cookie: cookieHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify({ documentId: linked.id, entityType: "INCOME", entityId: incomeId })
    });
    assert.equal(response.status, 200);

    const unlinked = await prisma.document.findUniqueOrThrow({ where: { id: linked.id } });
    assert.equal(unlinked.deletedAt, null);
    assert.equal(unlinked.linkedIncomeId, null);
  });
});

async function createFixture() {
  if (userId) return;

  const user = await prisma.user.create({
    data: {
      name: "Document Security Test",
      email: `${runId}@example.test`,
      passwordHash: hashPassword("DocumentSecurity2026!")
    }
  });
  userId = user.id;
  cookieHeader = `${SESSION_COOKIE}=${createTestSessionToken(user.id)}`;

  const client = await prisma.client.create({
    data: {
      userId,
      name: `${runId} anonim müvekkil`,
      type: "COMPANY",
      notes: "V3 belge güvenliği test datası"
    }
  });
  clientId = client.id;

  const income = await prisma.income.create({
    data: {
      userId,
      clientId,
      amount: new Prisma.Decimal("1000.00"),
      currency: "TRY",
      date: new Date(),
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: `${runId} belge bağlantı testi`
    }
  });
  incomeId = income.id;
}

async function createStoredDocument(input: { linkedIncomeId?: string | null } = {}) {
  assert.ok(userId);
  const fileName = createStoredDocumentName(".pdf");
  const buffer = validPdfBuffer(fileName);
  const result = await storage.write({ fileName, buffer });
  createdStoragePaths.add(result.storagePath);

  const document = await prisma.document.create({
    data: {
      userId,
      title: `${runId} güvenli belge`,
      description: "Belge güvenliği test kaydı",
      documentType: "RECEIPT",
      fileName,
      originalFileName: `${runId}.pdf`,
      mimeType: "application/pdf",
      fileSize: buffer.byteLength,
      storagePath: result.storagePath,
      fileHash: hashBuffer(buffer),
      linkedIncomeId: input.linkedIncomeId ?? null
    }
  });
  createdDocumentIds.add(document.id);
  return document;
}

async function uploadValidPdf(fileName: string) {
  const form = new FormData();
  form.set("title", `${runId} duplicate`);
  form.set("documentType", "RECEIPT");
  form.set("file", new File([validPdfBuffer("api-duplicate-payload")], fileName, { type: "application/pdf" }));
  return fetch(`${baseUrl}/api/documents/upload`, {
    method: "POST",
    headers: { cookie: cookieHeader },
    body: form
  });
}

async function isServerAvailable() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function cleanup() {
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.documentTagOnDocument.deleteMany({ where: { documentId: { in: [...createdDocumentIds] } } });
    await prisma.documentProcessingLog.deleteMany({ where: { userId } });
    await prisma.document.deleteMany({ where: { userId } });
    await prisma.income.deleteMany({ where: { userId } });
    await prisma.client.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  await Promise.all(
    [...createdStoragePaths].map(async (storagePath) => {
      try {
        await rm(storage.resolvePhysicalPath(storagePath), { force: true });
      } catch {
        // Test temizliği ana sonucu etkilememeli.
      }
    })
  );
}

function validPdfBuffer(label = "default") {
  return Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n`, "utf8");
}

function createTestSessionToken(currentUserId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: currentUserId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    })
  ).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}

function assertNoSensitivePathLeak(value: string, storagePath: string) {
  assert.equal(value.includes(documentStorageDirectory()), false, "Response gerçek storage root yolunu içermemeli.");
  assert.equal(value.includes(storagePath), false, "Response private storagePath değerini içermemeli.");
  assert.equal(value.includes("DATABASE_URL"), false, "Response .env içeriği sızdırmamalı.");
  assert.equal(value.includes("SESSION_SECRET"), false, "Response session secret sızdırmamalı.");
  assert.equal(value.includes("AUTH_SECRET"), false, "Response auth secret sızdırmamalı.");
}
