import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";

import { expect, test, type ConsoleMessage, type Locator, type Page, type Request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { assertRealPdfDownload, type PdfUiTarget } from "./pdf-download-helpers";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

const routeProjects = new Set([
  "chromium-desktop",
  "firefox-desktop",
  "webkit-desktop",
  "iphone",
  "android"
]);

const mobileProjects = new Set(["iphone", "android"]);

const routes = [
  { name: "dashboard", path: "/dashboard" },
  { name: "clients", path: "/clients", search: true, actions: true, pagination: true },
  { name: "cases", path: "/cases", search: true, actions: true, pagination: true },
  { name: "collections", path: "/collections", actions: true, filters: true, pagination: true, pdf: true },
  { name: "expenses", path: "/expenses", actions: true, filters: true, pagination: true, pdf: true },
  { name: "advances", path: "/advances", actions: true, filters: true, pagination: true, pdf: true },
  { name: "receipts", path: "/receipts", actions: true, filters: true, pagination: true },
  { name: "documents", path: "/documents?view=table", search: true, actions: true, filters: true, pagination: true },
  { name: "cash", path: "/cash" },
  { name: "cash ledger", path: "/cash/ledger", actions: true, filters: true, pagination: true },
  { name: "bank statements", path: "/bank-statements", search: true, pagination: true },
  { name: "bank statement import", path: "/bank-statements/import", upload: true },
  { name: "bank analysis", path: "/bank-statements/analysis", filters: true, pagination: true },
  { name: "reconciliation", path: "/reconciliation", actions: true, pagination: true },
  { name: "cash reconciliation", path: "/cash/reconciliation", filters: true },
  { name: "capital", path: "/capital", actions: true, search: true, pagination: true, pdf: true },
  { name: "reports", path: "/reports", filters: true, pdf: true },
  { name: "reminders", path: "/reminders", search: true, actions: true, pagination: true },
  { name: "settings", path: "/settings" },
  { name: "deleted records", path: "/settings/deleted-records", actions: true, pagination: true }
] as const;

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Tam production runtime regresyonu", () => {
  test("ana route matrisi HTTP, runtime, hydration ve kullanıcı kontrollerinde temiz kalır", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    test.skip(!routeProjects.has(testInfo.project.name), "Route matrisi üç masaüstü motoru ile iPhone/Android projelerinde çalışır.");

    const monitor = installRuntimeMonitor(page);

    const loginResponse = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(loginResponse?.status(), "login document HTTP status").toBeLessThan(400);
    await expect(page.getByTestId("page-ready-login")).toBeVisible();
    await assertNoRuntimeErrorSurface(page, "login");
    monitor.assertClean("login");

    monitor.reset("login submission");
    await loginThroughUi(page);
    await monitor.settle();
    monitor.assertClean("login submission");

    for (const route of routes) {
      monitor.reset(route.name);
      const response = await gotoRoute(page, route.path);
      expect(response?.status(), `${route.name}: document HTTP status`).toBeLessThan(400);
      await waitForPageReady(page);
      await assertNoRuntimeErrorSurface(page, route.name);
      await assertPageGeometry(page, route.name, mobileProjects.has(testInfo.project.name));
      await assertControlsAccessible(page, route.name, mobileProjects.has(testInfo.project.name));
      await assertTablesContained(page, route.name);
      await assertChartsContained(page, route.name);
      await assertPagination(page, route.name, Boolean(route.pagination));
      await assertFilterSurface(page, route.name, Boolean(route.filters));
      await assertUploadSurface(page, route.name, Boolean(route.upload));
      await assertPdfSurface(page, route.name, Boolean(route.pdf));
      await exerciseActionMenu(page, route.name, Boolean(route.actions));
      await exerciseSearch(page, route.name, Boolean(route.search));
      await monitor.settle();
      monitor.assertClean(route.name);
    }
  });

  test("çekirdek create-edit-delete-restore, upload ve PDF akışları gerçek UI üzerinden çalışır", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    test.skip(testInfo.project.name !== "chromium-desktop", "Yazma yapan regresyon akışı tek Chromium masaüstü projesinde çalışır.");
    test.skip(!isLocalTarget(testInfo.project.use.baseURL), "Production verisi korunur; yazma yapan fixture akışı yalnız localhost hedefinde çalışır.");

    const stamp = `FULL-PRODUCTION-REGRESSION-${Date.now()}`;
    const monitor = installRuntimeMonitor(page);
    const fixturePath = testInfo.outputPath(`${stamp}.csv`);
    let clientId = "";
    let caseId = "";
    let incomeId = "";
    let expenseId = "";
    let documentId = "";

    await writeFile(fixturePath, `aciklama,tutar\n${stamp},125.50\n`, "utf8");
    await loginThroughUi(page);

    try {
      monitor.reset("client create/edit");
      await gotoRoute(page, "/clients");
      const clientForm = await openCreateDialog(page, "Müvekkil Ekle");
      await clientForm.getByLabel("Ad / Ünvan").fill(`${stamp} Müvekkil`);
      await clientForm.getByLabel("Telefon").fill("05000000000");
      await clientForm.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(page.getByText(`${stamp} Müvekkil`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      clientId = (await prisma.client.findFirstOrThrow({
        where: { name: `${stamp} Müvekkil` },
        select: { id: true }
      })).id;

      let dialog = await openRowActionDialog(page, `${stamp} Müvekkil`, "Düzenle", "Müvekkil Düzenle");
      await dialog.getByLabel("Ad / Ünvan").fill(`${stamp} Müvekkil Güncel`);
      await submitDialog(dialog);
      await expect(page.getByText(`${stamp} Müvekkil Güncel`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await monitor.settle();
      monitor.assertClean("client create/edit");

      monitor.reset("case create/edit");
      await gotoRoute(page, "/cases?create=1");
      dialog = page.getByRole("dialog", { name: "Dosya Ekle" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption(clientId);
      await dialog.getByLabel("Başlık").fill(`${stamp} Dosya`);
      await dialog.getByLabel("Dosya No").fill(`2026/${stamp.slice(-6)} E.`);
      await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(page.getByText(`${stamp} Dosya`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      caseId = (await prisma.caseFile.findFirstOrThrow({
        where: { title: `${stamp} Dosya` },
        select: { id: true }
      })).id;

      dialog = await openRowActionDialog(page, `${stamp} Dosya`, "Düzenle", "Dosya Düzenle");
      await dialog.getByLabel("Başlık").fill(`${stamp} Dosya Güncel`);
      await submitDialog(dialog);
      await monitor.settle();
      monitor.assertClean("case create/edit");

      monitor.reset("collection create/delete/restore");
      await gotoRoute(page, "/collections?create=1");
      dialog = page.getByRole("dialog", { name: "Tahsilat Ekle" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption(clientId);
      await dialog.getByLabel("Tutar").fill("1250.50");
      await dialog.getByLabel("Açıklama").fill(`${stamp} Tahsilat`);
      await openAdvanced(dialog);
      await dialog.getByLabel("Dosya", { exact: true }).selectOption(caseId);
      await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(page.getByText(`${stamp} Tahsilat`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      incomeId = (await prisma.income.findFirstOrThrow({
        where: { description: `${stamp} Tahsilat` },
        select: { id: true }
      })).id;
      await expect.poll(() => prisma.cashLedgerEntry.count({ where: { incomeId, deletedAt: null } })).toBe(1);
      await deleteRow(page, `${stamp} Tahsilat`, "Tahsilat silinsin mi?", "Sil");
      await expect.poll(() => activeIncomeAndLedger(incomeId)).toEqual({ income: 0, ledger: 0 });
      await restoreRecord(page, "incomes", `${stamp} Müvekkil Güncel`);
      await expect.poll(() => activeIncomeAndLedger(incomeId)).toEqual({ income: 1, ledger: 1 });
      await monitor.settle();
      monitor.assertClean("collection create/delete/restore");

      monitor.reset("expense create/delete/restore");
      await gotoRoute(page, "/expenses?create=1");
      dialog = page.getByRole("dialog", { name: "Gider Ekle" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Tutar").fill("375.25");
      await dialog.getByLabel("Kategori").selectOption({ index: 1 });
      await dialog.getByLabel("Açıklama").fill(`${stamp} Gider`);
      await openAdvanced(dialog);
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption(clientId);
      await dialog.getByLabel("Dosya", { exact: true }).selectOption(caseId);
      await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(page.getByText(`${stamp} Gider`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      expenseId = (await prisma.expense.findFirstOrThrow({
        where: { description: `${stamp} Gider` },
        select: { id: true }
      })).id;
      await expect.poll(() => prisma.cashLedgerEntry.count({ where: { expenseId, deletedAt: null } })).toBe(1);
      await deleteRow(page, `${stamp} Gider`, "Gider silinsin mi?", "Sil");
      await expect.poll(() => activeExpenseAndLedger(expenseId)).toEqual({ expense: 0, ledger: 0 });
      await restoreRecord(page, "expenses", `${stamp} Müvekkil Güncel`);
      await expect.poll(() => activeExpenseAndLedger(expenseId)).toEqual({ expense: 1, ledger: 1 });
      await monitor.settle();
      monitor.assertClean("expense create/delete/restore");

      monitor.reset("document upload/delete/restore");
      await gotoRoute(page, "/documents/new");
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();
      await fileInput.setInputFiles({
        name: `${stamp}.csv`,
        mimeType: "text/csv",
        buffer: await readFile(fixturePath)
      });
      await page.getByLabel("Belge Türü").selectOption("BANK_STATEMENT");
      await Promise.all([
        page.waitForURL((url) => /^\/documents\/(?!new$|missing$|unlinked$)[^/]+$/.test(url.pathname)),
        page.getByRole("button", { name: "Belgeyi Güvenli Yükle", exact: true }).click()
      ]);
      documentId = new URL(page.url()).pathname.split("/").pop() ?? "";
      expect(documentId).not.toBe("");
      await gotoRoute(page, `/documents?q=${encodeURIComponent(stamp)}&view=table`);
      await deleteRow(page, stamp, "Belge silinsin mi?", "Onayla");
      await expect.poll(() => prisma.document.count({ where: { id: documentId, deletedAt: { not: null } } })).toBe(1);
      await restoreRecord(page, "documents", stamp);
      await expect.poll(() => prisma.document.count({ where: { id: documentId, deletedAt: null } })).toBe(1);
      await monitor.settle();
      monitor.assertClean("document upload/delete/restore");

      monitor.reset("PDF browser download");
      const monthlyPdf: PdfUiTarget = {
        key: "full-regression-monthly",
        page: "/reports",
        label: "Aylık PDF",
        apiPath: "/api/reports/monthly/pdf",
        expectedTitle: "Aylık Finans Raporu",
        filePrefix: "aylik-finans"
      };
      await assertRealPdfDownload(page, monthlyPdf);
      await monitor.settle();
      monitor.assertClean("PDF browser download");

      monitor.reset("final soft-delete cleanup");
      await gotoRoute(page, "/collections");
      await deleteRow(page, `${stamp} Tahsilat`, "Tahsilat silinsin mi?", "Sil");
      await gotoRoute(page, "/expenses");
      await deleteRow(page, `${stamp} Gider`, "Gider silinsin mi?", "Sil");
      await gotoRoute(page, `/documents?q=${encodeURIComponent(stamp)}&view=table`);
      await deleteRow(page, stamp, "Belge silinsin mi?", "Onayla");
      await gotoRoute(page, "/cases");
      await deleteRow(page, `${stamp} Dosya Güncel`, "Dosya silinsin/arşivlensin mi?", "Sil/Arşivle");
      await gotoRoute(page, "/clients");
      await deleteRow(page, `${stamp} Müvekkil Güncel`, "Müvekkil silinsin mi?", "Sil");
      await monitor.settle();
      monitor.assertClean("final soft-delete cleanup");
    } finally {
      await softDeleteRegressionRecords(stamp);
    }
  });
});

function installRuntimeMonitor(page: Page) {
  let scope = "initial";
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedRequests: string[] = [];
  let failedResponses: string[] = [];
  const pendingConsoleReads: Promise<void>[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    pendingConsoleReads.push(describeConsoleMessage(message).then((text) => {
      if (!/favicon|ResizeObserver loop/i.test(text)) consoleErrors.push(text);
    }));
  });
  page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (isIgnorableFailedRequest(request)) return;
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400 || /favicon/i.test(response.url())) return;
    failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });

  return {
    reset(nextScope: string) {
      scope = nextScope;
      consoleErrors = [];
      pageErrors = [];
      failedRequests = [];
      failedResponses = [];
    },
    async settle() {
      await Promise.all(pendingConsoleReads.splice(0));
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })).catch(() => undefined);
      await Promise.all(pendingConsoleReads.splice(0));
    },
    assertClean(expectedScope = scope) {
      expect(consoleErrors, `${expectedScope}: console errors`).toEqual([]);
      expect(pageErrors, `${expectedScope}: page errors`).toEqual([]);
      expect(failedRequests, `${expectedScope}: failed requests`).toEqual([]);
      expect(failedResponses, `${expectedScope}: HTTP >= 400 responses`).toEqual([]);
    }
  };
}

async function describeConsoleMessage(message: ConsoleMessage) {
  const values = await Promise.all(message.args().map(async (argument) => {
    return argument.evaluate((value: unknown) => {
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      try {
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        return String(value);
      }
    }).catch(() => "");
  }));
  return values.filter(Boolean).join(" ") || message.text();
}

function isIgnorableFailedRequest(request: Request) {
  const headers = request.headers();
  const isPrefetch = headers["next-router-prefetch"] === "1" || headers.purpose === "prefetch";
  const errorText = request.failure()?.errorText ?? "";
  const developmentHotUpdate = /\/_next\/static\/(?:webpack\/)?[^/?]*hot-update\.(?:js|json)(?:\?|$)/i.test(request.url());
  const cancelledPwaIcon = (
    request.resourceType() === "image" &&
    /(?:\/pwa-icons\/[^/?]+\.(?:png|webp)|\/icon\.svg)(?:\?|$)/i.test(request.url()) &&
    /ERR_ABORTED|NS_BINDING_ABORTED/i.test(errorText)
  );
  const cancelledNextChunk = (
    request.resourceType() === "script" &&
    /\/_next\/static\/chunks\/.+\.js(?:\?|$)/i.test(request.url()) &&
    /^(?:net::ERR_ABORTED|cancelled|NS_BINDING_ABORTED)$/i.test(errorText)
  );
  const cancelledRscNavigation = (
    request.method() === "GET" &&
    /[?&]_rsc=[^&]+/i.test(request.url()) &&
    /^(?:net::ERR_ABORTED|cancelled|NS_BINDING_ABORTED)$/i.test(errorText)
  );
  const cancelledReminderPoll = (
    request.method() === "GET" &&
    /\/api\/reminders\/due(?:\?|$)/i.test(request.url()) &&
    /^(?:net::ERR_ABORTED|cancelled|NS_BINDING_ABORTED)$/i.test(errorText)
  );
  return (
    /favicon/i.test(request.url()) ||
    developmentHotUpdate ||
    cancelledPwaIcon ||
    cancelledNextChunk ||
    cancelledRscNavigation ||
    cancelledReminderPoll ||
    (isPrefetch && /ERR_ABORTED|NS_BINDING_ABORTED/i.test(errorText))
  );
}

async function loginThroughUi(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("page-ready-login")).toBeVisible();
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/dashboard"),
    page.getByRole("button", { name: "Giriş yap", exact: true }).click()
  ]);
  await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
}

async function gotoRoute(page: Page, href: string) {
  const response = await page.goto(href, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForPageReady(page);
  return response;
}

async function waitForPageReady(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  if (new URL(page.url()).pathname === "/login") {
    await expect(page.getByTestId("page-ready-login")).toBeVisible();
    return;
  }
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  if (new URL(page.url()).pathname === "/reports") {
    await expect(page.getByTestId("reports-content-ready")).toBeVisible({ timeout: 30_000 });
  }
  if (new URL(page.url()).pathname === "/capital") {
    await expect(page.getByTestId("capital-content-ready")).toBeVisible({ timeout: 30_000 });
  }
  if (new URL(page.url()).pathname === "/advances") {
    await expect(page.getByTestId("advances-content-ready")).toBeVisible({ timeout: 30_000 });
  }
  if (new URL(page.url()).pathname === "/collections") {
    await expect(page.getByTestId("collections-content-ready")).toBeVisible({ timeout: 30_000 });
  }
  if (new URL(page.url()).pathname === "/expenses") {
    await expect(page.getByTestId("expenses-content-ready")).toBeVisible({ timeout: 30_000 });
  }
  const marker = page.locator('[data-testid^="page-ready-"]:visible').first();
  if (await marker.count()) await expect(marker).toBeVisible();
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
}

async function assertNoRuntimeErrorSurface(page: Page, routeName: string) {
  const body = page.locator("body");
  await expect(body, `${routeName}: hydration/runtime error surface`).not.toContainText(
    /Hydration failed|hydration mismatch|Unhandled Runtime Error|Application error|This page could not be found/i
  );
}

async function assertPageGeometry(page: Page, routeName: string, mobile: boolean) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(
    Math.max(geometry.documentWidth, geometry.bodyWidth),
    `${routeName}: yatay taşma`
  ).toBeLessThanOrEqual(geometry.viewport + 1);

  if (!mobile) return;
  const clipped = await page.locator('[role="dialog"]:visible, [data-testid="drawer-panel"]:visible').evaluateAll((elements) => {
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth };
    }).filter((item) => item.left < -1 || item.right > item.viewport + 1);
  });
  expect(clipped, `${routeName}: modal/drawer viewport dışına çıkmamalı`).toEqual([]);
}

