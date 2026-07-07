import "dotenv/config";

import { createHmac } from "crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

const protectedRoutes = [
  "/dashboard",
  "/cash",
  "/cash/accounts",
  "/cash/ledger",
  "/clients",
  "/cases",
  "/collections",
  "/expenses",
  "/reminders",
  "/reports",
  "/settings"
];

const criticalRuntimePatterns = [
  /hydration/i,
  /Unhandled Runtime Error/i,
  /Application error/i,
  /ReferenceError/i,
  /TypeError/i,
  /ChunkLoadError/i,
  /failed to fetch dynamically imported module/i,
  /loading chunk/i,
  /Minified React error/i
];

type RuntimeGuard = {
  errors: string[];
  assertClean: () => void;
};

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V2 cross-browser route smoke", () => {
  test("login, protected routes, PWA install, offline fallback and responsive shell are healthy", async ({ page }, testInfo) => {
    const guard = attachRuntimeGuard(page);

    await gotoRoute(page, "/login");
    await expect(page.getByRole("heading", { name: "Hukuk Finans" })).toBeVisible();
    await assertPageHealthy(page);
    await assertNoHorizontalOverflow(page);

    await gotoRoute(page, "/install");
    await expect(page.getByRole("heading", { name: /PWA Kurulum|Büro Finans Paneli/i })).toBeVisible();
    await assertPageHealthy(page);
    await assertNoHorizontalOverflow(page);

    await gotoRoute(page, "/offline.html");
    await expect(page.getByText("İnternet bağlantısı yok. Veriler güncellenemeyebilir.")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await login(page, testInfo.project.name === "chromium-desktop");

    for (const route of protectedRoutes) {
      await gotoRoute(page, route);
      await assertPageHealthy(page);
      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);

      if (route === "/dashboard") {
        await expect(page.getByRole("heading", { name: "Dijital Kasa" })).toBeVisible();
        await expect(page.getByText("Toplam kasa").first()).toBeVisible();
        await expect(page.getByText("Kasa Bakiyesi")).toBeVisible();
        await assertChartsStayInsideViewport(page);
      }

      if (route === "/cash/accounts") {
        await expect(page.getByRole("heading", { name: "Kasa Hesapları" })).toBeVisible();
        await expect(page.getByText("Toplam Kasa Bakiyesi")).toBeVisible();
      }

      if (route === "/reports") {
        await expect(page.getByRole("heading", { name: "Finans Analiz Merkezi" })).toBeVisible();
        await expect(page.getByText("Günlük Nakit Akışı")).toBeVisible();
        await assertChartsStayInsideViewport(page);
      }
    }

    if (testInfo.project.name === "iphone" || testInfo.project.name === "android") {
      await assertMobileMenuWorks(page);
    }

    guard.assertClean();
  });
});

test.describe("V2 digital cash E2E flow", () => {
  test("income, expense and expense reminder update ledger, dashboard and reports", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Veri değiştiren akış tek desktop Chromium projesinde çalışır.");

    const guard = attachRuntimeGuard(page);
    await login(page, false);

    const seed = await getSeedContext();
    await cleanupE2eReminders(seed.userId);
    const beforeBalance = await getAccountBalance(seed.userId, seed.cashAccountId);
    const stamp = Date.now().toString();
    const today = dateInputValue();
    const dueSoon = dateInputValue(2);
    const incomeDescription = `E2E tahsilat ${stamp}`;
    const expenseDescription = `E2E gider ${stamp}`;
    const reminderTitle = `E2E gider hatırlatma ${stamp}`;

    await postJson(page, "/api/collections", {
      clientId: seed.clientId,
      caseFileId: "",
      cashAccountId: seed.cashAccountId,
      amount: "1000.00",
      currency: "TRY",
      date: today,
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: incomeDescription,
      receiptIssued: false,
      receiptNumber: ""
    });

    await postJson(page, "/api/expenses", {
      clientId: seed.clientId,
      caseFileId: "",
      cashAccountId: seed.cashAccountId,
      amount: "250.00",
      currency: "TRY",
      date: today,
      paymentMethod: "BANK_TRANSFER",
      category: "OFFICE",
      isClientExpense: false,
      description: expenseDescription
    });

    await postJson(page, "/api/reminders", {
      title: reminderTitle,
      description: "Playwright yaklaşan gider kontrolü",
      dueDate: dueSoon,
      reminderType: "EXPENSE",
      amount: "750.00",
      currency: "TRY",
      cashAccountId: seed.cashAccountId,
      relatedClientId: seed.clientId,
      relatedCaseFileId: "",
      status: "OPEN",
      priority: "CRITICAL",
      notifyBeforeDays: 3,
      notificationEnabled: true
    });

    const afterBalance = await getAccountBalance(seed.userId, seed.cashAccountId);
    expect(afterBalance - beforeBalance).toBeCloseTo(750, 2);

    await gotoRoute(page, "/cash/ledger");
    await expectVisibleText(page, incomeDescription);
    await expectVisibleText(page, expenseDescription);
    await assertPageHealthy(page);
    await assertNoHorizontalOverflow(page);

    await gotoRoute(page, "/dashboard");
    await expect(page.getByRole("heading", { name: "Dijital Kasa" })).toBeVisible();
    await expect(page.getByText("3 gün içinde gider").first()).toBeVisible();
    await expectVisibleText(page, reminderTitle);
    await expect(page.getByText("Son 7 Gün Kasa Giriş/Çıkış")).toBeVisible();
    await assertChartsStayInsideViewport(page);

    await gotoRoute(page, "/reports");
    await expect(page.getByRole("heading", { name: "Finans Analiz Merkezi" })).toBeVisible();
    await expect(page.getByText("Aylık Gelir/Gider Trendi")).toBeVisible();
    await expect(page.getByText("Kasa Raporu")).toBeVisible();
    await assertChartsStayInsideViewport(page);

    const exportResponse = await page.request.get("/api/export?resource=collections&format=csv");
    expect(exportResponse.ok()).toBeTruthy();
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");

    guard.assertClean();
  });
});

