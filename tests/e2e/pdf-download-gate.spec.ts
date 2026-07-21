import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PDFParse } from "pdf-parse";

const prisma = new PrismaClient();
const testEmail = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";
const supportedProjects = new Set([
  "chromium-desktop",
  "firefox-desktop",
  "webkit-desktop",
  "android",
  "iphone"
]);

const reportTargets = [
  { label: "Aylık PDF", path: "/api/reports/monthly/pdf" },
  { label: "Kasa PDF", path: "/api/reports/cash/pdf" },
  { label: "Belge PDF", path: "/api/reports/documents/pdf" },
  { label: "Banka PDF", path: "/api/reports/bank-statements/pdf" },
  { label: "Mutabakat PDF", path: "/api/reports/reconciliation/pdf" },
  { label: "Sermaye PDF", path: "/api/reports/capital/pdf" }
];

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.beforeEach(({}, testInfo) => {
  test.skip(!supportedProjects.has(testInfo.project.name), "PDF download kalite kapısı seçili browser projelerinde çalışır.");
});

test("rapor merkezindeki PDF bağlantıları gerçek browser download üretir ve parse edilir", async ({ page }) => {
  test.setTimeout(180_000);

  const user = await prisma.user.findUnique({
    where: { email: testEmail },
    select: { id: true }
  });
  expect(user, `CI fixture kullanıcısı bulunamadı: ${testEmail}`).toBeTruthy();

  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionToken(user!.id),
      url: new URL("/", baseUrl).toString(),
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60
    }
  ]);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/reports", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Dijital Finans Analiz Merkezi" })).toBeVisible();

  for (const target of reportTargets) {
    const control = page
      .getByRole("button", { name: target.label, exact: true })
      .or(page.getByRole("link", { name: target.label, exact: true }))
      .first();
    await expect(control, `${target.label} indirme kontrolü görünür olmalı`).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      control.click()
    ]);

    expect(download.suggestedFilename(), `${target.label} dosya adı`).toMatch(/\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath, `${target.label} disk yolu`).toBeTruthy();

    const bytes = await readFile(downloadPath!);
    expect(bytes.subarray(0, 5).toString("utf8"), `${target.label} PDF imzası`).toBe("%PDF-");
    expect(bytes.byteLength, `${target.label} minimum boyut`).toBeGreaterThan(1_000);

    const parser = new PDFParse({ data: bytes });
    try {
      const parsed = await parser.getText();
      expect(parsed.pages.length, `${target.label} sayfa sayısı`).toBeGreaterThan(0);
      expect(parsed.text.trim().length, `${target.label} metin içeriği`).toBeGreaterThan(20);
    } finally {
      await parser.destroy();
    }
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    })
  ).toString("base64url");

  return `${payload}.${createHmac("sha256", authSecret()).update(payload).digest("base64url")}`;
}

function authSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}
