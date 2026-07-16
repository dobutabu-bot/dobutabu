import "dotenv/config";

import { createHmac } from "crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

const v3RouteGroups = [
  {
    name: "core-finance",
    routes: ["/dashboard", "/clients", "/cases", "/collections", "/expenses", "/receipts", "/cash", "/cash/accounts", "/cash/ledger"]
  },
  {
    name: "documents-and-bank-import",
    routes: ["/documents", "/documents/new", "/documents/missing", "/documents/unlinked", "/bank-statements", "/bank-statements/import", "/bank-statements/analysis"]
  },
  {
    name: "reconciliation-and-capital",
    routes: ["/reconciliation", "/cash/reconciliation", "/capital", "/capital/assets", "/capital/history", "/capital/import"]
  },
  {
    name: "reports-search-settings",
    routes: ["/reports", "/search", "/settings", "/settings/transaction-rules"]
  }
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

type TestContext = {
  userId: string;
  cashAccountId: string;
};

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 release gates", () => {
  for (const group of v3RouteGroups) {
    test(`auth, V3 route matrix and runtime console gates stay clean: ${group.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      const guard = attachRuntimeGuard(page);
      await loginByCookie(page);

      for (const route of group.routes) {
        await gotoRoute(page, route);
        await assertPageHealthy(page);
        await assertNoHorizontalOverflow(page);
        await assertTouchTargets(page);

        if (route === "/dashboard") {
          await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
          await expect(page.locator('[data-dashboard-version="v5"]')).toBeVisible();
          await expect(page.getByTestId("v5-monthly-metric-cards").locator("article")).toHaveCount(5);
        }

        if (route === "/documents") {
          await expect(page.locator("main").getByRole("heading", { name: "Belgeler" })).toBeVisible();
        }

        if (route === "/bank-statements/import") {
          await expect(page.locator("main").getByRole("heading", { name: "Banka Ekstresi Yükleme Sihirbazı" })).toBeVisible();
        }

        if (route === "/capital") {
          await expect(page.locator("main").getByRole("heading", { name: "Sermaye / Varlık Merkezi" })).toBeVisible();
        }

        if (route === "/reports") {
          await expect(page.locator("main").getByRole("heading", { name: "Dijital Finans Analiz Merkezi" })).toBeVisible();
        }
      }

      guard.assertClean();
    });
  }

  test("global search, privacy mode and mobile navigation gates pass", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const guard = attachRuntimeGuard(page);
    await loginByCookie(page);

    await assertGlobalSearchOpens(page);
    await assertPrivacyModeMasksAmounts(page);
    if (["iphone", "android", "tablet"].includes(testInfo.project.name)) {
      await assertMobileNavigation(page);
    }

    guard.assertClean();
  });

  test("V1/V2 core CRUD, soft delete, audit log and cash ledger gates pass", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== "chromium-desktop", "Veri değiştiren release gate tek Chromium desktop projesinde çalışır.");

    await loginByCookie(page);
    const context = await getTestContext();
    const stamp = uniqueStamp();
    const created = {
      clientId: null as string | null,
      caseFileId: null as string | null,
      incomeId: null as string | null,
      incomeLedgerId: null as string | null,
      expenseId: null as string | null,
      expenseLedgerId: null as string | null,
      receiptId: null as string | null
    };

    try {
      await postJson(page, "/api/clients", {
        name: `Release Gate Müvekkil ${stamp}`,
        type: "INDIVIDUAL",
        tcNo: "",
        taxNo: "",
        email: "",
        phone: "",
        address: "",
        notes: "V3 release gate create"
      });
      const client = await prisma.client.findFirstOrThrow({
        where: { userId: context.userId, name: `Release Gate Müvekkil ${stamp}` }
      });
      created.clientId = client.id;

      await patchJson(page, `/api/clients/${client.id}`, {
        name: `Release Gate Müvekkil Güncel ${stamp}`,
        type: "INDIVIDUAL",
        tcNo: "",
        taxNo: "",
        email: "",
        phone: "05550000000",
        address: "",
        notes: "V3 release gate update"
      });
      await expect.poll(() => prisma.client.count({ where: { id: client.id, phone: "05550000000", deletedAt: null } })).toBe(1);

      await postJson(page, "/api/cases", {
        clientId: client.id,
        title: `Release Gate Dosya ${stamp}`,
        fileNumber: `RG-${stamp}`,
        courtOrOffice: "İstanbul Test Dairesi",
        caseType: "Release Gate",
        status: "ACTIVE",
        notes: "CRUD gate"
      });
      const caseFile = await prisma.caseFile.findFirstOrThrow({
        where: { userId: context.userId, clientId: client.id, title: `Release Gate Dosya ${stamp}` }
      });
      created.caseFileId = caseFile.id;

      await patchJson(page, `/api/cases/${caseFile.id}`, {
        clientId: client.id,
        title: `Release Gate Dosya Güncel ${stamp}`,
        fileNumber: `RG-${stamp}-U`,
        courtOrOffice: "İstanbul Test Dairesi",
        caseType: "Release Gate",
        status: "ACTIVE",
        notes: "CRUD gate update"
      });
      await expect.poll(() => prisma.caseFile.count({ where: { id: caseFile.id, title: `Release Gate Dosya Güncel ${stamp}`, deletedAt: null } })).toBe(1);

      await postJson(page, "/api/collections", {
        clientId: client.id,
        caseFileId: caseFile.id,
        cashAccountId: context.cashAccountId,
        amount: "1200.00",
        currency: "TRY",
        date: todayInput(),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: `Release Gate Tahsilat ${stamp}`,
        receiptIssued: false,
        receiptNumber: ""
      });
      const income = await prisma.income.findFirstOrThrow({
        where: { userId: context.userId, description: `Release Gate Tahsilat ${stamp}` }
      });
      created.incomeId = income.id;
      const incomeLedger = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { incomeId: income.id } });
      created.incomeLedgerId = incomeLedger.id;
      expect(incomeLedger.direction).toBe("IN");
      expect(Number(incomeLedger.amount.toString())).toBeCloseTo(1200, 2);

      await patchJson(page, `/api/collections/${income.id}`, {
        clientId: client.id,
        caseFileId: caseFile.id,
        cashAccountId: context.cashAccountId,
        amount: "1500.50",
        currency: "TRY",
        date: todayInput(),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: `Release Gate Tahsilat Güncel ${stamp}`,
        receiptIssued: true,
        receiptNumber: `RG-${stamp}`
      });
      await expect.poll(async () => Number((await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { incomeId: income.id } })).amount.toString())).toBeCloseTo(1500.5, 2);

      await postJson(page, "/api/expenses", {
        clientId: client.id,
        caseFileId: caseFile.id,
        cashAccountId: context.cashAccountId,
        amount: "300.00",
        currency: "TRY",
        date: todayInput(),
        paymentMethod: "BANK_TRANSFER",
        category: "OFFICE",
        isClientExpense: true,
        description: `Release Gate Gider ${stamp}`
      });
      const expense = await prisma.expense.findFirstOrThrow({
        where: { userId: context.userId, description: `Release Gate Gider ${stamp}` }
      });
      created.expenseId = expense.id;
      const expenseLedger = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { expenseId: expense.id } });
      created.expenseLedgerId = expenseLedger.id;
      expect(expenseLedger.direction).toBe("OUT");
      expect(Number(expenseLedger.amount.toString())).toBeCloseTo(300, 2);

      await patchJson(page, `/api/expenses/${expense.id}`, {
        clientId: client.id,
        caseFileId: caseFile.id,
        cashAccountId: context.cashAccountId,
        amount: "450.25",
        currency: "TRY",
        date: todayInput(),
        paymentMethod: "BANK_TRANSFER",
        category: "TAX",
        isClientExpense: false,
        description: `Release Gate Gider Güncel ${stamp}`
      });
      await expect.poll(async () => Number((await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { expenseId: expense.id } })).amount.toString())).toBeCloseTo(450.25, 2);

      await postJson(page, "/api/receipts", {
        clientId: client.id,
        caseFileId: caseFile.id,
        number: `RG-BELGE-${stamp}`,
        type: "E_SMM",
        status: "ISSUED",
        issueDate: todayInput(),
        grossAmount: "1500.50",
        vatAmount: "300.10",
        withholdingAmount: "0",
        netAmount: "1500.50",
        notes: "Release gate belge"
      });
      const receipt = await prisma.invoiceOrReceipt.findFirstOrThrow({
        where: { userId: context.userId, number: `RG-BELGE-${stamp}` }
      });
      created.receiptId = receipt.id;

      await deleteJson(page, `/api/receipts/${receipt.id}`);
      await expect.poll(async () => (await prisma.invoiceOrReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe("CANCELLED");

      await deleteJson(page, `/api/collections/${income.id}`);
      await expectSoftDeleted("income", income.id);
      await expectLedgerSoftDeleted(incomeLedger.id);

      await deleteJson(page, `/api/expenses/${expense.id}`);
      await expectSoftDeleted("expense", expense.id);
      await expectLedgerSoftDeleted(expenseLedger.id);

      await deleteJson(page, `/api/cases/${caseFile.id}`);
      await expectSoftDeleted("caseFile", caseFile.id);

      await postJson(page, `/api/clients/${client.id}/archive`, {});
      await expectSoftDeleted("client", client.id);

      const auditCount = await prisma.auditLog.count({
        where: {
          userId: context.userId,
          entityId: {
            in: [
              client.id,
              caseFile.id,
              income.id,
              incomeLedger.id,
              expense.id,
              expenseLedger.id,
              receipt.id
            ]
          }
        }
      });
      expect(auditCount).toBeGreaterThanOrEqual(10);
    } finally {
      await cleanupCreatedRecords(context.userId, created);
    }
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

async function loginByCookie(page: Page) {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`).toBeTruthy();

  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(user!.id),
      url: new URL("/", TEST_BASE_URL).toString(),
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    }
  ]);

  await gotoRoute(page, "/dashboard");
  await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
  await expect(page.locator('[data-dashboard-version="v5"]')).toBeVisible();
}

