import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

test("mevcut PDF yuzeyleri gercek UI indirmesiyle acilir", async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    recordRequestFailure(failedRequests, request);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

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
  const missingDetailSurfaces = [
    !clientHref ? "client" : null,
    !caseHref ? "case" : null,
    !collectionHref ? "collection" : null,
    !expenseHref ? "expense" : null,
    !bankHref ? "bank-statement" : null
  ].filter(Boolean);

  const downloads = [
    { page: "/reports", label: "Aylık PDF", expectedTitle: "Aylık Finans Raporu" },
    { page: "/reports", label: "Kasa PDF", expectedTitle: "Kasa Hareketleri Raporu" },
    {
      page: "/receipts",
      label: "PDF indir",
      expectedTitle: "Makbuz / Fatura Takip Raporu",
      expectedText: /BELGE SAYISI\s*\d+/i
    },
    { page: "/reports", label: "Belge PDF", expectedTitle: "Belge Raporu" },
    { page: "/reports", label: "Banka PDF", expectedTitle: "Banka Ekstresi Analiz Raporu" },
    { page: "/reports", label: "Mutabakat PDF", expectedTitle: "Mutabakat Raporu" },
    { page: "/reports", label: "Sermaye PDF", expectedTitle: "Sermaye / Varlık Raporu" },
    { page: "/advances", label: "PDF Rapor", expectedTitle: "Masraf Avansları Raporu" },
    clientHref ? { page: clientHref, label: "PDF indir", expectedTitle: "Müvekkil Cari Raporu" } : null,
    caseHref ? { page: caseHref, label: "PDF indir", expectedTitle: "Dosya Finans Raporu" } : null,
    collectionHref
      ? { page: collectionHref, label: "PDF indir", expectedTitle: "Tahsilat Makbuz / Özet PDF" }
      : null,
    expenseHref ? { page: expenseHref, label: "PDF indir", expectedTitle: "Gider Özet PDF" } : null,
    bankHref ? { page: bankHref, label: "PDF Analiz", expectedTitle: "Banka Ekstresi Analiz Raporu" } : null
  ].filter(Boolean) as Array<{
    page: string;
    label: string;
    expectedTitle: string;
    expectedText?: RegExp;
  }>;

  expect(
    downloads.length,
    `Staging matrisi tanımlı 13 PDF yüzeyinin tamamını bulmalı. Eksik detaylar: ${
      missingDetailSurfaces.join(", ") || "yok"
    }`
  ).toBe(13);

  const parsedDownloads: Array<{ label: string; bytes: number; pages: number; text: string }> = [];
  for (const target of downloads) {
    await page.goto(target.page, { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/login/);
    await waitForAppContent(page);
    parsedDownloads.push(
      await expectRealPdfDownload(
        page,
        target.label,
        "button",
        target.expectedTitle,
        target.expectedText
      )
    );
  }

  expect(
    parsedDownloads.some((download) => download.pages >= 2 && download.bytes > 20_000),
    "Staging verisi en az bir çok sayfalı ve anlamlı büyüklükte PDF üretmeli."
  ).toBe(true);
  expect(
    parsedDownloads.map((download) => download.text).join("\n"),
    "Türkçe rapor başlıkları PDF metninde bozulmamalı."
  ).toMatch(/Müvekkil|Aylık|Tahsilat|Masraf Avansları/);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect(failedRequests, failedRequests.join("\n")).toEqual([]);
});

test("PDF butonu cift tiklamayi engeller ve JSON hatayi dosya olarak indirmez", async ({ page }) => {
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

  await expect(page.getByRole("status")).toContainText(
    "Rapor parametreleri geçerli değil. Destek kodu: pdf-ui-error-1234"
  );
  await expect(button).toBeEnabled();
  expect(requestCount).toBe(1);
  expect(downloadCount).toBe(0);
});

test("uc nokta menusundeki PDF aksiyonu gercek download baslatir", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    recordRequestFailure(failedRequests, request);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await login(page);
  await page.goto("/clients", { waitUntil: "networkidle" });
  const triggers = page.getByRole("button", { name: "İşlemler" });
  const triggerCount = await triggers.count();
  expect(triggerCount).toBeGreaterThan(0);
  const trigger = triggers.nth(0);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("data-action-menu-ready", "true");
  await trigger.click();
  const menuItems = page.getByRole("menu").locator("a[href], button");
  await expect(menuItems.nth(0)).toContainText("Detay");
  await expect(menuItems.nth(1)).toContainText("Düzenle");
  await expect(menuItems.nth(2)).toContainText("PDF indir");
  await expectRealPdfDownload(page, "PDF indir", "menuitem", "Müvekkil Cari Raporu");
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect(failedRequests, failedRequests.join("\n")).toEqual([]);
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
  const routeReadyTestId = {
    "/collections": "collections-content-ready",
    "/expenses": "expenses-content-ready"
  }[listPath];
  if (routeReadyTestId) {
    await expect(page.getByTestId(routeReadyTestId)).toBeAttached();
  }
  await expect(page.locator("main")).toBeVisible();
  const hrefs = await page.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter(Boolean)
  );
  const directHref = hrefs.find((candidate) => candidate && pattern.test(candidate));
  if (directHref) return directHref;

  const actionTriggers = page.getByRole("button", { name: "İşlemler" });
  const actionTriggerCount = await actionTriggers.count();
  if (actionTriggerCount === 0) return null;

  const actionTrigger = actionTriggers.nth(0);
  await expect(actionTrigger).toHaveAttribute("data-action-menu-ready", "true");
  await actionTrigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const detailItem = menu.getByRole("link", { name: "Detay", exact: true });
  await expect(detailItem).toHaveCount(1);

  const menuHref = await detailItem.getAttribute("href");
  return menuHref && pattern.test(menuHref) ? menuHref : null;
}

async function expectRealPdfDownload(
  page: Page,
  label: string,
  role: "button" | "menuitem" = "button",
  expectedTitle?: string,
  expectedText?: RegExp
) {
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
    const info = await parser.getInfo();
    expect((parsed.text ?? "").trim().length, `${label}: ayrıştırılmış içerik`).toBeGreaterThan(20);
    expect(info.total, `${label}: sayfa sayısı`).toBeGreaterThanOrEqual(1);
    if (expectedTitle) {
      expect(parsed.text ?? "", `${label}: beklenen rapor başlığı`).toContain(expectedTitle);
    }
    if (expectedText) {
      expect(parsed.text ?? "", `${label}: beklenen rapor içeriği`).toMatch(expectedText);
    }
    return {
      label,
      bytes: buffer.byteLength,
      pages: info.total,
      text: parsed.text ?? ""
    };
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

function recordRequestFailure(
  failures: string[],
  request: import("@playwright/test").Request
) {
  const errorText = request.failure()?.errorText ?? "request failed";
  const path = new URL(request.url()).pathname;
  const isFirefoxStaticIconCancellation =
    errorText === "NS_BINDING_ABORTED" &&
    (path === "/icon.svg" || path === "/pwa-icons/apple-touch-icon.png");

  if (!isFirefoxStaticIconCancellation) {
    failures.push(`${request.method()} ${request.url()} ${errorText}`);
  }
}