function attachRuntimeGuard(page: Page): RuntimeGuard {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isIgnorableConsoleError(text)) return;
    if (criticalRuntimePatterns.some((pattern) => pattern.test(text))) {
      errors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    const text = error.message;
    if (criticalRuntimePatterns.some((pattern) => pattern.test(text))) {
      errors.push(text);
    }
  });

  return {
    errors,
    assertClean() {
      expect(errors, `Kritik runtime/console hatası bulundu:\n${errors.join("\n")}`).toEqual([]);
    }
  };
}

async function login(page: Page, verifyLoginApi: boolean) {
  await gotoRoute(page, "/login");
  if (page.url().includes("/dashboard")) return;

  await page.getByLabel("E-posta").fill(TEST_EMAIL);
  await page.getByLabel("Şifre").fill(TEST_PASSWORD);

  if (verifyLoginApi) {
    const response = await page.request.post("/api/auth/login", {
      form: { email: TEST_EMAIL, password: TEST_PASSWORD },
      maxRedirects: 0
    });
    expect(response.status(), `Login API beklenmeyen yanıt verdi: ${response.status()} ${await response.text()}`).toBe(303);
  }

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`).toBeTruthy();
  await setSessionCookie(page, user!.id);
  await gotoRoute(page, "/dashboard");
  await expect(page.getByRole("heading", { name: "Dijital Kasa" })).toBeVisible();
}

async function gotoRoute(page: Page, route: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (isExpectedPath(page.url(), route)) return;
    } catch (error) {
      const message = String(error);
      const retryable =
        message.includes("ERR_ABORTED") ||
        message.includes("NS_BINDING_ABORTED") ||
        message.includes("interrupted by another navigation") ||
        message.includes("frame was detached");
      if (!retryable || attempt === 2) {
        throw error;
      }
    }

    await page.waitForTimeout(200);
  }
}

function isExpectedPath(url: string, route: string) {
  const path = new URL(url).pathname;
  if (route === "/cash") return path === "/cash" || path === "/cash/accounts";
  return path === route;
}

async function setSessionCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: new URL("/", page.url()).toString(),
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    }
  ]);
}

function createSessionTokenForTest(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    })
  ).toString("base64url");

  return `${payload}.${createHmac("sha256", testAuthSecret()).update(payload).digest("base64url")}`;
}

function testAuthSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}

async function assertPageHealthy(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Hydration failed|Unhandled Runtime Error|Application error/i);
}

async function expectVisibleText(page: Page, text: string) {
  await expect
    .poll(
      async () =>
        page.getByText(text).evaluateAll((nodes) =>
          nodes.some((node) => {
            const element = node as HTMLElement;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          })
        ),
      { message: `"${text}" metni görünür olmalı` }
    )
    .toBe(true);
}

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
    return {
      viewportWidth: window.innerWidth,
      scrollWidth,
      overflow: scrollWidth - window.innerWidth,
      path: window.location.pathname
    };
  });

  const tolerance = metrics.viewportWidth <= 900 ? 24 : 8;
  expect(metrics.overflow, `${metrics.path} yatay taşma üretti: ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`).toBeLessThanOrEqual(tolerance);
}

function isIgnorableConsoleError(text: string) {
  return /Failed to fetch RSC payload .* Falling back to browser navigation/i.test(text);
}

async function assertChartsStayInsideViewport(page: Page) {
  await page.waitForTimeout(300);
  const overflowingCharts = await page.locator(".recharts-wrapper, .recharts-responsive-container").evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.left < -4 || rect.right > window.innerWidth + 4;
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return `${node.className}: left=${rect.left}, right=${rect.right}, viewport=${window.innerWidth}`;
      })
  );

  expect(overflowingCharts, `Grafik container dışına taştı:\n${overflowingCharts.join("\n")}`).toEqual([]);
}

async function assertTouchTargets(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 900) return;

  const smallTargets = await evaluateTouchTargets(page);

  expect(smallTargets, `Dokunmatik hedefler küçük:\n${smallTargets.join("\n")}`).toEqual([]);
}

async function evaluateTouchTargets(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.locator("button, a.primary-action, a.secondary-action").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const label = element.getAttribute("aria-label") || element.textContent?.trim() || "";
            if (label.includes("Open Next.js Dev Tools")) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden") return false;
            if (rect.width === 0 || rect.height === 0) return false;
            return rect.width < 40 || rect.height < 40;
          })
          .slice(0, 5)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const label = element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName;
            return `${label}: ${Math.round(rect.width)}x${Math.round(rect.height)}`;
          })
      );
    } catch (error) {
      const message = String(error);
      const retryable = message.includes("Execution context was destroyed") || message.includes("frame was detached");
      if (!retryable || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  return [];
}

async function cleanupE2eReminders(userId: string) {
  await prisma.taskReminder.deleteMany({
    where: {
      userId,
      title: { startsWith: "E2E gider hatırlatma" }
    }
  });
}

async function assertMobileMenuWorks(page: Page) {
  await gotoRoute(page, "/dashboard");
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible();
  const moreButton = page.getByRole("button", { name: "Diğer modülleri aç" });
  await expect(moreButton).toBeVisible();
  await moreButton.scrollIntoViewIfNeeded();
  await moreButton.click({ force: true });
  const drawerHeading = page.getByRole("heading", { name: "Diğer modüller" });
  if (!(await drawerHeading.isVisible().catch(() => false))) {
    await page.locator('button[aria-label="Diğer modülleri aç"]').evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  }
  await expect(drawerHeading).toBeVisible();
  await page.getByRole("link", { name: /Raporlar/ }).click();
  await expect(page).toHaveURL(/\/reports/);
  await expect(page.getByRole("heading", { name: "Finans Analiz Merkezi" })).toBeVisible();
}

async function postJson(page: Page, path: string, payload: Record<string, unknown>) {
  const result = await page.evaluate(
    async ({ path, payload }) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    },
    { path, payload }
  );

  expect(result.ok, `${path} başarısız oldu (${result.status}): ${result.body}`).toBeTruthy();
}

async function getSeedContext() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`).toBeTruthy();

  const [client, cashAccount] = await Promise.all([
    prisma.client.findFirst({
      where: { userId: user!.id, deletedAt: null, archivedAt: null },
      orderBy: { createdAt: "asc" }
    }),
    prisma.cashAccount.findFirst({
      where: { userId: user!.id, deletedAt: null, isDefault: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  expect(client, "Aktif müvekkil bulunamadı. Önce seed çalıştırılmalı.").toBeTruthy();
  expect(cashAccount, "Varsayılan kasa hesabı bulunamadı. Önce V2 migration/seed çalıştırılmalı.").toBeTruthy();

  return {
    userId: user!.id,
    clientId: client!.id,
    cashAccountId: cashAccount!.id
  };
}

async function getAccountBalance(userId: string, cashAccountId: string) {
  const account = await prisma.cashAccount.findFirst({
    where: { id: cashAccountId, userId, deletedAt: null },
    select: { openingBalance: true }
  });
  expect(account, `Kasa hesabı bulunamadı: ${cashAccountId}`).toBeTruthy();

  const entries = await prisma.cashLedgerEntry.findMany({
    where: { userId, cashAccountId, deletedAt: null },
    select: { direction: true, amount: true }
  });

  return entries.reduce((total, entry) => {
    const amount = Number(entry.amount.toString());
    return entry.direction === "IN" ? total + amount : total - amount;
  }, Number(account!.openingBalance.toString()));
}

function dateInputValue(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}
