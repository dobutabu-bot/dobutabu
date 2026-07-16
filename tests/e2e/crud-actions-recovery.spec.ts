import "dotenv/config";

import { createHmac } from "crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("CRUD action recovery", () => {
  test("restore endpoints cover V1/V2/V3 soft-deleted records", async ({ page }) => {
    test.setTimeout(120_000);

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`).toBeTruthy();
    await loginByCookie(page, user!.id);

    const stamp = `crud-action-${Date.now()}`;
    const cashAccount = await prisma.cashAccount.create({
      data: {
        userId: user!.id,
        name: `CRUD Restore Kasa ${stamp}`,
        type: "CASH",
        currency: "TRY",
        openingBalance: "0",
        isActive: false,
        deletedAt: new Date()
      }
    });
    const reminder = await prisma.taskReminder.create({
      data: {
        userId: user!.id,
        title: `CRUD Restore Hatırlatma ${stamp}`,
        dueDate: new Date(),
        reminderType: "GENERAL",
        status: "OPEN",
        priority: "NORMAL",
        deletedAt: new Date()
      }
    });
    const asset = await prisma.assetAccount.create({
      data: {
        userId: user!.id,
        name: `CRUD Restore Varlık ${stamp}`,
        assetType: "OTHER",
        valuationCurrency: "TRY",
        manualTotalValue: "100",
        isActive: false,
        deletedAt: new Date()
      }
    });

    try {
      await postJson(page, `/api/deleted-records/cash-accounts/${cashAccount.id}/restore`);
      await postJson(page, `/api/deleted-records/reminders/${reminder.id}/restore`);
      await postJson(page, `/api/deleted-records/assets/${asset.id}/restore`);

      await expect.poll(async () => {
        const row = await prisma.cashAccount.findUnique({ where: { id: cashAccount.id }, select: { deletedAt: true, isActive: true } });
        return row?.deletedAt === null && row.isActive;
      }).toBeTruthy();
      await expect.poll(async () => {
        const row = await prisma.taskReminder.findUnique({ where: { id: reminder.id }, select: { deletedAt: true } });
        return row?.deletedAt === null;
      }).toBeTruthy();
      await expect.poll(async () => {
        const row = await prisma.assetAccount.findUnique({ where: { id: asset.id }, select: { deletedAt: true, isActive: true } });
        return row?.deletedAt === null && row.isActive;
      }).toBeTruthy();
      await expect.poll(() =>
        prisma.auditLog.count({
          where: {
            userId: user!.id,
            action: "RESTORE",
            entityId: { in: [cashAccount.id, reminder.id, asset.id] }
          }
        })
      ).toBe(3);
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId: user!.id, entityId: { in: [cashAccount.id, reminder.id, asset.id] } } });
      await prisma.assetAccount.deleteMany({ where: { id: asset.id } });
      await prisma.taskReminder.deleteMany({ where: { id: reminder.id } });
      await prisma.cashAccount.deleteMany({ where: { id: cashAccount.id } });
    }
  });
});

async function loginByCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: new URL("/", TEST_BASE_URL).toString(),
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    }
  ]);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText("Dijital Kasa");
}

async function postJson(page: Page, path: string) {
  const result = await page.evaluate(async (targetPath) => {
    const response = await fetch(targetPath, { method: "POST" });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, path);

  expect(result.ok, `POST ${path} başarısız oldu (${result.status}): ${result.body}`).toBeTruthy();
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

