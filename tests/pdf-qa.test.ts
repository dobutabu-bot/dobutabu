import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";

import { Prisma } from "@prisma/client";

import { syncExpenseLedgerEntry, syncIncomeLedgerEntry } from "@/lib/cash/cash-ledger-service";
import { pdfResponse, renderPdfReportToBuffer, type PdfReportInput } from "@/lib/pdf/pdf-document";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session";

const runId = `pdf-qa-${Date.now()}-${process.pid}`;
const baseUrl = process.env.PDF_QA_BASE_URL ?? "http://localhost:3010";
const generatedPdfDir = path.join(process.cwd(), "fixtures/generated-pdfs");

after(async () => {
  await prisma.$disconnect();
});

test("V3-RC1 PDF renderer uzun Türkçe raporu boş/taşan çıktı üretmeden oluşturur", async () => {
  await ensurePdfDir();
  const buffer = await renderPdfReportToBuffer(largeTurkishPdfInput());

  assert.equal(pdfSignature(buffer), "%PDF");
  assert.ok(buffer.byteLength > 20_000, "Büyük rapor PDF'i boş olmamalı");

  const text = await extractPdfText(buffer);
  assert.match(text, /Türkçe Büyük Finans Raporu/);
  assert.match(text, /Örnek Müvekkil/);
  assert.match(text, /TL 1\.245\.000,00|1\.245\.000,00/);

  await writeFile(path.join(generatedPdfDir, "long-table-quality.pdf"), buffer);
});

test("PDF response boş veya HTML içeriğini PDF diye döndürmez", () => {
  assert.throws(
    () => pdfResponse(Buffer.from("<html>hata</html>", "utf8"), "hatali.pdf"),
    /PDF çıktısı doğrulanamadı/
  );
});

test("V3-RC1 PDF route kalite provası", async (t) => {
  if (!(await isServerAvailable())) {
    t.skip(`${baseUrl} çalışmadığı için PDF API kalite provası atlandı.`);
    return;
  }

  await ensurePdfDir();
  const fixture = await createPdfFixture();

  try {
    const cookie = `${SESSION_COOKIE}=${createSessionToken(fixture.userId)}`;
    const targets = [
      {
        label: "Müvekkil cari raporu",
        path: `/api/reports/client/${fixture.clientId}/pdf`,
        filenamePrefix: "muvekkil-cari",
        expectedTitle: "Müvekkil Cari Raporu"
      },
      {
        label: "Dosya finans raporu",
        path: `/api/reports/case/${fixture.caseFileId}/pdf`,
        filenamePrefix: "dosya-finans",
        expectedTitle: "Dosya Finans Raporu"
      },
      {
        label: "Tahsilat özeti",
        path: `/api/reports/collections/${fixture.incomeId}/pdf`,
        filenamePrefix: "tahsilat-ozet",
        expectedTitle: "Tahsilat Makbuz / Özet PDF"
      },
      {
        label: "Gider özeti",
        path: `/api/reports/expenses/${fixture.expenseId}/pdf`,
        filenamePrefix: "gider-ozet",
        expectedTitle: "Gider Özet PDF"
      },
      {
        label: "Aylık finans raporu",
        path: "/api/reports/monthly/pdf?startDate=2026-01-01&endDate=2026-12-31",
        filenamePrefix: "aylik-finans",
        expectedTitle: "Aylık Finans Raporu"
      },
      {
        label: "Kasa raporu",
        path: "/api/reports/cash/pdf?startDate=2026-01-01&endDate=2026-12-31",
        filenamePrefix: "kasa-hareketleri",
        expectedTitle: "Kasa Hareketleri Raporu"
      },
      {
        label: "Banka ekstresi analiz raporu",
        path: `/api/reports/bank-analysis/${fixture.bankImportId}/pdf`,
        filenamePrefix: "banka-ekstresi-analiz",
        expectedTitle: "Banka Ekstresi Analiz Raporu"
      },
      {
        label: "Mutabakat raporu",
        path: "/api/reports/reconciliation/pdf?startDate=2026-01-01&endDate=2026-12-31",
        filenamePrefix: "mutabakat-raporu",
        expectedTitle: "Mutabakat Raporu"
      },
      {
        label: "Sermaye raporu",
        path: "/api/reports/capital/pdf",
        filenamePrefix: "sermaye-varlik",
        expectedTitle: "Sermaye / Varlık Raporu"
      }
    ];

    for (const target of targets) {
      await t.test(target.label, async () => {
        const unauthorized = await fetch(`${baseUrl}${target.path}`);
        assert.equal(unauthorized.status, 401, `${target.label} auth olmayan kullanıcıya kapalı olmalı`);

        const response = await fetch(`${baseUrl}${target.path}`, { headers: { cookie } });
        assert.equal(response.status, 200, `${target.label} HTTP 200 dönmeli`);
        assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);
        assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
        assert.match(response.headers.get("content-disposition") ?? "", new RegExp(`${target.filenamePrefix}-\\d{4}-\\d{2}`));
        assert.match(response.headers.get("content-disposition") ?? "", /\.pdf/);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);

        const buffer = Buffer.from(await response.arrayBuffer());
        assert.equal(pdfSignature(buffer), "%PDF");
        assert.ok(buffer.byteLength > 1_500, `${target.label} boş olmamalı`);
        await writeFile(path.join(generatedPdfDir, `${target.filenamePrefix}.pdf`), buffer);

        const text = await extractPdfText(buffer);
        assert.match(text, new RegExp(escapeRegex(target.expectedTitle)));
        assert.match(text, /07\.07\.2026|2026/);
        assert.match(text, /TL|TRY|₺|Toplam|Tutar/);

        if (target.filenamePrefix === "muvekkil-cari") {
          assert.match(text, /Çağrı Test Müvekkili/);
          assert.doesNotMatch(text, /SILINMIS-PDF-KAYIT/, "Silinen kayıt PDF'e dahil edilmemeli");
        }
      });
    }
  } finally {
    await cleanupPdfFixture(fixture.userId);
  }
});