async function gotoRoute(page: Page, route: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (isExpectedPath(page.url(), route)) {
        await waitForBodyReady(page);
        await waitForClientRouteSettled(page);
        return;
      }
    } catch (error) {
      const message = String(error);
      const retryable =
        message.includes("ERR_ABORTED") ||
        message.includes("NS_BINDING_ABORTED") ||
        message.includes("interrupted by another navigation") ||
        message.includes("frame was detached");
      if (!retryable || attempt === 2) throw error;
    }

    await page.waitForTimeout(200);
  }
}

async function waitForBodyReady(page: Page) {
  await page.waitForFunction(
    () => document.readyState !== "loading" && document.body.innerText.trim().length > 0,
    null,
    { timeout: 30_000 }
  );
}

async function waitForClientRouteSettled(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(100);
}

function isExpectedPath(url: string, route: string) {
  const path = new URL(url).pathname;
  if (route === "/cash") return path === "/cash" || path === "/cash/accounts";
  return path === route;
}

async function assertPageHealthy(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Hydration failed|Unhandled Runtime Error|Application error/i);
}

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await evaluateHorizontalOverflow(page);

  const tolerance = metrics.viewportWidth <= 900 ? 24 : 8;
  expect(metrics.overflow, `${metrics.path} yatay taşma üretti: ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`).toBeLessThanOrEqual(tolerance);
}