async function assertControlsAccessible(page: Page, routeName: string, mobile: boolean) {
  const unlabeledIconButtons = await page.locator('main button:visible').evaluateAll((buttons) => {
    return buttons.filter((button) => {
      const text = (button.textContent ?? "").trim();
      const label = button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "";
      return !text && !label;
    }).length;
  });
  expect(unlabeledIconButtons, `${routeName}: etiketsiz icon-only buton`).toBe(0);

  if (!mobile) return;
  const undersized = await page.locator(
    'main .primary-action:visible, main .secondary-action:visible, main button.icon-button:visible, nav button:visible'
  ).evaluateAll((elements) => {
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 40),
        iconOnly: !(element.textContent ?? "").trim(),
        width: rect.width,
        height: rect.height
      };
    }).filter((item) => item.height > 0 && (item.height < 43.5 || (item.iconOnly && item.width < 43.5)));
  });
  expect(undersized, `${routeName}: 44px altı ana dokunmatik hedef`).toEqual([]);
}

async function assertTablesContained(page: Page, routeName: string) {
  const overflow = await page.locator("table:visible").evaluateAll((tables) => {
    return tables.map((table) => {
      const rect = table.getBoundingClientRect();
      const parent = table.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : null;
      return {
        tableRight: rect.right,
        viewport: window.innerWidth,
        controlled: Boolean(parentStyle && ["auto", "scroll"].includes(parentStyle.overflowX))
      };
    }).filter((item) => item.tableRight > item.viewport + 1 && !item.controlled);
  });
  expect(overflow, `${routeName}: kontrolsüz geniş tablo`).toEqual([]);
}

