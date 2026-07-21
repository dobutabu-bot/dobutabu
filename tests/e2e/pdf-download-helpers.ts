import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { expect, type APIResponse, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

export type PdfUiTarget = {
  key: string;
  page: string;
  label: string;
  apiPath: string;
  expectedTitle: string;
  filePrefix: string;
  successMessage?: string;
};

export type PdfBrowserFixture = {
  clientId: string;
  caseId: string;
  collectionId: string;
  expenseId: string;
  bankImportId: string;
  cashAccountId: string;
};

export const unauthenticatedPdfPaths = [
  "/api/reports/monthly/pdf",
  "/api/reports/receipts/pdf",
  "/api/reports/cash/pdf",
  "/api/reports/advances/pdf",
  "/api/reports/documents/pdf",
  "/api/reports/bank-statements/pdf",
  "/api/reports/reconciliation/pdf",
  "/api/reports/capital/pdf",
  "/api/reports/client/cm1234567890valid/pdf",
  "/api/reports/case/cm1234567890valid/pdf",
  "/api/reports/collections/cm1234567890valid/pdf",
  "/api/reports/expenses/cm1234567890valid/pdf",
  "/api/reports/bank-analysis/cm1234567890valid/pdf"
] as const;

export async function loginForPdfTests(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard/),
    page.getByRole("button", { name: "Giriş yap" }).click()
  ]);
  await page.waitForLoadState("networkidle");
}

