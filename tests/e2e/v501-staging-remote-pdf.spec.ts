import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

test("mevcut PDF yuzeyleri gercek UI indirmesiyle acilir", async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await login(page);

  const clientHref = await findOptionalDetailHref(page, "/clients", /^\/clients\/[^/?#]+$/);
  const caseHref = await findOptionalDetailHref(page, "/cases", /^\/cases\/[^/?#]+$/);
  const collectionHref = await findOptionalDetailHref(page, "/collections", /^\/collections\/[^/?#]+$/);
  const expenseHref = await findOptionalDetailHref(page, "/expenses", /^\/expenses\/[^/?#]+$/);
  const bankHref = await findOptionalDetailHref(
    page,
    "/bank-statements",
    /^\/bank-statements\/(?!import(?:[/?#]|$)|analysis(?:[/?#]|$))[^/?#]+$/
  );

  const downloads = [
    { page: "/reports", label: "Aylık PDF" },
    { page: "/reports", label: "Kasa PDF" },
    { page: "/reports", label: "Belge PDF" },
    { page: "/reports", label: "Banka PDF" },
    { page: "/reports", label: "Mutabakat PDF" },
    { page: "/reports", label: "Sermaye PDF" },
    { page: "/advances", label: "PDF Rapor" },
    clientHref ? { page: clientHref, label: "PDF indir" } : null,
    caseHref ? { page: caseHref, label: "PDF indir" } : null,
    collectionHref ? { page: collectionHref, label: "PDF indir" } : null,
    expenseHref ? { page: expenseHref, label: "PDF indir" } : null,
    bankHref ? { page: bankHref, label: "PDF Analiz" } : null
  ].filter(Boolean) as Array<{ page: string; label: string }>;

  expect(downloads.length).toBeGreaterThanOrEqual(7);

  for (const target of downloads) {
    await page.goto(target.page, { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/login/);
    await waitForAppContent(page);
    await expectRealPdfDownload(page, target.label);
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("PDF butonu cift tiklamayi engeller ve JSON hatayi dosya olarak indirmez", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "İstemci hata ve çift tıklama testi Chromium üzerinde tek kez çalışır.");

  await login(page);
  await page.goto("/reports", { waitUntil: "networkidle" });

  let requestCount = 0;
  let downloadCount = 0;
  page.on("download", () => {
    downloadCount += 1;
  });
  await page.route("**/api/reports/monthly/pdf**", async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      headers: { "x-request-id": "pdf-ui-error-1234" },
      body: JSON.stringify({
        message: "Rapor filtreleri veya tarih aralığı geçersiz.",
        requestId: "pdf-ui-error-1234"
      })
    });
  });

  const button = page.getByRole("button", { name: "Aylık PDF", exact: true });
  await expect(button).toBeVisible();
  await button.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });

  await expect(page.getByRole("status")).toContainText("Rapor filtreleri veya tarih aralığı geçersiz.");
  await expect(button).toBeEnabled();
  expect(requestCount).toBe(1);
  expect(downloadCount).toBe(0);
});

test("uc nokta menusundeki PDF aksiyonu gercek download baslatir", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Menü download testi Chromium üzerinde tek kez çalışır.");

  await login(page);
  await page.goto("/clients", { waitUntil: "networkidle" });
  const triggers = page.getByRole("button", { name: "İşlemler" });
  const triggerCount = await triggers.count();
  expect(triggerCount).toBeGreaterThan(0);
  const trigger = triggers.nth(0);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expectRealPdfDownload(page, "PDF indir", "menuitem");
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: "Giriş yap" }).click()]);
  await page.waitForLoadState("networkidle");
  await waitForAppContent(page);
}

async function findOptionalDetailHref(page: Page, listPath: string, pattern: RegExp) {
  await page.goto(listPath, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await waitForAppContent(page);
  await expect(page.locator("main")).toBeVisible();
  const hrefs = await page.locator("main a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")).filter(Boolean));
  return hrefs.find((candidate) => candidate && pattern.test(candidate)) ?? null;
}

async function expectRealPdfDownload(page: Page, label: string, role: "button" | "menuitem" = "button") {
  const button = page.getByRole(role, { name: label, exact: true });
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  await expect(page.getByRole("status")).toContainText("PDF indirme işlemi başlatıldı.");

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error(`${label}: indirilen dosya yolu bulunamadi.`);
  const buffer = await readFile(downloadPath);
  expect(buffer.subarray(0, 5).toString("utf8"), `${label}: PDF imzasi`).toBe("%PDF-");
  expect(buffer.byteLength, `${label}: PDF boyutu`).toBeGreaterThan(1_500);

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    expect((parsed.text ?? "").trim().length, `${label}: ayrıştırılmış içerik`).toBeGreaterThan(20);
  } finally {
    await parser.destroy();
  }
}

async function waitForAppContent(page: Page) {
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('[data-toast-ready="true"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}
