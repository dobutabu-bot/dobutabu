import "dotenv/config";

import { createHmac } from "crypto";
import { unlink } from "fs/promises";
import path from "path";

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { documentStorageDirectory } from "../../src/lib/documents/local-storage";
import { PRIVACY_MODE_STORAGE_KEY } from "../../src/lib/ui/privacy";

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

test.describe("V3 privacy mode", () => {
  test("masks financial values, persists after reload and blurs document preview", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Gizlilik modu testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const guard = attachRuntimeGuard(page);
    await setSessionCookie(page, user!.id);
    let documentId: string | null = null;

    try {
      await page.goto("/dashboard");
      await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
      await expect(page.locator('[data-dashboard-version="v5"]')).toBeVisible();
      await expect(page.getByTestId("privacy-mode-toggle")).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator("html")).not.toHaveAttribute("data-privacy-mode", "on");

      await page.getByTestId("privacy-mode-toggle").click();
      await expect(page.getByTestId("privacy-mode-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-privacy-mode", "on");
      await expect.poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), PRIVACY_MODE_STORAGE_KEY)).toBe("1");
      await expect.poll(() => firstPrivacyMaskContent(page)).toContain("•••••");

      await page.reload();
      await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
      await expect(page.getByTestId("privacy-mode-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-privacy-mode", "on");

      documentId = await uploadPrivacyTestDocument(page);
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: "Güvenli Önizleme" })).toBeVisible();
      await expect(page.locator(".privacy-document-overlay").first()).toBeVisible();
      await expect.poll(() => documentPreviewFilter(page)).toContain("blur");

      await page.getByTestId("privacy-mode-toggle").click();
      await expect(page.locator("html")).toHaveAttribute("data-privacy-mode", "off");
      await expect(page.locator(".privacy-document-overlay").first()).toBeHidden();

      guard.assertClean();
    } finally {
      await cleanupDocument(user!.id, documentId);
    }
  });
});

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

async function firstPrivacyMaskContent(page: Page) {
  return page.locator(".privacy-amount").first().evaluate((element) => window.getComputedStyle(element, "::after").content);
}

async function documentPreviewFilter(page: Page) {
  return page.locator(".privacy-document-content").first().evaluate((element) => window.getComputedStyle(element).filter);
}

async function uploadPrivacyTestDocument(page: Page) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post("/api/documents/upload", {
    multipart: {
      title: `Gizlilik test belgesi ${stamp}`,
      documentType: "OTHER",
      amount: "12345.67",
      currency: "TRY",
      file: {
        name: `privacy-${stamp}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(`Tarih,Açıklama,Tutar\n2026-07-06,Gizlilik test ${stamp},12345.67\n`, "utf8")
      }
    }
  });

  const body = await response.text();
  expect(response.status(), body).toBe(200);
  const payload = JSON.parse(body) as { id?: string };
  expect(payload.id).toBeTruthy();
  return payload.id!;
}

async function cleanupDocument(userId: string, documentId: string | null) {
  if (!documentId) return;
  const document = await prisma.document.findFirst({ where: { userId, id: documentId }, select: { id: true, storagePath: true } });
  await prisma.auditLog.deleteMany({ where: { userId, entityId: documentId } });
  await prisma.documentProcessingLog.deleteMany({ where: { userId, documentId } });
  await prisma.documentTagOnDocument.deleteMany({ where: { documentId } });
  await prisma.document.deleteMany({ where: { userId, id: documentId } });

  if (document?.storagePath) {
    const fileName = document.storagePath.replace(/^documents\//, "");
    await unlink(path.join(documentStorageDirectory(), fileName)).catch(() => undefined);
  }
}