async function assertChartsContained(page: Page, routeName: string) {
  const overflow = await page.locator(".recharts-responsive-container:visible").evaluateAll((charts) => {
    return charts.map((chart) => {
      const rect = chart.getBoundingClientRect();
      const parentRect = chart.parentElement?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        parentLeft: parentRect?.left ?? rect.left,
        parentRight: parentRect?.right ?? rect.right
      };
    }).filter((item) => item.left < item.parentLeft - 1 || item.right > item.parentRight + 1);
  });
  expect(overflow, `${routeName}: chart container taşması`).toEqual([]);
}

async function assertPagination(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  const pagination = page.getByTestId("pagination");
  if (!(await pagination.count())) return;
  await expect(pagination).toBeVisible();
  const links = pagination.getByRole("link");
  expect(await links.count(), `${routeName}: pagination linkleri`).toBeGreaterThanOrEqual(2);
  await expect(pagination.getByRole("link", { name: "Önceki" })).toHaveAttribute("href", /./);
  await expect(pagination.getByRole("link", { name: "Sonraki" })).toHaveAttribute("href", /./);
}

async function assertFilterSurface(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  const filters = page.locator("main form:visible select:visible, main form:visible input[type='date']:visible");
  if (!(await filters.count())) return;
  const invalid = await filters.evaluateAll((elements) => elements.filter((element) => {
    const id = element.getAttribute("id");
    const parentLabel = element.closest("label");
    return !parentLabel && (!id || !document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).length);
  expect(invalid, `${routeName}: etiketsiz filtre alanı`).toBe(0);
}

async function assertUploadSurface(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await expect(page.locator('input[type="file"]')).toHaveAttribute("accept", /csv|xlsx|pdf/i);
  await expect(page.locator("body")).toContainText(/CSV|Excel|XLSX|PDF/i);
}

async function assertPdfSurface(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  let controls = page.locator('main button:visible, main a:visible').filter({ hasText: /PDF/i });
  if (!(await controls.count())) {
    const actionTrigger = page.locator('button[aria-label="İşlemler"]:visible').first();
    if (await actionTrigger.count()) {
      await expect(actionTrigger).toHaveAttribute("data-action-menu-ready", "true");
      await actionTrigger.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      controls = menu.locator("button:visible, a:visible").filter({ hasText: /PDF/i });
    }
  }
  expect(await controls.count(), `${routeName}: görünür PDF aksiyonu`).toBeGreaterThan(0);

  const buttons = page.locator("button:visible").filter({ hasText: /PDF/i });
  for (let index = 0; index < await buttons.count(); index += 1) {
    await expect(buttons.nth(index), `${routeName}: PDF butonu form submit olmamalı`).toHaveAttribute("type", "button");
  }
  if (await page.getByRole("menu").count()) {
    await page.keyboard.press("Escape");
  }
}

async function exerciseActionMenu(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  const trigger = page.locator('button[aria-label="İşlemler"]:visible').first();
  if (!(await trigger.count())) return;
  await expect(trigger).toHaveAttribute("data-action-menu-ready", "true");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu, `${routeName}: action menu açılmalı`).toBeVisible();
  expect(await menu.locator('a[href], button').count(), `${routeName}: action menu boş olmamalı`).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function exerciseSearch(page: Page, routeName: string, applicable: boolean) {
  if (!applicable) return;
  const search = page.locator('main input[name="q"]:visible').first();
  if (!(await search.count())) return;
  const marker = "FULL-PRODUCTION-REGRESSION-SEARCH";
  const originalUrl = new URL(page.url());
  await search.fill(marker);
  await expect(search, `${routeName}: search input`).toHaveValue(marker);
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get("q") === marker),
    search.press("Enter")
  ]);
  await waitForPageReady(page);
  await gotoRoute(page, `${originalUrl.pathname}${originalUrl.search}`);
}

