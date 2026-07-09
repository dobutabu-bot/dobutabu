import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { readFile, rm } from "node:fs/promises";

import { Prisma } from "@prisma/client";

import { buildBankStatementPreview, createBankStatementImport, type BankStatementParseOptions } from "@/lib/bank-statements";
import { LocalDocumentStorage } from "@/lib/documents/local-storage";
import { prisma } from "@/lib/prisma";

const fixtureRoot = path.join(process.cwd(), "fixtures/bank-statements");
const runId = `bank-import-qa-${Date.now()}-${process.pid}`;
const storage = new LocalDocumentStorage();

type FixtureCase = {
  label: string;
  fileName: string;
  mimeType: string;
  options: BankStatementParseOptions;
  expected: {
    sourceType: "CSV" | "XLSX" | "PDF";
    confidence: "HIGH" | "LOW";
    totalRows?: number;
    successfulRows?: number;
    failedRows?: number;
    duplicateRows?: number;
    requireWarning?: string;
    requireErrorMessage?: string;
  };
};

let userId: string | null = null;
let cashAccountId: string | null = null;

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("V3-RC1 banka ekstresi import kalite provası", async (t) => {
  await ensureBinaryFixtures();
  await createFixture();

  for (const fixture of fixtures()) {
    await t.test(fixture.label, async () => {
      const beforeIncomeCount = await prisma.income.count({ where: { userId: userId! } });
      const beforeExpenseCount = await prisma.expense.count({ where: { userId: userId! } });
      const file = await fixtureFile(fixture.fileName, fixture.mimeType);
      const preview = await buildBankStatementPreview(userId!, file, fixture.options);

      assert.equal(preview.sourceType, fixture.expected.sourceType);
      assert.equal(preview.sourceConfidence, fixture.expected.confidence);
      assertExpectedNumber(preview.parseSummary.totalRows, fixture.expected.totalRows, `${fixture.label} totalRows`);
      assertExpectedNumber(preview.parseSummary.successfulRows, fixture.expected.successfulRows, `${fixture.label} successfulRows`);
      assertExpectedNumber(preview.parseSummary.failedRows, fixture.expected.failedRows, `${fixture.label} failedRows`);
      assertExpectedNumber(preview.parseSummary.duplicateRows, fixture.expected.duplicateRows, `${fixture.label} duplicateRows`);

      if (fixture.expected.requireWarning) {
        assert.match(preview.warning ?? "", new RegExp(fixture.expected.requireWarning, "i"));
      }

      if (fixture.expected.requireErrorMessage) {
        assert.ok(
          preview.analysis.suggestedRows.some((row) => row.errorMessage?.toLocaleLowerCase("tr-TR").includes(fixture.expected.requireErrorMessage!)),
          `${fixture.label} beklenen hata mesajı görünmedi`
        );
      }

      const imported = await createBankStatementImport(userId!, file, fixture.options);
      const bankImport = await prisma.bankStatementImport.findUniqueOrThrow({ where: { id: imported.id }, include: { rows: true } });

      assert.equal(bankImport.totalRows, preview.parseSummary.totalRows);
      assert.equal(bankImport.successfulRows, preview.parseSummary.successfulRows);
      assert.equal(bankImport.failedRows, preview.parseSummary.failedRows);
      assert.equal(bankImport.duplicateRows, preview.parseSummary.duplicateRows);
      assert.equal(bankImport.rows.filter((row) => row.status === "DUPLICATE").length, 0, "Duplicate satırlar persist edilmemeli");
      assert.equal(bankImport.rows.length, preview.parseSummary.totalRows - preview.parseSummary.duplicateRows);
      assert.equal(await prisma.income.count({ where: { userId: userId! } }), beforeIncomeCount, "Import onaysız tahsilat oluşturmamalı");
      assert.equal(await prisma.expense.count({ where: { userId: userId! } }), beforeExpenseCount, "Import onaysız gider oluşturmamalı");
    });
  }

  await t.test("aynı dosya ikinci kez import edilmez ve kullanıcı dostu uyarı döner", async () => {
    const duplicateFile = await fixtureFile("garanti-benzeri.csv", "text/csv");

    await assert.rejects(
      () =>
        createBankStatementImport(userId!, duplicateFile, {
          ...baseOptions("Duplicate dosya kontrol bankası"),
          dateFormat: "YYYY-MM-DD",
          decimalSeparator: ".",
          thousandSeparator: "none"
        }),
      /daha önce içe aktarılmış olabilir/
    );
  });
});

