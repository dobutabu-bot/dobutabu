import "dotenv/config";

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "artifacts", "ui-v4-review");
const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || "avukat@example.com";
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "DemoAvukat2026!";
const START_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3010];

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844, isMobile: true };

const desktopShots = [
  ["01-dashboard-desktop.png", "/dashboard"],
  ["02-advances-desktop.png", "/advances"],
  ["03-clients-desktop.png", "/clients"],
  ["04-cash-desktop.png", "/cash"],
  ["05-bank-analysis-desktop.png", "/bank-statements/analysis"],
  ["06-reconciliation-desktop.png", "/reconciliation"],
  ["07-capital-desktop.png", "/capital"],
  ["08-reports-desktop.png", "/reports"],
  ["10-settings-desktop.png", "/settings/system-status"]
];

const mobileShots = [
  ["11-dashboard-mobile.png", "/dashboard"],
  ["12-advances-mobile.png", "/advances"],
  ["13-clients-mobile.png", "/clients"],
  ["14-cash-mobile.png", "/cash"],
  ["15-reports-mobile.png", "/reports"]
];

const criticalConsole = [];

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const externalUrl = process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL;
  const server = externalUrl ? null : await startLocalServer();
  const baseUrl = externalUrl || server.url;
  const prisma = new PrismaClient();

  try {
    const dynamicRoutes = await resolveDynamicRoutes(prisma);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: desktop,
      ignoreHTTPSErrors: true,
      serviceWorkers: "block"
    });
    const page = await context.newPage();

    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        if (!/favicon|ResizeObserver loop/i.test(text)) {
          criticalConsole.push(`${page.url()} :: ${text}`);
        }
      }
    });
    page.on("pageerror", (error) => {
      criticalConsole.push(`${page.url()} :: ${error.message}`);
    });

    await login(page);

    for (const [fileName, route] of desktopShots) {
      await capture(page, fileName, route, desktop);
    }

    await capture(page, "09-document-detail-desktop.png", dynamicRoutes.documentDetail, desktop);

    for (const [fileName, route] of mobileShots) {
      await capture(page, fileName, route, mobile);
    }

    await captureAdvanceDrawer(page);
    await captureEditDialog(page, dynamicRoutes.editRoute);
    await captureConfirmDeleteDialog(page);
    await captureEmptyState(page);
    await captureLoadingState(page);

    await browser.close();

    if (criticalConsole.length > 0) {
      await writeFile(path.join(OUTPUT_DIR, "console-errors.txt"), criticalConsole.join("\n"), "utf8");
      throw new Error(`Console error tespit edildi. Detay: ${path.join(OUTPUT_DIR, "console-errors.txt")}`);
    }

    console.log(`UI V4 screenshots hazir: ${OUTPUT_DIR}`);
  } finally {
    await prisma.$disconnect();
    if (server) {
      server.process.kill("SIGTERM");
    }
  }
}

async function startLocalServer() {
  let lastError = "";

  for (const port of START_PORTS) {
    const probe = await probeHealth(`http://127.0.0.1:${port}`);
    if (probe) {
      return { url: `http://127.0.0.1:${port}`, process: { kill() {} } };
    }

    const child = spawn("npm", ["run", "dev", "--", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => process.stdout.write(`[dev:${port}] ${chunk}`));
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      lastError += text;
      process.stderr.write(`[dev:${port}] ${text}`);
    });

    const ready = await waitForHealth(`http://127.0.0.1:${port}`, child, 90_000);
    if (ready) {
      return { url: `http://127.0.0.1:${port}`, process: child };
    }

    child.kill("SIGTERM");

    if (/listen EPERM|operation not permitted/i.test(lastError)) {
      throw new Error(
        [
          "Codex sandbox port acamiyor.",
          "Mac Terminal'de su komutlardan birini calistirin:",
          `  cd ${JSON.stringify(ROOT)}`,
          "  ./START_LOCAL.command",
          "Acilan linki not edin ve sonra:",
          "  APP_URL=http://localhost:PORT npm run ui:v4:screenshots"
        ].join("\n")
      );
    }
  }

  throw new Error(`Local server baslatilamadi. Son hata: ${lastError.slice(-1000)}`);
}