async function createPdfFixture() {
  const unique = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      name: `PDF QA ${runId}`,
      email: `${runId}-${unique}@example.test`,
      passwordHash: "test-only-password-hash"
    }
  });
  const userId = user.id;

  await prisma.appSetting.createMany({
    data: [
      { userId, key: "firmName", value: "Çağrı Şahin Hukuk Bürosu" },
      { userId, key: "ownerName", value: "Av. İpek Öztürk" }
    ]
  });

  const client = await prisma.client.create({
    data: {
      userId,
      name: `Çağrı Test Müvekkili ${unique}`,
      type: "COMPANY",
      email: "anonim@example.test",
      address: "Örnek Mah. Türkçe Cad. No: 1"
    }
  });
  const caseFile = await prisma.caseFile.create({
    data: {
      userId,
      clientId: client.id,
      title: `Şüpheli Alacak ve Sözleşme Dosyası ${unique}`,
      courtOrOffice: "İstanbul 19. İcra Dairesi",
      fileNumber: "2026/777 E.",
      caseType: "İcra takibi",
      status: "ACTIVE"
    }
  });
  const cashAccount = await prisma.cashAccount.create({
    data: {
      userId,
      name: "PDF QA Banka Hesabı",
      type: "BANK",
      currency: "TRY",
      openingBalance: new Prisma.Decimal("1000"),
      isDefault: true,
      isActive: true
    }
  });

  const income = await prisma.income.create({
    data: {
      userId,
      clientId: client.id,
      caseFileId: caseFile.id,
      cashAccountId: cashAccount.id,
      amount: new Prisma.Decimal("11111.00"),
      currency: "TRY",
      date: toDate("2026-07-07"),
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: "Türkçe karakterli tahsilat: ğüşiöç",
      receiptIssued: true,
      receiptNumber: `PDF-${unique}`
    }
  });
  const incomeLedger = await syncIncomeLedgerEntry(userId, income);

  await prisma.income.create({
    data: {
      userId,
      clientId: client.id,
      caseFileId: caseFile.id,
      cashAccountId: cashAccount.id,
      amount: new Prisma.Decimal("99999.00"),
      currency: "TRY",
      date: toDate("2026-07-07"),
      paymentMethod: "BANK_TRANSFER",
      category: "LEGAL_FEE",
      description: `SILINMIS-PDF-KAYIT-${unique}`,
      deletedAt: new Date()
    }
  });

  const expense = await prisma.expense.create({
    data: {
      userId,
      clientId: client.id,
      caseFileId: caseFile.id,
      cashAccountId: cashAccount.id,
      amount: new Prisma.Decimal("2222.50"),
      currency: "TRY",
      date: toDate("2026-07-07"),
      paymentMethod: "BANK_TRANSFER",
      category: "TAX",
      isClientExpense: true,
      description: "KDV ve harç gideri"
    }
  });
  const expenseLedger = await syncExpenseLedgerEntry(userId, expense);

  await prisma.invoiceOrReceipt.create({
    data: {
      userId,
      clientId: client.id,
      caseFileId: caseFile.id,
      relatedIncomeId: income.id,
      type: "E_SMM",
      number: `SMM-${unique}`,
      issueDate: toDate("2026-07-07"),
      grossAmount: new Prisma.Decimal("13333.20"),
      vatAmount: new Prisma.Decimal("2222.20"),
      withholdingAmount: new Prisma.Decimal("0"),
      netAmount: new Prisma.Decimal("11111.00"),
      status: "ISSUED"
    }
  });

  const bankImport = await prisma.bankStatementImport.create({
    data: {
      userId,
      cashAccountId: cashAccount.id,
      bankName: "PDF QA Test Bankası",
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `${runId}.csv`,
      originalFileName: `${runId}.csv`,
      mimeType: "text/csv",
      fileSize: 512,
      storagePath: `storage/test/${runId}.csv`,
      fileHash: `${runId}-${unique}`,
      periodStart: toDate("2026-01-01"),
      periodEnd: toDate("2026-12-31"),
      totalRows: 3,
      successfulRows: 2,
      failedRows: 0,
      duplicateRows: 1,
      openingBalance: new Prisma.Decimal("1000"),
      closingBalance: new Prisma.Decimal("9888.50")
    }
  });

  await prisma.bankStatementRow.createMany({
    data: [
      bankRow(userId, bankImport.id, cashAccount.id, 1, "2026-07-07", "PDF QA tahsilat banka girişi", "IN", "11111.00", income.id, null, incomeLedger.id),
      bankRow(userId, bankImport.id, cashAccount.id, 2, "2026-07-07", "PDF QA gider banka çıkışı", "OUT", "2222.50", null, expense.id, expenseLedger.id),
      {
        ...bankRow(userId, bankImport.id, cashAccount.id, 3, "2026-07-07", "Duplicate satır", "IN", "11111.00", null, null, null),
        status: "DUPLICATE" as const,
        errorMessage: "Duplicate satır"
      }
    ]
  });

  const asset = await prisma.assetAccount.create({
    data: {
      userId,
      name: "PDF QA Nakit Varlık",
      assetType: "BANK",
      currency: "TRY",
      quantity: new Prisma.Decimal("1"),
      unitPrice: new Prisma.Decimal("9888.50"),
      manualTotalValue: new Prisma.Decimal("9888.50"),
      valuationCurrency: "TRY",
      linkedCashAccountId: cashAccount.id,
      isActive: true
    }
  });

  await prisma.assetValuation.create({
    data: {
      userId,
      assetAccountId: asset.id,
      valuationDate: toDate("2026-07-07"),
      quantity: new Prisma.Decimal("1"),
      unitPrice: new Prisma.Decimal("9888.50"),
      totalValue: new Prisma.Decimal("9888.50"),
      valuationCurrency: "TRY",
      source: "MANUAL",
      note: "PDF QA değerleme"
    }
  });

  return {
    userId,
    clientId: client.id,
    caseFileId: caseFile.id,
    incomeId: income.id,
    expenseId: expense.id,
    bankImportId: bankImport.id
  };
}