function fixtures(): FixtureCase[] {
  return [
    {
      label: "Garanti benzeri CSV",
      fileName: "garanti-benzeri.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Garanti Benzeri Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "İş Bankası benzeri CSV",
      fileName: "is-bankasi-benzeri.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("İş Bankası Benzeri Test"), dateFormat: "DD.MM.YYYY", decimalSeparator: ",", thousandSeparator: "." },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Yapı Kredi benzeri CSV",
      fileName: "yapi-kredi-benzeri.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Yapı Kredi Benzeri Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ",", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Enpara benzeri CSV",
      fileName: "enpara-benzeri.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Enpara Benzeri Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ",", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Ziraat benzeri CSV",
      fileName: "ziraat-benzeri.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Ziraat Benzeri Test"), dateFormat: "DD.MM.YYYY", decimalSeparator: ",", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "XLSX banka ekstresi",
      fileName: "xlsx-banka-ekstresi.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      options: { ...baseOptions("XLSX Banka Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "XLSX", confidence: "HIGH", totalRows: 3, successfulRows: 3, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Bozuk CSV",
      fileName: "bozuk.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Bozuk CSV Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", failedRows: 1, requireErrorMessage: "tarih okunamadı" }
    },
    {
      label: "Eksik kolonlu CSV",
      fileName: "eksik-kolon.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Eksik Kolon Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 2, successfulRows: 1, failedRows: 1, duplicateRows: 0, requireErrorMessage: "eksik kolon" }
    },
    {
      label: "Virgül decimal CSV",
      fileName: "virgul-decimal.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Virgül Decimal Test"), dateFormat: "DD.MM.YYYY", decimalSeparator: ",", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 2, successfulRows: 2, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Nokta decimal CSV",
      fileName: "nokta-decimal.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Nokta Decimal Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 2, successfulRows: 2, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Binlik ayırıcı CSV",
      fileName: "binlik-ayirici.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Binlik Ayırıcı Test"), dateFormat: "DD.MM.YYYY", decimalSeparator: ",", thousandSeparator: "." },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 2, successfulRows: 2, failedRows: 0, duplicateRows: 0 }
    },
    {
      label: "Duplicate hareketleri içeren CSV",
      fileName: "duplicate-hareketler.csv",
      mimeType: "text/csv",
      options: { ...baseOptions("Duplicate Hareket Test"), dateFormat: "YYYY-MM-DD", decimalSeparator: ".", thousandSeparator: "none" },
      expected: { sourceType: "CSV", confidence: "HIGH", totalRows: 3, successfulRows: 2, failedRows: 0, duplicateRows: 1 }
    },
    {
      label: "PDF banka ekstresi fallback",
      fileName: "pdf-fallback-ekstre.pdf",
      mimeType: "application/pdf",
      options: { ...baseOptions("PDF Fallback Test"), dateFormat: "DD.MM.YYYY", decimalSeparator: ",", thousandSeparator: "none" },
      expected: { sourceType: "PDF", confidence: "LOW", requireWarning: "CSV veya Excel" }
    }
  ];
}

function baseOptions(bankName: string): BankStatementParseOptions {
  return {
    bankName: `${bankName} ${runId}`,
    cashAccountId,
    currency: "TRY",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    delimiter: "auto"
  };
}

async function createFixture() {
  const user = await prisma.user.create({
    data: {
      name: `Bank Import QA ${runId}`,
      email: `${runId}@example.test`,
      passwordHash: "test-only-password-hash"
    }
  });
  userId = user.id;

  const cashAccount = await prisma.cashAccount.create({
    data: {
      userId,
      name: `QA Banka Hesabı ${runId}`,
      type: "BANK",
      currency: "TRY",
      openingBalance: new Prisma.Decimal("0"),
      isDefault: true,
      isActive: true
    }
  });
  cashAccountId = cashAccount.id;
}

async function ensureBinaryFixtures() {
  const fixtureGenerator = await import("../fixtures/bank-statements/generate-binary-fixtures.mjs");
  await fixtureGenerator.generateBankStatementBinaryFixtures(fixtureRoot);
}

async function fixtureFile(fileName: string, mimeType: string) {
  const buffer = await readFile(path.join(fixtureRoot, fileName));
  return new File([buffer], fileName, { type: mimeType });
}

function assertExpectedNumber(actual: number, expected: number | undefined, label: string) {
  if (expected === undefined) return;
  assert.equal(actual, expected, label);
}

async function cleanup() {
  if (!userId) return;

  const documents = await prisma.document.findMany({ where: { userId }, select: { storagePath: true } });

  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.bankStatementRow.deleteMany({ where: { userId } });
  await prisma.bankImportMapping.deleteMany({ where: { userId } });
  await prisma.bankStatementImport.deleteMany({ where: { userId } });
  await prisma.documentProcessingLog.deleteMany({ where: { userId } });
  await prisma.document.deleteMany({ where: { userId } });
  await prisma.cashAccount.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  await Promise.all(
    documents.map(async (document) => {
      try {
        await rm(storage.resolvePhysicalPath(document.storagePath), { force: true });
      } catch {
        // QA temizliği ana test sonucunu etkilememeli.
      }
    })
  );
}
