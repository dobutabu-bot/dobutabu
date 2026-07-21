import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://dobutabu-production.up.railway.app";
const sessionToken = process.env.PRODUCTION_SESSION_TOKEN;
const mobileProjects = new Set(["iphone", "android"]);

type State = {
  clientHref: string;
  caseHref: string;
  collectionHref: string;
  expenseHref: string;
  documentHref: string;
};

type Result = {
  surface: string;
  fileName: string;
  bytes: number;
  pages: number;
  status: number;
  contentType: string;
  contentDisposition: string;
};

test("production PDF yüzeyleri gerçek download, parse, action menu ve runtime kontrollerini geçer", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const state = JSON.parse(await readFile("artifacts/production-browser-matrix/state.json", "utf8")) as State;
  const runtime = monitorRuntime(page);
  const isMobile = mobileProjects.has(testInfo.project.name);
  const results: Result[] = [];

  await login(page);

  const targets = [
    { surface: "Müvekkil cari", page: state.clientHref, label: "PDF indir", route: /\/api\/reports\/client\/[^/]+\/pdf/, title: "Müvekkil Cari Raporu" },
    { surface: "Dosya finans", page: state.caseHref, label: "PDF indir", route: /\/api\/reports\/case\/[^/]+\/pdf/, title: "Dosya Finans Raporu" },
    { surface: "Tahsilat", page: state.collectionHref, label: "PDF indir", route: /\/api\/reports\/collections\/[^/]+\/pdf/, title: "Tahsilat Makbuz / Özet PDF" },
    { surface: "Gider", page: state.expenseHref, label: "PDF indir", route: /\/api\/reports\/expenses\/[^/]+\/pdf/, title: "Gider Özet PDF" },
    { surface: "Avans", page: "/advances", label: "PDF Rapor", route: /\/api\/reports\/advances\/pdf/, title: "Masraf Avansları Raporu" },
    { surface: "Makbuz/fatura", page: "/receipts", label: "PDF indir", route: /\/api\/reports\/receipts\/pdf/, title: "Makbuz / Fatura Takip Raporu" },
    { surface: "Kasa", page: "/reports", label: "Kasa PDF", route: /\/api\/reports\/cash\/pdf/, title: "Kasa Hareketleri Raporu" },
    { surface: "Aylık finans", page: "/reports", label: "Aylık PDF", route: /\/api\/reports\/monthly\/pdf/, title: "Aylık Finans Raporu" },
    { surface: "Belge raporu", page: "/reports", label: "Belge PDF", route: /\/api\/reports\/documents\/pdf/, title: "Belge Raporu" },
    { surface: "Banka analiz", page: "/reports", label: "Banka PDF", route: /\/api\/reports\/bank-statements\/pdf/, title: "Banka Ekstresi Analiz Raporu" },
    { surface: "Mutabakat", page: "/reports", label: "Mutabakat PDF", route: /\/api\/reports\/reconciliation\/pdf/, title: "Mutabakat Raporu" },
    { surface: "Sermaye", page: "/reports", label: "Sermaye PDF", route: /\/api\/reports\/capital\/pdf/, title: "Sermaye / Varlık Raporu" }
  ];

  for (const target of targets) {
    await page.goto(target.page, { waitUntil: "networkidle" });
    await waitForAppContent(page);
    const trigger = page.getByRole("button", { name: target.label, exact: true });
    await expect(trigger, `${target.surface}: PDF butonu`).toHaveCount(1);
    if (isMobile) await expectTouchTarget(trigger, target.surface);
    results.push(await downloadAndParse(page, trigger, target.route, target.surface, target.title));
  }

  await page.goto("/clients", { waitUntil: "networkidle" });
  await waitForAppContent(page);
  const actionTrigger = page.getByRole("button", { name: "İşlemler" }).first();
  await expect(actionTrigger).toHaveAttribute("data-action-menu-ready", "true");
  if (isMobile) await expectTouchTarget(actionTrigger, "İşlemler");
  await actionTrigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const pdfItem = menu.getByRole("menuitem", { name: "PDF indir", exact: true });
  await expect(pdfItem).toHaveCount(1);
  if (isMobile) await expectTouchTarget(pdfItem, "PDF indir menü öğesi");
  results.push(await downloadAndParse(page, pdfItem, /\/api\/reports\/client\/[^/]+\/pdf/, "Müvekkil action menu", "Müvekkil Cari Raporu"));

  const previewRoute = new RegExp(`${state.documentHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("/documents/", "/api/documents/")}/preview`);
  const previewResponsePromise = page.waitForResponse((response) => previewRoute.test(new URL(response.url()).pathname));
  await page.goto(state.documentHref, { waitUntil: "networkidle" });
  await waitForAppContent(page);
  const previewResponse = await previewResponsePromise;
  const previewBytes = Buffer.from(await previewResponse.body());
  expect(previewResponse.status(), "Private belge preview HTTP").toBe(200);
  expect(previewResponse.headers()["content-type"], "Private belge preview MIME").toMatch(/^application\/pdf/);
  await parsePdf(previewBytes, "Private belge preview");

  const documentDownload = page.getByRole("link", { name: "İndir", exact: true });
  await expect(documentDownload).toHaveCount(1);
  if (isMobile) await expectTouchTarget(documentDownload, "Private belge indir");
  results.push(await downloadAndParse(page, documentDownload, /\/api\/documents\/[^/]+\/download/, "Private belge download"));

  runtime.assertClean();
  await writeFile(
    `artifacts/production-browser-matrix/${testInfo.project.name}.json`,
    `${JSON.stringify({ project: testInfo.project.name, results, consoleErrors: 0, failedRequests: 0 }, null, 2)}\n`,
    "utf8"
  );
});

