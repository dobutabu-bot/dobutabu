import "dotenv/config";

import { createHmac } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

const criticalRuntimePatterns = [
  /hydration/i,
  /Unhandled Runtime Error/i,
  /Application error/i,
  /ReferenceError/i,
  /TypeError/i,
  /Minified React error/i
];

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 dashboard and reports chart performance", () => {
  test("loads V3 dashboard summary on mobile and renders lazy charts", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Dashboard grafik testi tek Chromium projesinde çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const fixture = await createFinanceFixture(user!.id);
    const guard = attachRuntimeGuard(page);

    try {
      await setSessionCookie(page, user!.id);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");

      await expect(page.locator('[data-dashboard-version="v5"]')).toBeVisible();
      await expect(page.getByTestId("v5-net-worth-chart")).toBeVisible();
      await expect(page.getByTestId("v3-dashboard-tab-capital")).toHaveAttribute("href", "/capital");
      await expect(page.getByRole("region", { name: "Bugünün finans özeti" })).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(8);

      await expect(page.getByTestId("v5-monthly-metric-cards").locator("article")).toHaveCount(5);
      await expect(page.locator(".recharts-responsive-container").first()).toBeVisible({ timeout: 15_000 });

      guard.assertClean();
    } finally {
      await cleanupFinanceFixture(user!.id, fixture);
    }
  });

  test("shows V3 report tabs, renders chart frames and keeps empty states stable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Rapor grafik testi tek Chromium projesinde çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const guard = attachRuntimeGuard(page);
    await setSessionCookie(page, user!.id);

    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Dijital Finans Analiz Merkezi" })).toBeVisible();
    await expect(page.getByText("Raporlar V4")).toBeVisible();
    await expect(page.getByRole("link", { name: /Belge/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Banka/ }).first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('[data-testid="chart-skeleton"], [data-testid="chart-frame"]').first()).toBeVisible();
    await expect(page.getByTestId("chart-frame").first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/reports?range=custom&startDate=2099-01-01&endDate=2099-01-02");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText("Grafik için veri yok").first()).toBeVisible({ timeout: 15_000 });

    guard.assertClean();
  });
});

async function createFinanceFixture(userId: string) {
  const stamp = uniqueStamp();
  const clientId = `chart-client-${stamp}`;
  const incomeId = `chart-income-${stamp}`;
  const expenseId = `chart-expense-${stamp}`;
  const cashAccountId = `chart-cash-${stamp}`;
  const cashInId = `chart-cash-in-${stamp}`;
  const cashOutId = `chart-cash-out-${stamp}`;
  const date = new Date("2026-07-07T10:00:00+03:00");

  await prisma.client.create({
    data: {
      id: clientId,
      userId,
      name: `Chart Test Müvekkili ${stamp}`,
      type: "INDIVIDUAL"
    }
  });

  await prisma.cashAccount.create({
    data: {
      id: cashAccountId,
      userId,
      name: `Chart Test Kasa ${stamp}`,
      type: "CASH",
      currency: "TRY",
      openingBalance: 0,
      isActive: true
    }
  });

  await prisma.income.create({
    data: {
      id: incomeId,
      userId,
      clientId,
      cashAccountId,
      amount: 12500,
      currency: "TRY",
      date,
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: `Chart test tahsilat ${stamp}`
    }
  });

  await prisma.expense.create({
    data: {
      id: expenseId,
      userId,
      clientId,
      cashAccountId,
      amount: 3750,
      currency: "TRY",
      date,
      paymentMethod: "BANK_TRANSFER",
      category: "OFFICE",
      description: `Chart test gider ${stamp}`
    }
  });

  await prisma.cashLedgerEntry.createMany({
    data: [
      {
        id: cashInId,
        userId,
        cashAccountId,
        direction: "IN",
        entryType: "INCOME",
        amount: 12500,
        currency: "TRY",
        date,
        description: `Chart test kasa girişi ${stamp}`,
        incomeId,
        clientId
      },
      {
        id: cashOutId,
        userId,
        cashAccountId,
        direction: "OUT",
        entryType: "EXPENSE",
        amount: 3750,
        currency: "TRY",
        date,
        description: `Chart test kasa çıkışı ${stamp}`,
        expenseId,
        clientId
      }
    ]
  });

  return { clientId, incomeId, expenseId, cashAccountId, cashEntryIds: [cashInId, cashOutId] };
}

async function cleanupFinanceFixture(
  userId: string,
  fixture: {
    clientId: string;
    incomeId: string;
    expenseId: string;
    cashAccountId: string;
    cashEntryIds: string[];
  }
) {
  await prisma.auditLog.deleteMany({
    where: {
      userId,
      entityId: { in: [fixture.clientId, fixture.incomeId, fixture.expenseId, fixture.cashAccountId, ...fixture.cashEntryIds] }
    }
  });
  await prisma.cashLedgerEntry.deleteMany({ where: { userId, id: { in: fixture.cashEntryIds } } });
  await prisma.income.deleteMany({ where: { userId, id: fixture.incomeId } });
  await prisma.expense.deleteMany({ where: { userId, id: fixture.expenseId } });
  await prisma.cashAccount.deleteMany({ where: { userId, id: fixture.cashAccountId } });
  await prisma.client.deleteMany({ where: { userId, id: fixture.clientId } });
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-z0-9-]/gi, "");
}

function attachRuntimeGuard(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
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
    assertClean() {
      expect(errors, `Kritik runtime/console hatası bulundu:\n${errors.join("\n")}`).toEqual([]);
    }
  };
}

async function setSessionCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: baseURL,
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