function bankRow(
  userId: string,
  importId: string,
  cashAccountId: string,
  rowNumber: number,
  date: string,
  description: string,
  direction: "IN" | "OUT",
  amount: string,
  matchedIncomeId: string | null,
  matchedExpenseId: string | null,
  matchedCashLedgerEntryId: string | null
) {
  const decimal = new Prisma.Decimal(amount).abs();
  const signedAmount = direction === "IN" ? decimal : decimal.negated();

  return {
    userId,
    importId,
    cashAccountId,
    rowNumber,
    transactionDate: toDate(date),
    description,
    debitAmount: direction === "OUT" ? decimal : null,
    creditAmount: direction === "IN" ? decimal : null,
    amount: signedAmount,
    balance: null,
    currency: "TRY",
    direction,
    status: "SUCCESS" as const,
    rawData: { date, description, amount },
    rawHash: `${importId}-${rowNumber}-${direction}-${amount}`,
    categorySuggestion: direction === "IN" ? "Avukatlık ücreti" : "Vergi",
    matchType: matchedCashLedgerEntryId ? ("MANUALLY_MATCHED" as const) : ("NONE" as const),
    matchedIncomeId,
    matchedExpenseId,
    matchedCashLedgerEntryId
  };
}

async function cleanupPdfFixture(userId: string) {
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.bankStatementRow.deleteMany({ where: { userId } });
  await prisma.bankStatementImport.deleteMany({ where: { userId } });
  await prisma.assetValuation.deleteMany({ where: { userId } });
  await prisma.assetTransaction.deleteMany({ where: { userId } });
  await prisma.assetAccount.deleteMany({ where: { userId } });
  await prisma.invoiceOrReceipt.deleteMany({ where: { userId } });
  await prisma.cashLedgerEntry.deleteMany({ where: { userId } });
  await prisma.income.deleteMany({ where: { userId } });
  await prisma.expense.deleteMany({ where: { userId } });
  await prisma.cashAccount.deleteMany({ where: { userId } });
  await prisma.caseFile.deleteMany({ where: { userId } });
  await prisma.client.deleteMany({ where: { userId } });
  await prisma.appSetting.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function largeTurkishPdfInput(): PdfReportInput {
  return {
    title: "Türkçe Büyük Finans Raporu",
    subtitle: "İcra, ödeme, müvekkil cari, şüpheli alacak ve kasa hareketleri",
    firmName: "Çağrı Şahin Hukuk Bürosu",
    ownerName: "Av. İpek Öztürk",
    reportDate: "07.07.2026",
    period: "01.01.2026 - 31.12.2026",
    summaries: [
      { label: "Toplam Tahsilat", value: "+₺1.245.000,00", tone: "green" },
      { label: "Toplam Gider", value: "-₺382.450,00", tone: "rose" },
      { label: "Net Durum", value: "+₺862.550,00", tone: "green" }
    ],
    notes: [
      "Türkçe karakter testi: ğ, ü, ş, ı, ö, ç, İ, Ğ, Ü, Ş, Ö, Ç.",
      "Bu rapor sistem kayıtlarına göre oluşturulmuştur."
    ],
    tables: [
      {
        title: "Uzun Tablo Taşma Kontrolü",
        headers: ["Tarih", "Müvekkil", "Dosya", "Açıklama", "Tutar"],
        rows: Array.from({ length: 180 }, (_, index) => ({
          Tarih: "07.07.2026",
          Müvekkil: `Örnek Müvekkil ${index + 1}`,
          Dosya: `${2026}/${1000 + index} İstanbul İcra Dairesi`,
          Açıklama: index % 2 === 0 ? "Tahsilat - sözleşme alacağı ve vekalet ücreti" : "Gider - harç, posta ve bilirkişi masrafı",
          Tutar: index % 2 === 0 ? "+₺12.500,00" : "-₺1.250,00"
        }))
      }
    ]
  };
}

async function extractPdfText(buffer: Buffer) {
  let parser: { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } | null = null;
  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

async function ensurePdfDir() {
  await mkdir(generatedPdfDir, { recursive: true });
}

async function isServerAvailable() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    })
  ).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}

function pdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 4).toString("utf8");
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00+03:00`);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