export async function createPdfBrowserFixture(): Promise<PdfBrowserFixture> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  expect(user, "PDF browser testi için oturum kullanıcısı bulunmalı").toBeTruthy();

  const marker = `PDF-SMOKE-TEST-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const cashAccount = await prisma.cashAccount.create({
    data: {
      userId: user!.id,
      name: marker,
      type: "BANK",
      currency: "TRY",
      openingBalance: "1000",
      isActive: true
    }
  });
  const client = await prisma.client.create({
    data: {
      userId: user!.id,
      name: `${marker} Çağrı Müvekkil`,
      type: "COMPANY",
      phone: "0500 000 00 00"
    }
  });
  const caseFile = await prisma.caseFile.create({
    data: {
      userId: user!.id,
      clientId: client.id,
      title: `${marker} İcra Dosyası`,
      fileNumber: "2026/501 E.",
      caseType: "İcra takibi",
      status: "ACTIVE"
    }
  });
  const collection = await prisma.income.create({
    data: {
      userId: user!.id,
      clientId: client.id,
      caseFileId: caseFile.id,
      cashAccountId: cashAccount.id,
      amount: "12345.67",
      currency: "TRY",
      date: new Date(),
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: `${marker} Türkçe tahsilat`
    }
  });
  const expense = await prisma.expense.create({
    data: {
      userId: user!.id,
      clientId: client.id,
      caseFileId: caseFile.id,
      cashAccountId: cashAccount.id,
      amount: "1234.50",
      currency: "TRY",
      date: new Date(),
      paymentMethod: "BANK_TRANSFER",
      category: "TAX",
      isClientExpense: true,
      description: `${marker} Türkçe gider`
    }
  });
  const bankImport = await prisma.bankStatementImport.create({
    data: {
      userId: user!.id,
      cashAccountId: cashAccount.id,
      bankName: "Anonim Test Bankası",
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `${marker}.csv`,
      originalFileName: "anonim-ekstre.csv",
      mimeType: "text/csv",
      fileSize: 256,
      storagePath: `test-only/${marker}.csv`,
      fileHash: marker,
      periodStart: new Date("2026-01-01T12:00:00+03:00"),
      periodEnd: new Date("2026-12-31T12:00:00+03:00"),
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      duplicateRows: 0
    }
  });

  return {
    clientId: client.id,
    caseId: caseFile.id,
    collectionId: collection.id,
    expenseId: expense.id,
    bankImportId: bankImport.id,
    cashAccountId: cashAccount.id
  };
}

export async function cleanupPdfBrowserFixture(fixture: PdfBrowserFixture) {
  await prisma.bankStatementRow.deleteMany({ where: { importId: fixture.bankImportId } });
  await prisma.bankStatementImport.deleteMany({ where: { id: fixture.bankImportId } });
  await prisma.cashLedgerEntry.deleteMany({
    where: {
      OR: [{ incomeId: fixture.collectionId }, { expenseId: fixture.expenseId }]
    }
  });
  await prisma.income.deleteMany({ where: { id: fixture.collectionId } });
  await prisma.expense.deleteMany({ where: { id: fixture.expenseId } });
  await prisma.caseFile.deleteMany({ where: { id: fixture.caseId } });
  await prisma.client.deleteMany({ where: { id: fixture.clientId } });
  await prisma.cashAccount.deleteMany({ where: { id: fixture.cashAccountId } });
}

export async function discoverPdfTargets(_page: Page, fixture: PdfBrowserFixture): Promise<PdfUiTarget[]> {
  const clientHref = `/clients/${fixture.clientId}`;
  const caseHref = `/cases/${fixture.caseId}`;
  const collectionHref = `/collections/${fixture.collectionId}`;
  const expenseHref = `/expenses/${fixture.expenseId}`;
  const bankHref = `/bank-statements/${fixture.bankImportId}`;
  const clientId = fixture.clientId;
  const caseId = fixture.caseId;
  const collectionId = fixture.collectionId;
  const expenseId = fixture.expenseId;
  const bankId = fixture.bankImportId;

  return [
    {
      key: "monthly",
      page: "/reports",
      label: "Aylık PDF",
      apiPath: "/api/reports/monthly/pdf",
      expectedTitle: "Aylık Finans Raporu",
      filePrefix: "aylik-finans"
    },
    {
      key: "cash",
      page: "/reports",
      label: "Kasa PDF",
      apiPath: "/api/reports/cash/pdf",
      expectedTitle: "Kasa Hareketleri Raporu",
      filePrefix: "kasa-hareketleri"
    },
    {
      key: "receipts",
      page: "/receipts",
      label: "PDF indir",
      apiPath: "/api/reports/receipts/pdf",
      expectedTitle: "Makbuz / Fatura Takip Raporu",
      filePrefix: "makbuz-fatura-takip"
    },
    {
      key: "documents",
      page: "/reports",
      label: "Belge PDF",
      apiPath: "/api/reports/documents/pdf",
      expectedTitle: "Belge Raporu",
      filePrefix: "belge-raporu"
    },
    {
      key: "bank-statements",
      page: "/reports",
      label: "Banka PDF",
      apiPath: "/api/reports/bank-statements/pdf",
      expectedTitle: "Banka Ekstresi Analiz Raporu",
      filePrefix: "banka-ekstresi-v3-analiz"
    },
    {
      key: "reconciliation",
      page: "/reports",
      label: "Mutabakat PDF",
      apiPath: "/api/reports/reconciliation/pdf",
      expectedTitle: "Mutabakat Raporu",
      filePrefix: "mutabakat-raporu"
    },
    {
      key: "capital",
      page: "/reports",
      label: "Sermaye PDF",
      apiPath: "/api/reports/capital/pdf",
      expectedTitle: "Sermaye / Varlık Raporu",
      filePrefix: "sermaye-varlik"
    },
    {
      key: "advances",
      page: "/advances",
      label: "PDF Rapor",
      apiPath: "/api/reports/advances/pdf",
      expectedTitle: "Masraf Avansları Raporu",
      filePrefix: "masraf-avanslari"
    },
    {
      key: "client",
      page: clientHref,
      label: "PDF indir",
      apiPath: `/api/reports/client/${clientId}/pdf`,
      expectedTitle: "Müvekkil Cari Raporu",
      filePrefix: "muvekkil-cari"
    },
    {
      key: "case",
      page: caseHref,
      label: "PDF indir",
      apiPath: `/api/reports/case/${caseId}/pdf`,
      expectedTitle: "Dosya Finans Raporu",
      filePrefix: "dosya-finans"
    },
    {
      key: "collection",
      page: collectionHref,
      label: "PDF indir",
      apiPath: `/api/reports/collections/${collectionId}/pdf`,
      expectedTitle: "Tahsilat Makbuz / Özet PDF",
      filePrefix: "tahsilat-ozet"
    },
    {
      key: "expense",
      page: expenseHref,
      label: "PDF indir",
      apiPath: `/api/reports/expenses/${expenseId}/pdf`,
      expectedTitle: "Gider Özet PDF",
      filePrefix: "gider-ozet"
    },
    {
      key: "bank-analysis",
      page: bankHref,
      label: "PDF Analiz",
      apiPath: `/api/reports/bank-analysis/${bankId}/pdf`,
      expectedTitle: "Banka Ekstresi Analiz Raporu",
      filePrefix: "banka-ekstresi-analiz"
    }
  ];
}

export async function assertPdfApiResponse(response: APIResponse, target: PdfUiTarget) {
  expect(response.status(), `${target.key}: HTTP 200`).toBe(200);
  expect(response.headers()["content-type"], `${target.key}: content type`).toMatch(/^application\/pdf(?:;|$)/i);
  expect(response.headers()["content-disposition"], `${target.key}: attachment`).toMatch(/^attachment;/i);
  expect(response.headers()["content-disposition"], `${target.key}: güvenli dosya adı`).toMatch(
    /filename="[A-Za-z0-9._ -]+\.pdf"/
  );
  expect(response.headers()["content-disposition"], `${target.key}: UTF-8 dosya adı`).toMatch(
    /filename\*=UTF-8''[^;\r\n]+\.pdf/i
  );
  expect(response.headers()["content-disposition"], `${target.key}: dosya prefix`).toContain(target.filePrefix);
  expect(response.headers()["cache-control"], `${target.key}: private cache`).toMatch(/private.*no-store/);

  const bytes = await response.body();
  await assertParsedPdf(bytes, target);
}

export async function assertRealPdfDownload(page: Page, target: PdfUiTarget) {
  await page.goto(target.page, { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);

  const button = page.getByRole("button", { name: target.label, exact: true });
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  const [response, download] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.pathname === new URL(target.apiPath, "http://pdf.test").pathname;
    }),
    page.waitForEvent("download"),
    button.click()
  ]);

  expect(response.status(), `${target.key}: browser response`).toBe(200);
  expect(response.headers()["content-type"], `${target.key}: browser MIME`).toMatch(/^application\/pdf(?:;|$)/i);
  expect(download.suggestedFilename(), `${target.key}: browser filename`).toMatch(/^[^/\\\r\n]+\.pdf$/i);
  expect(download.suggestedFilename(), `${target.key}: browser filename prefix`).toContain(target.filePrefix);

  const downloadPath = await download.path();
  expect(downloadPath, `${target.key}: disk download path`).toBeTruthy();
  const bytes = await readFile(downloadPath!);
  await assertParsedPdf(bytes, target);
  await expect(page.getByRole("status")).toContainText(
    target.successMessage ?? "PDF indirme işlemi başlatıldı."
  );
}

async function assertParsedPdf(bytes: Buffer, target: PdfUiTarget) {
  expect(bytes.byteLength, `${target.key}: anlamlı PDF boyutu`).toBeGreaterThan(1_500);
  expect(bytes.subarray(0, 5).toString("ascii"), `${target.key}: PDF imzası`).toBe("%PDF-");

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const text = await parser.getText();
    const info = await parser.getInfo();
    expect(info.total, `${target.key}: sayfa sayısı`).toBeGreaterThanOrEqual(1);
    expect(text.text ?? "", `${target.key}: beklenen başlık`).toContain(target.expectedTitle);
    expect(text.text ?? "", `${target.key}: tarih formatı`).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  } finally {
    await parser.destroy();
  }
}
