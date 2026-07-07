import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import {
  buildCapitalImportPreview,
  confirmCapitalImport,
  type CapitalImportConfirmSuggestion
} from "../../src/lib/capital/capital-import-service";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 capital import suggestions", () => {
  test("creates FX asset suggestions from CSV and links accepted assets to the source document", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Sermaye import servis testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const file = fileFromText(
      `fx-${stamp}.csv`,
      "text/csv",
      `Varlık,Sembol,Miktar,Birim Fiyat,Toplam Değer,Para Birimi\nUSD Vadeli Hesap ${stamp},USD,1000,32,32000,USD\n`
    );
    let importId: string | null = null;

    try {
      const preview = await buildCapitalImportPreview(user!.id, file, {
        importType: "FX_STATEMENT",
        valuationCurrency: "TRY"
      });
      expect(preview.sourceType).toBe("CSV");
      expect(preview.suggestions).toHaveLength(1);
      expect(preview.suggestions[0].assetType).toBe("FX");
      expect(preview.suggestions[0].confidenceLevel).toBe("HIGH");

      const result = await confirmCapitalImport(
        user!.id,
        file,
        { importType: "FX_STATEMENT", valuationCurrency: "TRY" },
        preview.suggestions.map((suggestion) => ({ ...suggestion, decision: "ACCEPTED" }))
      );
      importId = result.id;
      expect(result.createdAssetCount).toBe(1);
      expect(result.documentId).toBeTruthy();

      const asset = await prisma.assetAccount.findFirstOrThrow({ where: { userId: user!.id, capitalImportId: result.id } });
      const valuation = await prisma.assetValuation.findFirstOrThrow({ where: { userId: user!.id, assetAccountId: asset.id, capitalImportId: result.id } });
      const transaction = await prisma.assetTransaction.findFirstOrThrow({
        where: { userId: user!.id, assetAccountId: asset.id, transactionType: "VALUE_UPDATE", deletedAt: null }
      });

      expect(asset.sourceDocumentId).toBe(result.documentId);
      expect(asset.assetType).toBe("FX");
      expect(valuation.sourceDocumentId).toBe(result.documentId);
      expect(valuation.source).toBe("IMPORTED");
      expect(transaction.totalAmount.toNumber()).toBe(32000);
    } finally {
      await cleanupCapitalImport(user!.id, importId);
    }
  });

  test("detects crypto suggestions from CSV without creating assets during preview", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Sermaye import servis testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const beforeCount = await prisma.assetAccount.count({ where: { userId: user!.id, name: { contains: stamp } } });
    const preview = await buildCapitalImportPreview(
      user!.id,
      fileFromText(
        `crypto-${stamp}.csv`,
        "text/csv",
        `Varlık,Sembol,Miktar,Birim Fiyat,Toplam Değer,Para Birimi\nBitcoin Portföy ${stamp},BTC,0.25,2400000,600000,TRY\n`
      ),
      { importType: "CRYPTO_PORTFOLIO", valuationCurrency: "TRY" }
    );

    expect(preview.suggestions[0].assetType).toBe("CRYPTO");
    expect(preview.suggestions[0].symbol).toBe("BTC");
    const afterCount = await prisma.assetAccount.count({ where: { userId: user!.id, name: { contains: stamp } } });
    expect(afterCount).toBe(beforeCount);
  });

  test("parses portfolio XLSX into stock suggestions", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Sermaye import XLSX testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const xlsx = createMinimalXlsx([
      ["Enstrüman", "Sembol", "Adet", "Fiyat", "Toplam", "Para Birimi"],
      [`THYAO Hisse ${stamp}`, "THYAO", "10", "300", "3000", "TRY"]
    ]);
    const file = new File([xlsx], `portfolio-${stamp}.xlsx`, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const preview = await buildCapitalImportPreview(user!.id, file, {
      importType: "STOCK_PORTFOLIO",
      valuationCurrency: "TRY"
    });

    expect(preview.sourceType).toBe("XLSX");
    expect(preview.suggestions).toHaveLength(1);
    expect(preview.suggestions[0].assetType).toBe("STOCK");
    expect(preview.suggestions[0].symbol).toBe("THYAO");
  });

  test("keeps low-confidence suggestions rejected unless the user accepts them", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Düşük güvenli öneri testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const file = fileFromText(`low-confidence-${stamp}.csv`, "text/csv", `Ad,Tutar\nBelirsiz kayıt ${stamp},1200\n`);
    let importId: string | null = null;

    try {
      const preview = await buildCapitalImportPreview(user!.id, file, {
        importType: "OTHER_FINANCIAL_DOCUMENT",
        valuationCurrency: "TRY"
      });
      expect(preview.lowConfidenceSuggestions).toHaveLength(1);
      expect(preview.suggestions[0].confidenceLevel).toBe("LOW");

      const decisions = preview.suggestions.map<CapitalImportConfirmSuggestion>((suggestion) => ({
        ...suggestion,
        decision: "REJECTED"
      }));
      const result = await confirmCapitalImport(user!.id, file, { importType: "OTHER_FINANCIAL_DOCUMENT", valuationCurrency: "TRY" }, decisions);
      importId = result.id;

      expect(result.createdAssetCount).toBe(0);
      const assets = await prisma.assetAccount.count({ where: { userId: user!.id, capitalImportId: result.id } });
      const rejected = await prisma.capitalImportSuggestion.count({ where: { userId: user!.id, capitalImportId: result.id, status: "REJECTED" } });
      expect(assets).toBe(0);
      expect(rejected).toBe(1);
    } finally {
      await cleanupCapitalImport(user!.id, importId);
    }
  });
});

function fileFromText(name: string, mimeType: string, content: string) {
  return new File([Buffer.from(content, "utf8")], name, { type: mimeType });
}

async function cleanupCapitalImport(userId: string, importId: string | null) {
  if (!importId) return;

  const assetIds = (await prisma.assetAccount.findMany({ where: { userId, capitalImportId: importId }, select: { id: true } })).map((row) => row.id);
  const valuationIds = (await prisma.assetValuation.findMany({ where: { userId, capitalImportId: importId }, select: { id: true } })).map((row) => row.id);
  const transactionIds = assetIds.length
    ? (await prisma.assetTransaction.findMany({ where: { userId, assetAccountId: { in: assetIds } }, select: { id: true } })).map((row) => row.id)
    : [];
  const documentIds = (await prisma.capitalImport.findMany({ where: { userId, id: importId }, select: { documentId: true } }))
    .map((row) => row.documentId)
    .filter((id): id is string => Boolean(id));

  await prisma.auditLog.deleteMany({
    where: {
      userId,
      entityId: { in: [importId, ...assetIds, ...valuationIds, ...transactionIds, ...documentIds] }
    }
  });
  await prisma.assetTransaction.deleteMany({ where: { userId, assetAccountId: { in: assetIds } } });
  await prisma.assetValuation.deleteMany({ where: { userId, capitalImportId: importId } });
  await prisma.assetAccount.deleteMany({ where: { userId, capitalImportId: importId } });
  await prisma.capitalImportSuggestion.deleteMany({ where: { userId, capitalImportId: importId } });
  await prisma.capitalImport.deleteMany({ where: { userId, id: importId } });
  if (documentIds.length) {
    await prisma.documentProcessingLog.deleteMany({ where: { userId, documentId: { in: documentIds } } });
    await prisma.document.deleteMany({ where: { userId, id: { in: documentIds } } });
  }
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
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Portfoy" sheetId="1" r:id="rId1"/></sheets></workbook>`
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

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
