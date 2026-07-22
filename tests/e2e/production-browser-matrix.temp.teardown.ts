import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://dobutabu-production.up.railway.app";
const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const sessionToken = process.env.PRODUCTION_SESSION_TOKEN;
const statePath = "artifacts/production-browser-matrix/state.json";

export default async function globalTeardown() {
  await mkdir("artifacts/production-browser-matrix", { recursive: true });
  const state = JSON.parse(await readFile(statePath, "utf8")) as {
    createdCase: boolean;
    createdCollection: boolean;
    createdDocument: boolean;
    createdExpense: boolean;
    caseHref: string;
    collectionHref: string;
    documentHref: string;
    expenseHref: string;
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const cleanup: string[] = [];

  try {
    await login(page);
    if (state.createdDocument && state.documentHref) {
      await page.goto(state.documentHref, { waitUntil: "domcontentloaded" });
      await waitForAppContent(page);
      await confirmAction(page, "Sil", "Belge silinsin mi?", "Onayla");
      cleanup.push("document:soft-deleted");
    }
    if (state.createdExpense && state.expenseHref) {
      await page.goto(state.expenseHref, { waitUntil: "domcontentloaded" });
      await waitForAppContent(page);
      await confirmAction(page, "Sil", "Gider silinsin mi?", "Sil");
      cleanup.push("expense:soft-deleted");
    }
    if (state.createdCollection && state.collectionHref) {
      await page.goto(state.collectionHref, { waitUntil: "domcontentloaded" });
      await waitForAppContent(page);
      await confirmAction(page, "Sil", "Tahsilat silinsin mi?", "Sil");
      cleanup.push("collection:soft-deleted");
    }
    if (state.createdCase && state.caseHref) {
      await page.goto(state.caseHref, { waitUntil: "domcontentloaded" });
      await waitForAppContent(page);
      await confirmAction(page, "Sil/Arşivle", "Dosya silinsin/arşivlensin mi?", "Sil/Arşivle");
      cleanup.push("case:soft-deleted");
    }
  } finally {
    await writeFile(
      "artifacts/production-browser-matrix/cleanup.json",
      `${JSON.stringify({ cleanup, completedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8"
    );
    await browser.close();
  }
}

async function confirmAction(page: Page, triggerName: string, dialogName: string, confirmName: string) {
  await page.getByRole("button", { name: triggerName, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => !/\/(documents|cases|collections|expenses)\/[^/]+$/.test(url.pathname)),
    dialog.getByRole("button", { name: confirmName, exact: true }).click()
  ]);
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
    await page.goto("/dashboard", { waitUntil: "load" });
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
  await expect(page.locator('[data-toast-ready="true"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}