async function openCreateDialog(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog.locator("form");
}

async function openRowActionDialog(page: Page, rowText: string, action: string, dialogTitle: string) {
  const row = page.locator("tr").filter({ hasText: rowText }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  await page.getByRole("menu").getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: dialogTitle });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function submitDialog(dialog: Locator) {
  await dialog.getByRole("button", { name: "Güncelle", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function openAdvanced(dialog: Locator) {
  const details = dialog.locator("details");
  await expect(details).toBeVisible();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
}

async function deleteRow(page: Page, rowText: string, dialogTitle: string, confirmLabel: string) {
  const row = page.locator("tr").filter({ hasText: rowText }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /^(Sil|Sil\/Arşivle|İptal)$/ }).first().click();
  const dialog = page.getByRole("dialog", { name: dialogTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function restoreRecord(page: Page, tab: string, rowText: string) {
  await gotoRoute(page, `/settings/deleted-records?tab=${tab}`);
  const row = page.locator("tr").filter({ hasText: rowText }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  await page.getByRole("menu").getByRole("button", { name: "Geri Al", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Kayıt geri alınsın mı?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Geri Al", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function activeIncomeAndLedger(incomeId: string) {
  const [income, ledger] = await Promise.all([
    prisma.income.count({ where: { id: incomeId, deletedAt: null } }),
    prisma.cashLedgerEntry.count({ where: { incomeId, deletedAt: null } })
  ]);
  return { income, ledger };
}

async function activeExpenseAndLedger(expenseId: string) {
  const [expense, ledger] = await Promise.all([
    prisma.expense.count({ where: { id: expenseId, deletedAt: null } }),
    prisma.cashLedgerEntry.count({ where: { expenseId, deletedAt: null } })
  ]);
  return { expense, ledger };
}

async function softDeleteRegressionRecords(stamp: string) {
  const now = new Date();
  const incomes = await prisma.income.findMany({
    where: { description: { contains: stamp } },
    select: { id: true }
  });
  const expenses = await prisma.expense.findMany({
    where: { description: { contains: stamp } },
    select: { id: true }
  });
  const incomeIds = incomes.map((item) => item.id);
  const expenseIds = expenses.map((item) => item.id);

  await prisma.$transaction([
    prisma.cashLedgerEntry.updateMany({
      where: {
        OR: [
          ...(incomeIds.length ? [{ incomeId: { in: incomeIds } }] : []),
          ...(expenseIds.length ? [{ expenseId: { in: expenseIds } }] : [])
        ]
      },
      data: { deletedAt: now }
    }),
    prisma.income.updateMany({ where: { id: { in: incomeIds } }, data: { deletedAt: now } }),
    prisma.expense.updateMany({ where: { id: { in: expenseIds } }, data: { deletedAt: now } }),
    prisma.document.updateMany({ where: { title: { contains: stamp } }, data: { deletedAt: now } }),
    prisma.caseFile.updateMany({ where: { title: { contains: stamp } }, data: { deletedAt: now, archivedAt: now } }),
    prisma.client.updateMany({ where: { name: { contains: stamp } }, data: { deletedAt: now, archivedAt: now } })
  ]);
}

function isLocalTarget(baseURL: unknown) {
  const value = typeof baseURL === "string" ? baseURL : process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