async function waitForHealth(baseUrl, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    if (await probeHealth(baseUrl)) return true;
    await delay(1000);
  }
  return false;
}

async function probeHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function login(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const api = await page.request.post("/api/auth/login", {
    form: { email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD },
    maxRedirects: 0
  });

  if (![200, 302, 303].includes(api.status())) {
    await page.getByLabel("E-posta").fill(DEFAULT_EMAIL);
    await page.getByLabel("Şifre").fill(DEFAULT_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { waitUntil: "domcontentloaded" }),
      page.getByRole("button", { name: /giriş yap/i }).click()
    ]);
    return;
  }

  const setCookie = api.headersArray().find((header) => header.name.toLowerCase() === "set-cookie")?.value;
  if (setCookie) {
    const [nameValue] = setCookie.split(";");
    const separator = nameValue.indexOf("=");
    await page.context().addCookies([
      {
        name: nameValue.slice(0, separator),
        value: nameValue.slice(separator + 1),
        url: page.url(),
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);
  }
}

async function capture(page, fileName, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await assertHealthyRender(page, route);
  await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: false });
  console.log(`OK ${fileName} ${route}`);
}

async function captureAdvanceDrawer(page) {
  await page.setViewportSize(desktop);
  await page.goto("/advances", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await clickFirstMatching(page, ["Avans Hareketi Ekle", "Ekle"]);
  await page.locator("[role='dialog'], [aria-modal='true']").first().waitFor({ state: "visible", timeout: 10_000 });
  await assertHealthyRender(page, "/advances drawer");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "16-advance-add-drawer.png"), fullPage: false });
}

async function captureEditDialog(page, route) {
  await page.setViewportSize(desktop);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await clickFirstMatching(page, ["Düzenle"]);
  await page.locator("[role='dialog'], [aria-modal='true']").first().waitFor({ state: "visible", timeout: 10_000 });
  await assertHealthyRender(page, `${route} edit`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "17-edit-dialog.png"), fullPage: false });
}

async function captureConfirmDeleteDialog(page) {
  await page.setViewportSize(desktop);
  await page.goto("/clients", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await clickFirstMatching(page, ["Sil", "Arşivle"]);
  await page.locator("[role='dialog'], [aria-modal='true']").first().waitFor({ state: "visible", timeout: 10_000 });
  await assertHealthyRender(page, "/clients confirm");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "18-confirm-delete-dialog.png"), fullPage: false });
}

async function captureEmptyState(page) {
  await capture(page, "19-empty-state.png", "/clients?q=__ui_v4_empty_state_probe__", desktop);
}

async function captureLoadingState(page) {
  await page.setViewportSize(desktop);
  await page.goto("/dashboard", { waitUntil: "commit" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "20-loading-state.png"), fullPage: false });
  console.log("OK 20-loading-state.png /dashboard initial paint");
}

async function clickFirstMatching(page, labels) {
  for (const label of labels) {
    const roleTargets = [
      page.getByRole("button", { name: label }),
      page.getByRole("link", { name: label })
    ];

    for (const target of roleTargets) {
      const count = await target.count();
      if (count > 0) {
        await target.first().click();
        return;
      }
    }
  }

  throw new Error(`Tiklanacak aksiyon bulunamadi: ${labels.join(", ")}`);
}

async function assertHealthyRender(page, label) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      viewportWidth: window.innerWidth,
      text: body.innerText.slice(0, 1000)
    };
  });

  if (metrics.scrollWidth > metrics.viewportWidth + 1) {
    throw new Error(`${label} yatay tasma: ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`);
  }

  if (/Hydration failed|Unhandled Runtime Error|Application error/i.test(metrics.text)) {
    throw new Error(`${label} runtime/hydration hata metni iceriyor`);
  }
}

async function resolveDynamicRoutes(prisma) {
  const document = await prisma.document.findFirst({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" }
  });
  const client = await prisma.client.findFirst({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" }
  });

  return {
    documentDetail: document ? `/documents/${document.id}` : "/documents",
    editRoute: client ? `/clients/${client.id}` : "/clients"
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, "SCREENSHOT_CAPTURE_FAILED.txt"), `${error.stack || error.message}\n`, "utf8");
  console.error(error.message);
  process.exit(1);
});