async function evaluateHorizontalOverflow(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(() => {
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
    } catch (error) {
      const message = String(error);
      const retryable = message.includes("Execution context was destroyed") || message.includes("frame was detached");
      if (!retryable || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  return {
    viewportWidth: 0,
    scrollWidth: 0,
    overflow: 0,
    path: page.url()
  };
}

async function assertTouchTargets(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 900) return;

  const smallTargets = await evaluateTouchTargets(page);

  expect(smallTargets, `Dokunmatik hedefler küçük:\n${smallTargets.join("\n")}`).toEqual([]);
}

async function assertGlobalSearchOpens(page: Page) {
  await gotoRoute(page, "/dashboard");
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible();
  const desktopTrigger = page.getByTestId("global-search-trigger");
  const mobileTrigger = page.getByTestId("global-search-mobile-trigger");
  const trigger = (await desktopTrigger.isVisible().catch(() => false)) ? desktopTrigger : mobileTrigger;
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId("global-search-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("global-search-dialog")).toBeHidden();
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
            return rect.width < 44 || rect.height < 44;
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

function isIgnorableConsoleError(text: string) {
  return /Failed to fetch RSC payload .* Falling back to browser navigation/i.test(text);
}

async function assertPrivacyModeMasksAmounts(page: Page) {
  await gotoRoute(page, "/dashboard");
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible();
  const toggle = page.getByTestId("privacy-mode-toggle").first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("data-mounted", "true");

  const isAlreadyEnabled = await toggle.evaluate((element) => element.getAttribute("aria-pressed") === "true");
  if (!isAlreadyEnabled) {
    await toggle.click();
  }

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.privacyMode))
    .toBe("on");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const element = document.querySelector(".privacy-amount");
        if (!element) return "";
        return window.getComputedStyle(element, "::after").content;
      })
    )
    .toContain("•••••");

  const showToggle = page.getByTestId("privacy-mode-toggle").first();
  if (await showToggle.isVisible().catch(() => false)) {
    await showToggle.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.privacyMode)).toBe("off");
  }
}

