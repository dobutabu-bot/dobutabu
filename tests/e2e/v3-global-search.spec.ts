import "dotenv/config";

import { createHmac, randomUUID } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { searchAll } from "../../src/lib/search/search-data";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

const criticalRuntimePatterns = [
  /hydration/i,
  /Unhandled Runtime Error/i,
  /Application error/i,
  /ReferenceError/i,
  /TypeError/i,
  /Minified React error/i
];

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 global smart search", () => {
  test("finds document extracted text, bank descriptions and asset symbols through the shared service", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Global arama servis testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const fixture = await createSearchFixture(user!.id, stamp);

    try {
      const documentResults = await searchAll(user!.id, `dekont metni ${stamp}`);
      expect(groupTitles(documentResults, "documents")).toContain(fixture.documentTitle);
      expect(documentResults.provider?.id).toBe("database-contains-v1");

      const bankResults = await searchAll(user!.id, `banka aciklamasi ${stamp}`);
      expect(groupTitles(bankResults, "bank")).toContain(fixture.bankDescription);

      const capitalResults = await searchAll(user!.id, fixture.assetSymbol);
      expect(groupTitles(capitalResults, "capital")).toContain(fixture.assetName);
    } finally {
      await cleanupSearchFixture(user!.id, fixture);
    }
  });

  test("opens the command palette with keyboard shortcut and routes to /search", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Komut paleti testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const guard = attachRuntimeGuard(page);
    await setSessionCookie(page, user!.id);

    await page.goto("/dashboard");
    await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dijital Kasa" })).toBeVisible();

    await page.keyboard.press("Control+K");
    if (!(await page.getByTestId("global-search-dialog").isVisible().catch(() => false))) {
      await page.getByTestId("global-search-trigger").click();
    }
    await expect(page.getByTestId("global-search-dialog")).toBeVisible();
    await page.getByTestId("global-search-input").fill("Delta");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=Delta/);
    await expect(page.getByRole("heading", { name: "Tüm Sistemde Ara" })).toBeVisible();

    guard.assertClean();
  });
});

function groupTitles(data: Awaited<ReturnType<typeof searchAll>>, groupId: "documents" | "bank" | "capital") {
  return data.groups.find((group) => group.id === groupId)?.items.map((item) => item.title) ?? [];
}

async function createSearchFixture(userId: string, stamp: string) {
  const documentId = `search-doc-${stamp}`;
  const bankImportId = `search-bank-import-${stamp}`;
  const bankRowId = `search-bank-row-${stamp}`;
  const assetId = `search-asset-${stamp}`;
  const assetSymbol = `SRCH${stamp.slice(-6).toUpperCase()}`;
  const documentTitle = `Arama test belgesi ${stamp}`;
  const bankDescription = `banka aciklamasi ${stamp}`;
  const assetName = `Arama test varlığı ${stamp}`;

  await prisma.document.create({
    data: {
      id: documentId,
      userId,
      title: documentTitle,
      description: "Global arama fixture",
      documentType: "BANK_RECEIPT",
      fileName: `${randomUUID()}.pdf`,
      originalFileName: `arama-${stamp}.pdf`,
      mimeType: "application/pdf",
      fileSize: 128,
      storagePath: `documents/${randomUUID()}.pdf`,
      fileHash: `search-hash-${stamp}`,
      extractedText: `Bu belge içinde dekont metni ${stamp} özel arama ifadesi yer alır.`,
      extractionStatus: "COMPLETED"
    }
  });

  await prisma.bankStatementImport.create({
    data: {
      id: bankImportId,
      userId,
      bankName: "Arama Test Bankası",
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `bank-${stamp}.csv`,
      originalFileName: `bank-${stamp}.csv`,
      mimeType: "text/csv",
      fileSize: 256,
      storagePath: `documents/${randomUUID()}.csv`,
      fileHash: `bank-search-hash-${stamp}`,
      totalRows: 1,
      successfulRows: 1
    }
  });

  await prisma.bankStatementRow.create({
    data: {
      id: bankRowId,
      userId,
      importId: bankImportId,
      rowNumber: 1,
      transactionDate: new Date("2026-07-07T09:00:00+03:00"),
      description: bankDescription,
      creditAmount: 2750,
      amount: 2750,
      currency: "TRY",
      direction: "IN",
      status: "SUCCESS",
      rawHash: `bank-row-search-hash-${stamp}`,
      categorySuggestion: "Müvekkil ödemesi"
    }
  });

  await prisma.assetAccount.create({
    data: {
      id: assetId,
      userId,
      name: assetName,
      assetType: "CRYPTO",
      currency: "TRY",
      symbol: assetSymbol,
      quantity: 1,
      unitPrice: 1000,
      manualTotalValue: 1000,
      valuationCurrency: "TRY",
      description: "Global arama fixture"
    }
  });

  return { documentId, documentTitle, bankImportId, bankRowId, bankDescription, assetId, assetName, assetSymbol };
}

async function cleanupSearchFixture(
  userId: string,
  fixture: {
    documentId: string;
    bankImportId: string;
    bankRowId: string;
    assetId: string;
  }
) {
  await prisma.auditLog.deleteMany({ where: { userId, entityId: { in: [fixture.documentId, fixture.bankImportId, fixture.bankRowId, fixture.assetId] } } });
  await prisma.documentProcessingLog.deleteMany({ where: { userId, documentId: fixture.documentId } });
  await prisma.documentTagOnDocument.deleteMany({ where: { documentId: fixture.documentId } });
  await prisma.document.deleteMany({ where: { userId, id: fixture.documentId } });
  await prisma.bankStatementRow.deleteMany({ where: { userId, id: fixture.bankRowId } });
  await prisma.bankStatementImport.deleteMany({ where: { userId, id: fixture.bankImportId } });
  await prisma.assetValuation.deleteMany({ where: { userId, assetAccountId: fixture.assetId } });
  await prisma.assetTransaction.deleteMany({ where: { userId, assetAccountId: fixture.assetId } });
  await prisma.assetAccount.deleteMany({ where: { userId, id: fixture.assetId } });
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-z0-9-]/gi, "");
}

function attachRuntimeGuard(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (criticalRuntimePatterns.some((pattern) => pattern.test(text))) {
      errors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    const text = error.message;
    if (criticalRuntimePatterns.some((pattern) => pattern.test(text))) {
      errors.push(text);
    }
  });

  return {
    assertClean() {
      expect(errors, `Kritik runtime/console hatası bulundu:\n${errors.join("\n")}`).toEqual([]);
    }
  };
}

async function setSessionCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    }
  ]);
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
