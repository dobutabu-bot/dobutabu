import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  assertPdfApiResponse,
  assertRealPdfDownload,
  cleanupPdfBrowserFixture,
  createPdfBrowserFixture,
  discoverPdfTargets,
  loginForPdfTests,
  unauthenticatedPdfPaths,
  type PdfBrowserFixture
} from "./pdf-download-helpers";

const desktopProjects = new Set(["chromium-desktop", "firefox-desktop", "webkit-desktop"]);
let fixture: PdfBrowserFixture;

test.beforeAll(async ({}, testInfo) => {
  if (!desktopProjects.has(testInfo.project.name)) return;
  fixture = await createPdfBrowserFixture();
});

test.afterAll(async () => {
  if (fixture) await cleanupPdfBrowserFixture(fixture);
});

test.beforeEach(({}, testInfo) => {
  test.skip(!desktopProjects.has(testInfo.project.name), "PDF masaüstü matrisi Chromium, Firefox ve WebKit projelerinde çalışır.");
});

test("bütün PDF route'ları auth olmadan güvenli biçimde reddedilir", async ({ request }) => {
  for (const path of unauthenticatedPdfPaths) {
    const response = await request.get(path);
    expect(response.status(), `${path}: auth reddi`).toBe(401);
    expect(response.headers()["content-type"], `${path}: hata MIME`).toMatch(/application\/json/);
    expect(response.headers()["content-type"], `${path}: PDF olmamalı`).not.toMatch(/application\/pdf/);
    const body = await response.text();
    expect(body, `${path}: HTML olmamalı`).not.toMatch(/<html/i);
  }
});

test("bütün PDF endpoint'leri authenticated binary ve parse sözleşmesini karşılar", async ({ page }) => {
  await loginForPdfTests(page);
  const targets = await discoverPdfTargets(page, fixture);
  expect(targets).toHaveLength(14);

  for (const target of targets) {
    const response = await page.context().request.get(target.apiPath);
    await assertPdfApiResponse(response, target);
  }
});

test("PDF route hata yanıtları JSON olarak doğru status ile döner", async ({ page }) => {
  await loginForPdfTests(page);

  for (const target of [
    { path: "/api/reports/client/kisa/pdf", status: 400 },
    { path: "/api/reports/client/cm1234567890valid/pdf", status: 404 },
    { path: "/api/reports/monthly/pdf?startDate=gecersiz", status: 422 }
  ]) {
    const response = await page.context().request.get(target.path);
    expect(response.status(), `${target.path}: hata status`).toBe(target.status);
    expect(response.headers()["content-type"], `${target.path}: JSON hata MIME`).toMatch(/^application\/json(?:;|$)/i);
    expect(response.headers()["content-type"], `${target.path}: PDF olmamalı`).not.toMatch(/application\/pdf/i);

    const body = await response.text();
    expect(body, `${target.path}: login/redirect HTML olmamalı`).not.toMatch(/<html|<!doctype/i);
    expect(body, `${target.path}: PDF binary olmamalı`).not.toMatch(/^%PDF-/);
    expect(body, `${target.path}: stack trace olmamalı`).not.toMatch(/\bat\s+\S+\s+\(|DATABASE_URL|AUTH_SECRET/i);
  }
});

test("bütün PDF butonları gerçek browser download üretir ve dosya diskten açılır", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await loginForPdfTests(page);
  const targets = await discoverPdfTargets(page, fixture);
  expect(targets).toHaveLength(14);

  for (const target of targets) {
    await assertRealPdfDownload(page, target);
  }

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("liste aksiyon menülerindeki PDF öğeleri gerçek download başlatır", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Aksiyon menüsü matrisi Chromium üzerinde tek kez çalışır.");

  await loginForPdfTests(page);

  for (const path of ["/clients", "/cases", "/collections", "/expenses"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const triggers = page.getByRole("button", { name: "İşlemler" });
    expect(await triggers.count(), `${path}: fixture satırı ve aksiyon menüsü bulunmalı`).toBeGreaterThan(0);
    await triggers.first().click();

    const pdfItem = page.getByRole("menuitem", { name: "PDF indir", exact: true });
    await expect(pdfItem).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), pdfItem.click()]);
    expect(download.suggestedFilename(), `${path}: güvenli PDF dosya adı`).toMatch(/^[^/\\\r\n]+\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath, `${path}: indirilen dosya diskte bulunmalı`).toBeTruthy();
    const bytes = await readFile(downloadPath!);
    expect(bytes.byteLength, `${path}: anlamlı PDF boyutu`).toBeGreaterThan(1_500);
    expect(bytes.subarray(0, 5).toString("ascii"), `${path}: PDF imzası`).toBe("%PDF-");

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const info = await parser.getInfo();
      expect(info.total, `${path}: parse edilebilir PDF`).toBeGreaterThanOrEqual(1);
    } finally {
      await parser.destroy();
    }
  }
});