async function assertMobileNavigation(page: Page) {
  await gotoRoute(page, "/dashboard");
  const moreButton = page.getByRole("button", { name: "Diğer modülleri aç" });
  await expect(moreButton).toBeVisible();
  await moreButton.click({ force: true });
  await expect(page.getByRole("heading", { name: "Diğer modüller" })).toBeVisible();
  await page.getByRole("link", { name: /Belgeler/ }).click();
  await expect(page).toHaveURL(/\/documents/);
}

async function postJson(page: Page, path: string, payload: Record<string, unknown>) {
  await jsonRequest(page, "POST", path, payload);
}

async function patchJson(page: Page, path: string, payload: Record<string, unknown>) {
  await jsonRequest(page, "PATCH", path, payload);
}

async function deleteJson(page: Page, path: string) {
  await jsonRequest(page, "DELETE", path, {});
}

async function jsonRequest(page: Page, method: "POST" | "PATCH" | "DELETE", path: string, payload: Record<string, unknown>) {
  const result = await page.evaluate(
    async ({ method, path, payload }) => {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(payload)
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    },
    { method, path, payload }
  );

  expect(result.ok, `${method} ${path} başarısız oldu (${result.status}): ${result.body}`).toBeTruthy();
}

async function getTestContext(): Promise<TestContext> {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`).toBeTruthy();

  const cashAccount = await prisma.cashAccount.findFirst({
    where: { userId: user!.id, deletedAt: null, isDefault: true },
    orderBy: { createdAt: "asc" }
  });
  expect(cashAccount, "Varsayılan kasa hesabı bulunamadı. Seed/migration kontrol edilmeli.").toBeTruthy();

  return { userId: user!.id, cashAccountId: cashAccount!.id };
}

async function expectSoftDeleted(model: "client" | "caseFile" | "income" | "expense", id: string) {
  const record = await prisma[model].findUniqueOrThrow({ where: { id }, select: { deletedAt: true } });
  expect(record.deletedAt).not.toBeNull();
}

async function expectLedgerSoftDeleted(id: string) {
  const record = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } });
  expect(record.deletedAt).not.toBeNull();
}

async function cleanupCreatedRecords(userId: string, created: {
  clientId: string | null;
  caseFileId: string | null;
  incomeId: string | null;
  incomeLedgerId: string | null;
  expenseId: string | null;
  expenseLedgerId: string | null;
  receiptId: string | null;
}) {
  const entityIds = [
    created.clientId,
    created.caseFileId,
    created.incomeId,
    created.incomeLedgerId,
    created.expenseId,
    created.expenseLedgerId,
    created.receiptId
  ].filter(Boolean) as string[];

  await prisma.auditLog.deleteMany({ where: { userId, entityId: { in: entityIds } } });
  if (created.incomeLedgerId || created.expenseLedgerId) {
    await prisma.cashLedgerEntry.deleteMany({
      where: { id: { in: [created.incomeLedgerId, created.expenseLedgerId].filter(Boolean) as string[] } }
    });
  }
  if (created.receiptId) await prisma.invoiceOrReceipt.deleteMany({ where: { id: created.receiptId } });
  if (created.incomeId) await prisma.income.deleteMany({ where: { id: created.incomeId } });
  if (created.expenseId) await prisma.expense.deleteMany({ where: { id: created.expenseId } });
  if (created.caseFileId) await prisma.caseFile.deleteMany({ where: { id: created.caseFileId } });
  if (created.clientId) await prisma.client.deleteMany({ where: { id: created.clientId } });
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

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
