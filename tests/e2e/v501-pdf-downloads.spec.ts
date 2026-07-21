import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const marker = `PDF-SMOKE-TEST-${Date.now()}-${process.pid}`;
const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

type Fixture = {
  clientId: string;
  caseFileId: string;
  incomeId: string;
  expenseId: string;
  bankImportId: string;
};

let fixture: Fixture;

test.beforeAll(async () => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`PDF smoke kullanıcısı bulunamadı: ${email}`);

  const client = await prisma.client.create({
    data: { userId: user.id, name: `${marker} Müvekkil`, notes: marker }
  });
  const caseFile = await prisma.caseFile.create({
    data: {
      userId: user.id,
      clientId: client.id,
      title: `${marker} Dosya`,
      fileNumber: `PDF-${Date.now()}`,
      status: "ACTIVE",
      notes: marker
    }
  });
  const income = await prisma.income.create({
    data: {
      userId: user.id,
      clientId: client.id,
      caseFileId: caseFile.id,
      amount: new Prisma.Decimal("1250.50"),
      date: new Date(),
      description: `${marker} Tahsilat`
    }
  });
  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      clientId: client.id,
      caseFileId: caseFile.id,
      amount: new Prisma.Decimal("275.25"),
      date: new Date(),
      description: `${marker} Gider`
    }
  });
  const bankImport = await prisma.bankStatementImport.create({
    data: {
      userId: user.id,
      bankName: "PDF Smoke Test Bankası",
      sourceType: "CSV",
      status: "IMPORTED",
      fileName: `${marker}.csv`,
      originalFileName: `${marker}.csv`,
      mimeType: "text/csv",
      fileSize: 128,
      storagePath: `test/${marker}.csv`,
      fileHash: marker,
      totalRows: 1,
      successfulRows: 1
    }
  });
  await prisma.bankStatementRow.create({
    data: {
      userId: user.id,
      importId: bankImport.id,
      rowNumber: 1,
      transactionDate: new Date(),
      description: `${marker} Banka Girişi`,
      creditAmount: new Prisma.Decimal("1250.50"),
      amount: new Prisma.Decimal("1250.50"),
      direction: "IN",
      rawHash: `${marker}-row-1`
    }
  });

  fixture = {
    clientId: client.id,
    caseFileId: caseFile.id,
    incomeId: income.id,
    expenseId: expense.id,
    bankImportId: bankImport.id
  };
});

test.afterAll(async () => {
  const deletedAt = new Date();
  if (fixture) {
    await prisma.$transaction([
      prisma.bankStatementRow.updateMany({ where: { importId: fixture.bankImportId }, data: { deletedAt } }),
      prisma.bankStatementImport.updateMany({ where: { id: fixture.bankImportId }, data: { deletedAt } }),
      prisma.income.updateMany({ where: { id: fixture.incomeId }, data: { deletedAt } }),
      prisma.expense.updateMany({ where: { id: fixture.expenseId }, data: { deletedAt } }),
      prisma.caseFile.updateMany({ where: { id: fixture.caseFileId }, data: { deletedAt } }),
      prisma.client.updateMany({ where: { id: fixture.clientId }, data: { deletedAt } })
    ]);
  }
  await prisma.$disconnect();
});

const downloadTargets = [
  { name: "Aylık finans", page: () => "/reports", label: "Aylık PDF" },
  { name: "Kasa", page: () => "/reports", label: "Kasa PDF" },
  { name: "Belge", page: () => "/reports", label: "Belge PDF" },
  { name: "Banka hareketleri", page: () => "/reports", label: "Banka PDF" },
  { name: "Mutabakat", page: () => "/reports", label: "Mutabakat PDF" },
  { name: "Sermaye", page: () => "/reports", label: "Sermaye PDF" },
  { name: "Avans", page: () => "/advances", label: "PDF Rapor" },
  { name: "Müvekkil cari", page: () => `/clients/${fixture.clientId}`, label: "PDF indir" },
  { name: "Dosya finans", page: () => `/cases/${fixture.caseFileId}`, label: "PDF indir" },
  { name: "Tahsilat", page: () => `/collections/${fixture.incomeId}`, label: "PDF indir" },
  { name: "Gider", page: () => `/expenses/${fixture.expenseId}`, label: "PDF indir" },
  { name: "Banka analizi", page: () => `/bank-statements/${fixture.bankImportId}`, label: "PDF Analiz" }
] as const;

for (const target of downloadTargets) {
  test(`${target.name} PDF gerçek kullanıcı tıklamasıyla indirilir ve ayrıştırılır`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await login(page);
    await page.goto(target.page());
    await expect(page).not.toHaveURL(/\/login/);
    await expectRealPdfDownload(page, target.label);

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: "Giriş yap" }).click()]);
}

async function expectRealPdfDownload(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  await expect(page.getByRole("status")).toContainText("PDF indirme işlemi başlatıldı.");

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error(`${label}: indirilen dosya yolu bulunamadı.`);
  const buffer = await readFile(downloadPath);
  expect(buffer.subarray(0, 5).toString("utf8"), `${label}: PDF imzası`).toBe("%PDF-");
  expect(buffer.byteLength, `${label}: PDF boyutu`).toBeGreaterThan(1_500);

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    expect((parsed.text ?? "").trim().length, `${label}: ayrıştırılmış içerik`).toBeGreaterThan(20);
  } finally {
    await parser.destroy();
  }
}