async function downloadAndParse(page: Page, trigger: Locator, route: RegExp, surface: string, title?: string): Promise<Result> {
  const [response, download] = await Promise.all([
    page.waitForResponse((candidate) => route.test(new URL(candidate.url()).pathname)),
    page.waitForEvent("download"),
    trigger.click()
  ]);
  expect(response.status(), `${surface}: HTTP`).toBe(200);
  expect(response.headers()["content-type"], `${surface}: MIME`).toMatch(/^application\/pdf(?:;|$)/i);
  expect(response.headers()["content-disposition"], `${surface}: disposition`).toMatch(/^attachment;/i);
  expect(download.suggestedFilename(), `${surface}: dosya adı`).toMatch(/^[^/\\\r\n]+\.pdf$/i);
  const path = await download.path();
  if (!path) throw new Error(`${surface}: indirme yolu bulunamadı.`);
  const bytes = await readFile(path);
  const pages = await parsePdf(bytes, surface, title);
  return {
    surface,
    fileName: download.suggestedFilename(),
    bytes: bytes.byteLength,
    pages,
    status: response.status(),
    contentType: response.headers()["content-type"] ?? "",
    contentDisposition: response.headers()["content-disposition"] ?? ""
  };
}

async function parsePdf(bytes: Buffer, surface: string, title?: string) {
  expect(bytes.byteLength, `${surface}: anlamlı boyut`).toBeGreaterThan(1_000);
  expect(bytes.subarray(0, 5).toString("ascii"), `${surface}: imza`).toBe("%PDF-");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const parsed = await parser.getText();
    const info = await parser.getInfo();
    expect(info.total, `${surface}: sayfa`).toBeGreaterThanOrEqual(1);
    expect((parsed.text ?? "").trim().length, `${surface}: içerik`).toBeGreaterThan(20);
    if (title) expect(parsed.text ?? "", `${surface}: başlık`).toContain(title);
    return info.total;
  } finally {
    await parser.destroy();
  }
}

async function login(page: Page) {
  if (sessionToken) {
    await page.context().addCookies([
      {
        name: "hukuk_finans_session",
        value: sessionToken,
        url: baseURL,
        httpOnly: true,
        secure: true,
        sameSite: "Lax"
      }
    ]);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await waitForAppContent(page);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard/),
    page.getByRole("button", { name: "Giriş yap" }).click()
  ]);
  await page.waitForLoadState("networkidle");
  await waitForAppContent(page);
}

async function waitForAppContent(page: Page) {
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('[data-toast-ready="true"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}

async function expectTouchTarget(locator: Locator, label: string) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: hedef ölçülemedi.`);
  expect(box.width, `${label}: genişlik`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label}: yükseklik`).toBeGreaterThanOrEqual(44);
}

function monitorRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => recordRequestFailure(failedRequests, request));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return {
    assertClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(failedRequests, failedRequests.join("\n")).toEqual([]);
    }
  };
}

function recordRequestFailure(failures: string[], request: Request) {
  const error = request.failure()?.errorText ?? "request failed";
  const path = new URL(request.url()).pathname;
  const ignored = /cancel|aborted|NS_BINDING_ABORTED/i.test(error) &&
    (path === "/icon.svg" || path === "/pwa-icons/apple-touch-icon.png");
  if (!ignored) failures.push(`${request.method()} ${request.url()} ${error}`);
}
