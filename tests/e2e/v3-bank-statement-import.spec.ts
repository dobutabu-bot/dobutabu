import { createHash, createHmac } from "crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 staged bank statement import", () => {
  test("CSV preview is staging-only and save creates BankStatementImport rows without finance records", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Banka import testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const csv = Buffer.from(
      `Tarih,Açıklama,Borç,Alacak,Bakiye\n2026-07-01,Müvekkil ödeme ${stamp},,1250,1250\n2026-07-02,Ofis gideri ${stamp},250,,1000\n`,
      "utf8"
    );
    const fileHash = sha256(csv);
    const ledgerBefore = await prisma.cashLedgerEntry.count({ where: { userId: user!.id, deletedAt: null } });
    let importId: string | null = null;

    try {
      const preview = await postBankPreview(request, cookie, {
        bankName: `E2E CSV Banka ${stamp}`,
        file: { name: `e2e-bank-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      expect(preview.status()).toBe(200);
      const previewPayload = (await preview.json()) as BankPreviewResponse;
      expect(previewPayload.preview.sourceType).toBe("CSV");
      expect(previewPayload.preview.sourceConfidence).toBe("HIGH");
      expect(previewPayload.preview.parseSummary.totalRows).toBe(2);

      const previewImportCount = await prisma.bankStatementImport.count({ where: { userId: user!.id, fileHash, deletedAt: null } });
      expect(previewImportCount).toBe(0);

      const saved = await postBankImport(request, cookie, {
        bankName: `E2E CSV Banka ${stamp}`,
        file: { name: `e2e-bank-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      const savedBody = await saved.text();
      expect(saved.status(), savedBody).toBe(200);
      const savedPayload = JSON.parse(savedBody) as { id: string };
      importId = savedPayload.id;

      const bankImport = await prisma.bankStatementImport.findUnique({
        where: { id: importId },
        include: { rows: true, document: true }
      });
      expect(bankImport?.totalRows).toBe(2);
      expect(bankImport?.rows).toHaveLength(2);
      expect(bankImport?.document?.documentType).toBe("BANK_STATEMENT");

      const ledgerAfter = await prisma.cashLedgerEntry.count({ where: { userId: user!.id, deletedAt: null } });
      expect(ledgerAfter).toBe(ledgerBefore);
    } finally {
      await softDeleteImport(importId);
    }
  });

  test("duplicate import is detected before second save", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Duplicate import testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const csv = Buffer.from(`Tarih,Açıklama,Borç,Alacak\n2026-07-03,Duplicate gelir ${stamp},,900\n`, "utf8");
    let importId: string | null = null;

    try {
      const saved = await postBankImport(request, cookie, {
        bankName: `E2E Duplicate Banka ${stamp}`,
        file: { name: `e2e-duplicate-bank-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      const savedBody = await saved.text();
      expect(saved.status(), savedBody).toBe(200);
      importId = (JSON.parse(savedBody) as { id: string }).id;

      const preview = await postBankPreview(request, cookie, {
        bankName: `E2E Duplicate Banka ${stamp}`,
        file: { name: `e2e-duplicate-bank-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      expect(preview.status()).toBe(200);
      const previewPayload = (await preview.json()) as BankPreviewResponse;
      expect(previewPayload.preview.duplicateImport?.id).toBe(importId);

      const duplicateSave = await postBankImport(request, cookie, {
        bankName: `E2E Duplicate Banka ${stamp}`,
        file: { name: `e2e-duplicate-bank-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      expect(duplicateSave.status()).toBe(400);
      expect(await duplicateSave.text()).toContain("daha önce");
    } finally {
      await softDeleteImport(importId);
    }
  });

  test("XLSX statement preview parses worksheet rows", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "XLSX import testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const xlsx = createMinimalXlsx([
      ["Tarih", "Açıklama", "Borç", "Alacak", "Bakiye"],
      ["2026-07-01", `Excel gelir ${stamp}`, "", "1500", "1500"],
      ["2026-07-02", `Excel gider ${stamp}`, "450", "", "1050"]
    ]);

    const preview = await postBankPreview(request, cookie, {
      bankName: `E2E XLSX Banka ${stamp}`,
      file: {
        name: `e2e-bank-${stamp}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: xlsx
      }
    });
    const previewBody = await preview.text();
    expect(preview.status(), previewBody).toBe(200);
    const payload = JSON.parse(previewBody) as BankPreviewResponse;
    expect(payload.preview.sourceType).toBe("XLSX");
    expect(payload.preview.sourceConfidence).toBe("HIGH");
    expect(payload.preview.parseSummary.totalRows).toBe(2);
  });

  test("CSV parser handles BOM, delimiters, decimal formats and duplicate row hashes", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "CSV parser tolerans testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const csv = Buffer.from(
      `\ufeffTarih;Açıklama;Borç;Alacak;Bakiye\n01.07.2026;Virgüllü gelir ${stamp};;1.234,56;1.234,56\n02.07.2026;Virgüllü gider ${stamp};234,56;;1.000,00\n02.07.2026;Virgüllü gider ${stamp};234,56;;1.000,00\n`,
      "utf8"
    );

    const preview = await postBankPreview(request, cookie, {
      bankName: `E2E Parser Banka ${stamp}`,
      file: { name: `parser-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
    });
    const previewBody = await preview.text();
    expect(preview.status(), previewBody).toBe(200);
    const payload = JSON.parse(previewBody) as BankPreviewResponse;
    expect(payload.preview.sourceType).toBe("CSV");
    expect(payload.preview.sourceConfidence).toBe("HIGH");
    expect(payload.preview.parseSummary.totalRows).toBe(3);
    expect(payload.preview.parseSummary.duplicateRows).toBe(1);
    expect(payload.preview.analysis.incomeRows).toBe(1);
    expect(payload.preview.analysis.expenseRows).toBe(1);
  });

  test("CSV parser records missing and extra column rows without crashing", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Eksik/fazla kolon testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const csv = Buffer.from(
      `Tarih,Açıklama,Borç,Alacak\n2026-07-01,Eksik tutar ${stamp}\n2026-07-02,Fazla kolon ${stamp},,500,ekstra veri\n`,
      "utf8"
    );

    const preview = await postBankPreview(request, cookie, {
      bankName: `E2E Kolon Banka ${stamp}`,
      file: { name: `columns-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
    });
    const previewBody = await preview.text();
    expect(preview.status(), previewBody).toBe(200);
    const payload = JSON.parse(previewBody) as BankPreviewResponse;
    expect(payload.preview.parseSummary.totalRows).toBe(2);
    expect(payload.preview.parseSummary.failedRows).toBeGreaterThanOrEqual(1);
    expect(payload.preview.analysis.suggestedRows.some((row) => row.errorMessage?.includes("Eksik kolon"))).toBeTruthy();
    expect(payload.preview.analysis.suggestedRows.some((row) => row.errorMessage?.includes("Fazla kolon"))).toBeTruthy();
  });

  test("saved BankImportMapping is suggested for the next file from the same bank", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Mapping tercihi testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const stamp = uniqueStamp();
    const bankName = `E2E Mapping Banka ${stamp}`;
    const csv = Buffer.from(`Kolon A,Kolon B,Kolon C,Kolon D\n2026-07-01,Mapping gelir ${stamp},,700\n`, "utf8");
    let importId: string | null = null;

    try {
      const saved = await postBankImport(request, cookie, {
        bankName,
        file: { name: `mapping-${stamp}.csv`, mimeType: "text/csv", buffer: csv },
        overrides: {
          mapDate: "Kolon A",
          mapDescription: "Kolon B",
          mapDebit: "Kolon C",
          mapCredit: "Kolon D"
        }
      });
      const savedBody = await saved.text();
      expect(saved.status(), savedBody).toBe(200);
      importId = (JSON.parse(savedBody) as { id: string }).id;

      const preview = await postBankPreview(request, cookie, {
        bankName,
        file: { name: `mapping-next-${stamp}.csv`, mimeType: "text/csv", buffer: csv }
      });
      const previewBody = await preview.text();
      expect(preview.status(), previewBody).toBe(200);
      const payload = JSON.parse(previewBody) as BankPreviewResponse;
      expect(payload.preview.mappingSource).toBe("SAVED");
      expect(payload.preview.mapping.date).toBe("Kolon A");
      expect(payload.preview.mapping.description).toBe("Kolon B");
      expect(payload.preview.mapping.credit).toBe("Kolon D");
    } finally {
      await softDeleteImport(importId);
      await prisma.bankImportMapping.deleteMany({ where: { userId: user!.id, bankName } });
    }
  });

  test("broken file is rejected with a safe message", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Broken file testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const broken = await postBankPreview(request, cookie, {
      bankName: `E2E Broken Banka ${uniqueStamp()}`,
      file: {
        name: "broken.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("not-a-real-xlsx")
      }
    });

    expect(broken.status()).toBeGreaterThanOrEqual(400);
    expect(await broken.text()).toContain("önizlemesi oluşturulamadı");
  });

  test("wizard restores metadata draft after reload and cancel clears it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Wizard taslak testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    await setSessionCookie(page, user!.id);
    await page.goto("/bank-statements/import", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem(
        "buro-finans-bank-import-draft-v1",
        JSON.stringify({
          bankName: "Taslak Banka E2E",
          cashAccountId: "",
          currency: "TRY",
          periodStart: "",
          periodEnd: "",
          dateFormat: "auto",
          decimalSeparator: ",",
          thousandSeparator: ".",
          mapping: {},
          fileName: "taslak.csv"
        })
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Önceki import taslağı geri yüklendi")).toBeVisible();
    await page.getByRole("button", { name: /Vazgeç/i }).click();
    await page.goto("/bank-statements/import", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Önceki import taslağı geri yüklendi")).toHaveCount(0);
  });
});

type BankPreviewResponse = {
  preview: {
    sourceType: "CSV" | "XLSX" | "PDF";
    sourceConfidence: "HIGH" | "LOW";
    mappingSource: "DETECTED" | "SAVED" | "MANUAL";
    mapping: Partial<Record<"date" | "description" | "debit" | "credit" | "balance" | "currency", string>>;
    parseSummary: { totalRows: number; failedRows: number; duplicateRows: number };
    analysis: {
      incomeRows: number;
      expenseRows: number;
      suggestedRows: Array<{ errorMessage: string | null }>;
    };
    duplicateImport?: { id: string };
  };
};

type BankFileInput = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

function postBankPreview(request: APIRequestContext, cookie: string, input: { bankName: string; file: BankFileInput; overrides?: Record<string, string> }) {
  return request.post("/api/bank-statements/preview", {
    headers: { cookie },
    multipart: bankMultipart(input.bankName, input.file, input.overrides)
  });
}

function postBankImport(request: APIRequestContext, cookie: string, input: { bankName: string; file: BankFileInput; overrides?: Record<string, string> }) {
  return request.post("/api/bank-statements/import", {
    headers: { cookie },
    multipart: bankMultipart(input.bankName, input.file, input.overrides)
  });
}

function bankMultipart(bankName: string, file: BankFileInput, overrides: Record<string, string> = {}) {
  return {
    bankName,
    currency: "TRY",
    dateFormat: "auto",
    decimalSeparator: ",",
    thousandSeparator: ".",
    file,
    ...overrides
  };
}

async function softDeleteImport(importId: string | null) {
  if (!importId) {
    return;
  }

  const bankImport = await prisma.bankStatementImport.findUnique({
    where: { id: importId },
    select: { documentId: true }
  });
  await prisma.bankStatementImport.updateMany({ where: { id: importId }, data: { deletedAt: new Date() } });
  await prisma.bankStatementRow.updateMany({ where: { importId }, data: { deletedAt: new Date() } });

  if (bankImport?.documentId) {
    await prisma.document.updateMany({ where: { id: bankImport.documentId }, data: { deletedAt: new Date() } });
  }
}

async function setSessionCookie(page: Page, userId: string) {
  await page.context().addCookies([
    {
      name: "hukuk_finans_session",
      value: createSessionTokenForTest(userId),
      url: TEST_BASE_URL,
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

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createMinimalXlsx(rows: string[][]) {
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return zipStore([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ekstre" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`
    }
  ]);
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localDirectory.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, end]);
}

function crc32(buffer: Buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function columnName(index: number) {
  let name = "";
  let current = index;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
