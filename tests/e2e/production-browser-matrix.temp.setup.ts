import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://dobutabu-production.up.railway.app";
const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const sessionToken = process.env.PRODUCTION_SESSION_TOKEN;
const marker = `PDF-SMOKE-TEST-BROWSER-MATRIX-${Date.now()}`;
const statePath = "artifacts/production-browser-matrix/state.json";

export default async function globalSetup() {
  await mkdir("artifacts/production-browser-matrix", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const state = {
    marker,
    createdCase: false,
    createdDocument: false,
    clientHref: "",
    caseHref: "",
    collectionHref: "",
    expenseHref: "",
    documentHref: ""
  };

  try {
    await login(page);
    state.clientHref = await requireDetailHref(page, "/clients", /^\/clients\/[^/?#]+$/);
    state.collectionHref = await requireDetailHref(page, "/collections", /^\/collections\/[^/?#]+$/);
    state.expenseHref = await requireDetailHref(page, "/expenses", /^\/expenses\/[^/?#]+$/);

    state.caseHref = await optionalDetailHref(page, "/cases", /^\/cases\/[^/?#]+$/) ?? "";
    if (!state.caseHref) {
      await page.goto("/cases?create=1", { waitUntil: "domcontentloaded" });
      await waitForAppContent(page);
      const dialog = page.getByRole("dialog", { name: "Dosya Ekle" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption({ index: 1 });
      await dialog.getByLabel("Başlık").fill(`${marker} Dosya`);
      await dialog.getByLabel("Dosya No").fill(marker);
      await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(dialog).toBeHidden();
      state.caseHref = await requireDetailHref(
        page,
        `/cases?q=${encodeURIComponent(marker)}`,
        /^\/cases\/[^/?#]+$/
      );
      state.createdCase = true;
    }

    await page.goto("/documents/new", { waitUntil: "domcontentloaded" });
    await waitForAppContent(page);
    const fixtureBytes = Buffer.concat([
      await readFile("fixtures/bank-statements/pdf-fallback-ekstre.pdf"),
      Buffer.from(`\n% ${marker}\n`, "utf8")
    ]);
    await page.locator('input[type="file"]').setInputFiles({
      name: `${marker}.pdf`,
      mimeType: "application/pdf",
      buffer: fixtureBytes
    });
    await page.getByLabel("Belge Türü").selectOption("BANK_STATEMENT");
    await Promise.all([
      page.waitForURL((url) => /^\/documents\/[^/]+$/.test(url.pathname)),
      page.getByRole("button", { name: "Belgeyi Güvenli Yükle", exact: true }).click()
    ]);
    state.documentHref = new URL(page.url()).pathname;
    state.createdDocument = true;

    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch (error) {
    await writeFile(statePath, `${JSON.stringify({ ...state, setupError: String(error) }, null, 2)}\n`, "utf8");
    throw error;
  } finally {
    await browser.close();
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
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
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

async function requireDetailHref(page: Page, path: string, pattern: RegExp) {
  const href = await optionalDetailHref(page, path, pattern);
  if (!href) throw new Error(`${path}: aktif detay kaydı bulunamadı.`);
  return href;
}

async function optionalDetailHref(page: Page, path: string, pattern: RegExp) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForAppContent(page);
  const direct = await page.locator("main a[href]").evaluateAll(
    (links, source) => links.map((link) => link.getAttribute("href")).find((href) => href && new RegExp(source).test(href)) ?? null,
    pattern.source
  );
  if (direct) return direct;

  const trigger = page.getByRole("button", { name: "İşlemler" }).first();
  if (await trigger.count() === 0) return null;
  await expect(trigger).toHaveAttribute("data-action-menu-ready", "true");
  await trigger.click();
  const detail = page.getByRole("menu").getByRole("link", { name: "Detay", exact: true });
  if (await detail.count() === 0) return null;
  const href = await detail.getAttribute("href");
  return href && pattern.test(href) ? href : null;
}

async function waitForAppContent(page: Page) {
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('[data-toast-ready="true"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}
