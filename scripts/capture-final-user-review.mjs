import "dotenv/config";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "artifacts", "final-user-review");
const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL || "avukat@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "DemoAvukat2026!";
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

const desktopShots = [
  ["dashboard.png", "/dashboard"],
  ["advances.png", "/advances"],
  ["clients.png", "/clients"],
  ["collections.png", "/collections"],
  ["expenses.png", "/expenses"],
  ["cash.png", "/cash"],
  ["bank.png", "/bank-statements/analysis"],
  ["reconciliation.png", "/reconciliation"],
  ["capital.png", "/capital"],
  ["reports.png", "/reports"]
];

const mobileShots = [
  ["dashboard-mobile.png", "/dashboard"],
  ["finance-mobile.png", "/cash"],
  ["clients-mobile.png", "/clients"],
  ["reports-mobile.png", "/reports"]
];

const captureErrors = [];

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await assertHealth();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: desktop,
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  monitorRuntime(page);

  try {
    await login(page);

    for (const [fileName, route] of desktopShots) {
      await captureRoute(page, fileName, route, desktop);
    }
    for (const [fileName, route] of mobileShots) {
      await captureRoute(page, fileName, route, mobile);
    }

    await captureQuickAdd(page);
    await captureActionMenu(page);
    await captureEditDialog(page);
    await captureDeleteConfirm(page);
    await captureAdvancedOptions(page);

    if (captureErrors.length > 0) {
      await writeFile(path.join(OUTPUT_DIR, "runtime-errors.txt"), `${captureErrors.join("\n")}\n`, "utf8");
      throw new Error(`Tarayıcı hatası tespit edildi: ${captureErrors[0]}`);
    }

    await writeGallery();
    await writeFile(path.join(OUTPUT_DIR, "capture-status.txt"), `PASS\nBase URL: ${BASE_URL}\nScreenshots: 19\n`, "utf8");
    console.log(`FINAL_USER_REVIEW_READY=${path.join(OUTPUT_DIR, "index.html")}`);
  } finally {
    await browser.close();
  }
}

async function assertHealth() {
  const response = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Uygulama sağlık kontrolü başarısız: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error("Uygulama sağlık kontrolü ok:false döndürdü.");
}

function monitorRuntime(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (!/favicon|ResizeObserver loop/i.test(value)) captureErrors.push(`${page.url()} :: console :: ${value}`);
  });
  page.on("pageerror", (error) => captureErrors.push(`${page.url()} :: pageerror :: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) captureErrors.push(`${page.url()} :: HTTP ${response.status()} :: ${response.url()}`);
  });
}

async function login(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-posta").fill(EMAIL);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 }),
    page.getByRole("button", { name: /giriş yap/i }).click()
  ]);
  await waitForStablePage(page, "/dashboard");
}

async function captureRoute(page, fileName, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForStablePage(page, route);
  await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: false });
  console.log(`CAPTURED ${fileName}`);
}

async function waitForStablePage(page, label) {
  await page.locator("body").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewport: window.innerWidth,
    text: document.body.innerText.slice(0, 1600)
  }));
  if (state.width > state.viewport + 1) throw new Error(`${label} yatay taşma üretiyor: ${state.width}px > ${state.viewport}px`);
  if (/Application error|Unhandled Runtime Error|Hydration failed/i.test(state.text)) throw new Error(`${label} runtime hata ekranı gösteriyor.`);
}

async function openQuickAdd(page) {
  await page.setViewportSize(desktop);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page, "/dashboard quick add");
  await page.getByTestId("global-new-button").click();
  await page.getByTestId("quick-add-menu").waitFor({ state: "visible", timeout: 10_000 });
}

async function captureQuickAdd(page) {
  await openQuickAdd(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "quick-add.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function openFirstClientActionMenu(page) {
  await page.setViewportSize(desktop);
  await page.goto("/clients", { waitUntil: "domcontentloaded" });
  await waitForStablePage(page, "/clients actions");
  const trigger = page.getByRole("button", { name: "İşlemler" }).first();
  await trigger.waitFor({ state: "visible", timeout: 10_000 });
  await trigger.click();
  await page.getByRole("menu").waitFor({ state: "visible", timeout: 10_000 });
}

async function captureActionMenu(page) {
  await openFirstClientActionMenu(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "action-menu.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function captureEditDialog(page) {
  await openFirstClientActionMenu(page);
  await page.getByRole("menu").getByRole("button", { name: "Düzenle" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "edit-dialog.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function captureDeleteConfirm(page) {
  await openFirstClientActionMenu(page);
  const menu = page.getByRole("menu");
  const archive = menu.getByRole("button", { name: /arşivle|sil/i }).first();
  await archive.waitFor({ state: "visible", timeout: 10_000 });
  await archive.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "delete-confirm.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function captureAdvancedOptions(page) {
  await openQuickAdd(page);
  await page.getByTestId("quick-add-menu").getByRole("button", { name: "Tahsilat" }).click();
  const advanced = page.getByText("Gelişmiş Seçenekler", { exact: true });
  await advanced.waitFor({ state: "visible", timeout: 15_000 });
  await advanced.click();
  await page.screenshot({ path: path.join(OUTPUT_DIR, "advanced-options.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function writeGallery() {
  const sections = [
    ["Masaüstü", desktopShots.map(([file]) => file)],
    ["Mobil", mobileShots.map(([file]) => file)],
    ["Etkileşimler", ["quick-add.png", "action-menu.png", "edit-dialog.png", "delete-confirm.png", "advanced-options.png"]]
  ];
  const cards = sections.map(([title, files]) => `
    <section>
      <div class="section-heading"><h2>${title}</h2><span>${files.length} ekran</span></div>
      <div class="grid">${files.map((file) => `<a class="shot" href="${file}" target="_blank"><img src="${file}" alt="${file}" loading="lazy"><span>${file}</span></a>`).join("")}</div>
    </section>`).join("");
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Büro Finans Paneli - Final Kullanıcı İncelemesi</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#07111f;color:#e5edf7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:48px clamp(20px,5vw,72px) 32px;border-bottom:1px solid #213047;background:#0b1728}header p{max-width:760px;color:#9fb0c5;line-height:1.6}main{padding:32px clamp(16px,4vw,64px) 64px}section{margin-bottom:48px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.section-heading h2{margin:0;font-size:22px}.section-heading span{color:#8294aa;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:20px}.shot{display:block;overflow:hidden;border:1px solid #25364e;border-radius:18px;background:#111f32;color:#d9e5f2;text-decoration:none;box-shadow:0 18px 45px #02071255;transition:transform .2s,border-color .2s}.shot:hover{transform:translateY(-3px);border-color:#4e6d94}.shot img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;background:#fff}.shot span{display:block;padding:14px 16px;font-size:13px;font-weight:650;letter-spacing:.01em}@media(max-width:600px){header{padding-top:30px}.grid{grid-template-columns:1fr}.shot img{aspect-ratio:390/844}}
</style></head><body><header><h1>Büro Finans Paneli</h1><p>Final kullanıcı inceleme galerisi. Tüm görüntüler gerçek Chromium render’ından, güncel localhost sürümünden alınmıştır.</p></header><main>${cards}</main></body></html>`;
  await writeFile(path.join(OUTPUT_DIR, "index.html"), html, "utf8");
}

main().catch(async (error) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, "capture-status.txt"), `FAILED\n${error.stack || error.message}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
