import path from "node:path";

import { Prisma, type AssetType, type CapitalImportSuggestionStatus, type CapitalImportType } from "@prisma/client";
import { parse as parseCsvSync } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";

import { writeAuditLog } from "@/lib/audit";
import {
  createStoredDocumentName,
  DocumentUploadError,
  getDocumentUploadLimitBytes,
  hashBuffer,
  sanitizeFileName,
  writePrivateDocumentFile
} from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatMoney, toNumber } from "@/lib/utils";

export type CapitalImportColumnKey = "name" | "symbol" | "quantity" | "unitPrice" | "totalValue" | "currency";
export type CapitalImportMapping = Partial<Record<CapitalImportColumnKey, string>>;

export type CapitalManualInput = {
  name?: string | null;
  assetType?: AssetType | null;
  symbol?: string | null;
  currency?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalValue?: string | number | null;
  valuationCurrency?: string | null;
};

export type CapitalImportOptions = {
  importType: CapitalImportType;
  valuationCurrency?: string | null;
  mapping?: CapitalImportMapping;
  manual?: CapitalManualInput;
};

export type CapitalImportSuggestionDraft = {
  tempId: string;
  rowNumber: number | null;
  assetType: AssetType;
  name: string;
  symbol: string | null;
  currency: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalValue: number;
  totalValueLabel: string;
  valuationCurrency: string;
  confidence: number;
  confidenceLabel: string;
  confidenceLevel: "HIGH" | "LOW";
  note: string;
  rawData: Record<string, string>;
};

export type CapitalImportPreview = {
  importType: CapitalImportType;
  sourceType: "CSV" | "XLSX" | "PDF" | "MANUAL";
  fileName: string | null;
  fileSize: number | null;
  fileHash: string | null;
  columns: string[];
  previewRows: Record<string, string>[];
  detectedColumns: CapitalImportMapping;
  mapping: CapitalImportMapping;
  totalRows: number;
  suggestions: CapitalImportSuggestionDraft[];
  highConfidenceSuggestions: CapitalImportSuggestionDraft[];
  lowConfidenceSuggestions: CapitalImportSuggestionDraft[];
  warning: string | null;
};

export type CapitalImportConfirmSuggestion = {
  tempId?: string;
  rowNumber?: number | null;
  assetType: AssetType;
  name: string;
  symbol?: string | null;
  currency?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalValue: string | number;
  valuationCurrency?: string | null;
  confidence?: string | number | null;
  note?: string | null;
  rawData?: Record<string, string>;
  decision: "ACCEPTED" | "REJECTED";
};

type ExtractedCapitalTable = {
  sourceType: "CSV" | "XLSX" | "PDF";
  fileName: string;
  fileSize: number;
  fileHash: string;
  columns: string[];
  records: Record<string, string>[];
  extractedText?: string;
  warning?: string;
};

const supportedImportTypes: CapitalImportType[] = [
  "BANK_STATEMENT",
  "FX_STATEMENT",
  "GOLD_STATEMENT",
  "STOCK_PORTFOLIO",
  "CRYPTO_PORTFOLIO",
  "OTHER_FINANCIAL_DOCUMENT",
  "MANUAL_ENTRY"
];

const allowedImportMimeTypes = {
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".pdf": ["application/pdf"]
};

const knownCurrencySymbols = ["TRY", "USD", "EUR", "GBP", "CHF", "JPY"];
const knownCryptoSymbols = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX"];
const knownGoldSymbols = ["XAU", "GAU", "GRAM", "ALTIN"];

export async function buildCapitalImportPreview(userId: string, file: File | null, options: CapitalImportOptions): Promise<CapitalImportPreview> {
  const importType = normalizeImportType(options.importType);
  const valuationCurrency = normalizeCurrency(options.valuationCurrency);

  if (importType === "MANUAL_ENTRY") {
    const suggestion = suggestionFromManual(options.manual, valuationCurrency);
    return {
      importType,
      sourceType: "MANUAL",
      fileName: null,
      fileSize: null,
      fileHash: null,
      columns: ["Varlık", "Tür", "Sembol", "Miktar", "Birim fiyat", "Toplam değer", "Değerleme para birimi"],
      previewRows: [
        {
          Varlık: suggestion.name,
          Tür: suggestion.assetType,
          Sembol: suggestion.symbol ?? "",
          Miktar: suggestion.quantity?.toString() ?? "",
          "Birim fiyat": suggestion.unitPrice?.toString() ?? "",
          "Toplam değer": suggestion.totalValue.toString(),
          "Değerleme para birimi": suggestion.valuationCurrency
        }
      ],
      detectedColumns: {},
      mapping: {},
      totalRows: 1,
      suggestions: [suggestion],
      highConfidenceSuggestions: suggestion.confidenceLevel === "HIGH" ? [suggestion] : [],
      lowConfidenceSuggestions: suggestion.confidenceLevel === "LOW" ? [suggestion] : [],
      warning: null
    };
  }

  if (!file) {
    throw new DocumentUploadError("Lütfen CSV, XLSX veya PDF mali bilgi dosyası seçin.");
  }

  const table = await extractCapitalTable(userId, file);
  const detectedColumns = detectCapitalColumns(table.columns);
  const mapping = normalizeMapping(options.mapping, detectedColumns);
  const suggestions = buildSuggestions(table.records, mapping, importType, valuationCurrency);
  const existingImport = await prisma.capitalImport.findFirst({
    where: { userId, fileHash: table.fileHash, deletedAt: null },
    select: { id: true, originalFileName: true }
  });
  const duplicateWarning = existingImport ? `Bu dosya daha önce içe aktarılmış olabilir: ${existingImport.originalFileName ?? "kayıtlı dosya"}.` : null;

  return serializePreview(table, importType, mapping, detectedColumns, suggestions, duplicateWarning);
}

export async function confirmCapitalImport(
  userId: string,
  file: File | null,
  options: CapitalImportOptions,
  suggestions: CapitalImportConfirmSuggestion[]
) {
  const importType = normalizeImportType(options.importType);
  const valuationCurrency = normalizeCurrency(options.valuationCurrency);
  const normalizedSuggestions = suggestions.map((suggestion) => normalizeConfirmSuggestion(suggestion, valuationCurrency));
  const acceptedSuggestions = normalizedSuggestions.filter((suggestion) => suggestion.decision === "ACCEPTED");
  const rejectedSuggestions = normalizedSuggestions.filter((suggestion) => suggestion.decision === "REJECTED");

  let table: ExtractedCapitalTable | null = null;
  let storedDocument:
    | {
        id: string;
        fileName: string;
        originalFileName: string;
        mimeType: string;
        fileSize: number;
        storagePath: string;
        fileHash: string;
      }
    | null = null;

  if (importType !== "MANUAL_ENTRY") {
    if (!file) throw new DocumentUploadError("Kaydetmeden önce mali bilgi dosyası seçin.");
    table = await extractCapitalTable(userId, file);
    const existingImport = await prisma.capitalImport.findFirst({
      where: { userId, fileHash: table.fileHash, deletedAt: null },
      select: { originalFileName: true }
    });

    if (existingImport) {
      throw new DocumentUploadError(`Bu dosya daha önce içe aktarılmış olabilir: ${existingImport.originalFileName ?? "kayıtlı dosya"}.`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (file && table) {
      const extension = path.extname(table.fileName).toLowerCase();
      const storedName = createStoredDocumentName(extension);
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = await writePrivateDocumentFile(storedName, buffer);
      const document = await tx.document.create({
        data: {
          userId,
          title: `${importTypeLabel(importType)} - mali bilgi yüklemesi`,
          description: "Sermaye merkezi mali bilgi import akışıyla yüklendi.",
          documentType: importType === "BANK_STATEMENT" ? "BANK_STATEMENT" : "OTHER",
          fileName: storedName,
          originalFileName: table.fileName,
          mimeType: file.type || mimeFromExtension(extension),
          fileSize: table.fileSize,
          storagePath,
          fileHash: table.fileHash,
          currency: valuationCurrency,
          extractedText: table.extractedText,
          extractionStatus: table.sourceType === "PDF" ? "COMPLETED" : "NOT_PROCESSED"
        }
      });

      await tx.documentProcessingLog.create({
        data: {
          userId,
          documentId: document.id,
          status: table.sourceType === "PDF" ? "COMPLETED" : "NOT_PROCESSED",
          message: "Sermaye merkezi import dosyası kaydedildi."
        }
      });

      storedDocument = {
        id: document.id,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        storagePath: document.storagePath,
        fileHash: document.fileHash
      };
    }

    const capitalImport = await tx.capitalImport.create({
      data: {
        userId,
        documentId: storedDocument?.id ?? null,
        importType,
        status: "CONFIRMED",
        originalFileName: storedDocument?.originalFileName ?? null,
        fileName: storedDocument?.fileName ?? null,
        mimeType: storedDocument?.mimeType ?? null,
        fileSize: storedDocument?.fileSize ?? null,
        storagePath: storedDocument?.storagePath ?? null,
        fileHash: storedDocument?.fileHash ?? null,
        columns: (table?.columns ?? []) as Prisma.InputJsonValue,
        previewRows: (table?.records.slice(0, 20) ?? []) as Prisma.InputJsonValue,
        acceptedCount: acceptedSuggestions.length,
        rejectedCount: rejectedSuggestions.length
      }
    });

    if (normalizedSuggestions.length > 0) {
      await tx.capitalImportSuggestion.createMany({
        data: normalizedSuggestions.map((suggestion) => ({
          userId,
          capitalImportId: capitalImport.id,
          rowNumber: suggestion.rowNumber,
          assetType: suggestion.assetType,
          name: suggestion.name,
          symbol: suggestion.symbol,
          currency: suggestion.currency,
          quantity: optionalDecimal(suggestion.quantity),
          unitPrice: optionalDecimal(suggestion.unitPrice),
          totalValue: requiredDecimal(suggestion.totalValue),
          valuationCurrency: suggestion.valuationCurrency,
          confidence: requiredDecimal(suggestion.confidence),
          status: suggestion.decision,
          note: suggestion.note,
          rawData: suggestion.rawData as Prisma.InputJsonValue
        }))
      });
    }

    const createdAssets = [];
    for (const suggestion of acceptedSuggestions) {
      const account = await tx.assetAccount.create({
        data: {
          userId,
          name: suggestion.name,
          assetType: suggestion.assetType,
          currency: suggestion.currency,
          symbol: suggestion.symbol,
          quantity: optionalDecimal(suggestion.quantity),
          unitPrice: optionalDecimal(suggestion.unitPrice),
          manualTotalValue: requiredDecimal(suggestion.totalValue),
          valuationCurrency: suggestion.valuationCurrency,
          sourceDocumentId: storedDocument?.id ?? null,
          capitalImportId: capitalImport.id,
          description: suggestion.note,
          isActive: true
        }
      });
      const valuation = await tx.assetValuation.create({
        data: {
          userId,
          assetAccountId: account.id,
          valuationDate: new Date(),
          quantity: optionalDecimal(suggestion.quantity),
          unitPrice: optionalDecimal(suggestion.unitPrice),
          totalValue: requiredDecimal(suggestion.totalValue),
          valuationCurrency: suggestion.valuationCurrency,
          source: "IMPORTED",
          sourceDocumentId: storedDocument?.id ?? null,
          capitalImportId: capitalImport.id,
          note: "Mali bilgi import akışından oluşturuldu."
        }
      });
      const transaction = await tx.assetTransaction.create({
        data: {
          userId,
          assetAccountId: account.id,
          transactionType: "VALUE_UPDATE",
          date: valuation.valuationDate,
          quantity: optionalDecimal(suggestion.quantity),
          unitPrice: optionalDecimal(suggestion.unitPrice),
          totalAmount: requiredDecimal(suggestion.totalValue),
          currency: suggestion.valuationCurrency,
          description: "Mali bilgi import akışından değer kaydı oluşturuldu."
        }
      });

      createdAssets.push({ account, valuation, transaction });
    }

    return { capitalImport, createdAssets, document: storedDocument };
  });

  await Promise.all([
    result.document
      ? writeAuditLog({
          entityType: "DOCUMENT",
          entityId: result.document.id,
          action: "CREATE",
          newValue: result.document,
          message: "Sermaye merkezi kaynak belgesi yüklendi",
          userId
        })
      : Promise.resolve(),
    writeAuditLog({
      entityType: "CAPITAL_IMPORT",
      entityId: result.capitalImport.id,
      action: "CREATE",
      newValue: {
        id: result.capitalImport.id,
        importType: result.capitalImport.importType,
        acceptedCount: result.capitalImport.acceptedCount,
        rejectedCount: result.capitalImport.rejectedCount
      },
      message: "Mali bilgi importu onaylandı",
      userId
    }),
    ...result.createdAssets.flatMap(({ account, valuation, transaction }) => [
      writeAuditLog({
        entityType: "ASSET_ACCOUNT",
        entityId: account.id,
        action: "CREATE",
        newValue: account,
        message: "Mali bilgi importundan varlık hesabı oluşturuldu",
        userId
      }),
      writeAuditLog({
        entityType: "ASSET_VALUATION",
        entityId: valuation.id,
        action: "VALUE_UPDATE",
        newValue: valuation,
        message: "Mali bilgi importundan varlık değerlemesi oluşturuldu",
        userId
      }),
      writeAuditLog({
        entityType: "ASSET_TRANSACTION",
        entityId: transaction.id,
        action: "VALUE_UPDATE",
        newValue: transaction,
        message: "Mali bilgi importundan varlık hareketi oluşturuldu",
        userId
      })
    ])
  ]);

  return {
    id: result.capitalImport.id,
    documentId: result.document?.id ?? null,
    createdAssetCount: result.createdAssets.length
  };
}

async function extractCapitalTable(userId: string, file: File): Promise<ExtractedCapitalTable> {
  const maxBytes = await getDocumentUploadLimitBytes(userId);
  validateCapitalImportFile(file, maxBytes);
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = sanitizeFileName(file.name);
  const extension = path.extname(fileName).toLowerCase();
  const fileHash = hashBuffer(buffer);

  if (extension === ".csv") {
    const rows = parseCsvSync(buffer.toString("utf8"), {
      bom: true,
      relaxColumnCount: true,
      skipEmptyLines: true,
      trim: true
    }) as unknown[][];
    return rowsToTable("CSV", fileName, file.size, fileHash, rows);
  }

  if (extension === ".xlsx") {
    const rows = await readSheet(buffer);
    return rowsToTable(
      "XLSX",
      fileName,
      file.size,
      fileHash,
      rows.map((row) => row.map((cell: unknown) => (cell instanceof Date ? dateInputValue(cell) : cell == null ? "" : String(cell))))
    );
  }

  const text = await extractPdfText(buffer);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitPdfLine(line));

  return {
    ...rowsToTable("PDF", fileName, file.size, fileHash, rows),
    extractedText: text.slice(0, 40_000),
    warning:
      "PDF portföy dökümlerinde tablo ayrıştırma güveni düşük olabilir. Kolon eşleme/manual mapping ile kontrol edin; en doğru sonuç için mümkünse CSV veya Excel formatı kullanınız."
  };
}

function validateCapitalImportFile(file: File, maxBytes: number) {
  const fileName = sanitizeFileName(file.name);
  const extension = path.extname(fileName).toLowerCase();
  const allowedMimes = allowedImportMimeTypes[extension as keyof typeof allowedImportMimeTypes];

  if (!allowedMimes) {
    throw new DocumentUploadError("Mali bilgi importu için CSV, XLSX veya PDF dosyası yükleyebilirsiniz.");
  }

  if (!file.size || file.size <= 0) {
    throw new DocumentUploadError("Boş dosya yüklenemez.");
  }

  if (file.size > maxBytes) {
    throw new DocumentUploadError(`Dosya boyutu çok büyük. En fazla ${Math.round(maxBytes / 1024 / 1024)} MB yükleyebilirsiniz.`);
  }

  if (file.type && !allowedMimes.includes(file.type)) {
    throw new DocumentUploadError("Dosya tipi ve uzantısı uyumlu değil.");
  }
}

async function extractPdfText(buffer: Buffer) {
  let parser: { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } | null = null;

  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } catch {
    throw new DocumentUploadError("PDF metni çıkarılamadı. Mümkünse CSV veya Excel formatı yükleyiniz.");
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

function rowsToTable(
  sourceType: ExtractedCapitalTable["sourceType"],
  fileName: string,
  fileSize: number,
  fileHash: string,
  rawRows: unknown[][]
): ExtractedCapitalTable {
  const normalizedRows = rawRows
    .map((row) => row.map((cell) => normalizeCell(cell)))
    .filter((row) => row.some(Boolean));
  const headerIndex = findHeaderIndex(normalizedRows);
  const headers = normalizedRows[headerIndex]?.map((cell, index) => cell || `Kolon ${index + 1}`) ?? [];
  const columns = uniqueHeaders(headers);
  const records = normalizedRows.slice(headerIndex + 1).map((row) => rowToRecord(columns, row)).filter((record) => Object.values(record).some(Boolean));

  return { sourceType, fileName, fileSize, fileHash, columns, records };
}

function findHeaderIndex(rows: string[][]) {
  const index = rows.findIndex((row) => {
    const normalized = normalizeText(row.join(" "));
    return ["varlik", "varlık", "asset", "sembol", "symbol", "miktar", "quantity", "bakiye", "balance", "deger", "değer", "portfolio"].some((keyword) =>
      normalized.includes(normalizeText(keyword))
    );
  });

  return index >= 0 ? index : 0;
}

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const clean = header.trim() || `Kolon ${index + 1}`;
    const count = seen.get(clean) ?? 0;
    seen.set(clean, count + 1);
    return count === 0 ? clean : `${clean} ${count + 1}`;
  });
}

function rowToRecord(columns: string[], row: string[]) {
  return columns.reduce<Record<string, string>>((record, column, index) => {
    record[column] = row[index] ?? "";
    return record;
  }, {});
}

function normalizeCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return dateInputValue(value);
  return String(value).trim();
}

function splitPdfLine(line: string) {
  return line
    .split(/\s{2,}|\t+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function detectCapitalColumns(columns: string[]): CapitalImportMapping {
  return {
    name: findColumn(columns, ["varlık", "varlik", "ad", "name", "açıklama", "aciklama", "description", "enstrüman", "enstruman", "asset", "hesap"]),
    symbol: findColumn(columns, ["sembol", "symbol", "kod", "ticker", "coin", "döviz", "doviz"]),
    quantity: findColumn(columns, ["miktar", "adet", "quantity", "qty", "nominal", "gram", "lot"]),
    unitPrice: findColumn(columns, ["birim", "fiyat", "unit", "price", "kur", "ortalama", "average"]),
    totalValue: findColumn(columns, ["toplam", "değer", "deger", "bakiye", "balance", "tutar", "amount", "market value", "portföy", "portfoy"]),
    currency: findColumn(columns, ["para birimi", "currency", "döviz", "doviz", "ccy"])
  };
}

function findColumn(columns: string[], keywords: string[]) {
  return columns.find((column) => {
    const normalized = normalizeText(column);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
  });
}

function normalizeMapping(mapping: CapitalImportMapping | undefined, detected: CapitalImportMapping): CapitalImportMapping {
  const next = { ...detected };
  for (const key of ["name", "symbol", "quantity", "unitPrice", "totalValue", "currency"] as CapitalImportColumnKey[]) {
    if (mapping?.[key]) next[key] = mapping[key];
  }
  return next;
}

function buildSuggestions(
  records: Record<string, string>[],
  mapping: CapitalImportMapping,
  importType: CapitalImportType,
  valuationCurrency: string
) {
  return records
    .map((record, index) => suggestionFromRecord(record, index + 1, mapping, importType, valuationCurrency))
    .filter((suggestion): suggestion is CapitalImportSuggestionDraft => Boolean(suggestion));
}

function suggestionFromRecord(
  record: Record<string, string>,
  rowNumber: number,
  mapping: CapitalImportMapping,
  importType: CapitalImportType,
  valuationCurrency: string
): CapitalImportSuggestionDraft | null {
  const rowText = Object.values(record).filter(Boolean).join(" ");
  const name = (valueFor(record, mapping.name) || rowText || `Varlık ${rowNumber}`).slice(0, 120);
  const rawSymbol = valueFor(record, mapping.symbol) || extractKnownSymbol(rowText);
  const symbol = cleanSymbol(rawSymbol);
  const currency = cleanSymbol(valueFor(record, mapping.currency)) || inferCurrency(symbol, rowText);
  const quantity = parseCapitalNumber(valueFor(record, mapping.quantity));
  const unitPrice = parseCapitalNumber(valueFor(record, mapping.unitPrice));
  const explicitTotal = parseCapitalNumber(valueFor(record, mapping.totalValue));
  const calculatedTotal = quantity != null && unitPrice != null ? quantity * unitPrice : null;
  const rawTotalValue = explicitTotal ?? calculatedTotal ?? extractLargestNumber(rowText);
  const assetType = inferAssetType(importType, name, symbol, currency, rawTotalValue);

  if (!name.trim() || rawTotalValue == null || Math.abs(rawTotalValue) <= 0) {
    return null;
  }

  const totalValue = assetType === "DEBT" ? Math.abs(rawTotalValue) : Math.abs(rawTotalValue);
  const confidence = confidenceFor({ importType, assetType, name, symbol, totalValue, quantity, unitPrice });
  const note = noteFor(assetType, confidence);

  return {
    tempId: `${rowNumber}-${assetType}-${symbol ?? normalizeText(name).slice(0, 12)}`,
    rowNumber,
    assetType,
    name: name.trim(),
    symbol,
    currency,
    quantity,
    unitPrice,
    totalValue,
    totalValueLabel: formatMoney(totalValue, valuationCurrency),
    valuationCurrency,
    confidence,
    confidenceLabel: `%${Math.round(confidence * 100)}`,
    confidenceLevel: confidence >= 0.7 ? "HIGH" : "LOW",
    note,
    rawData: record
  };
}

function suggestionFromManual(input: CapitalManualInput | undefined, valuationCurrency: string): CapitalImportSuggestionDraft {
  const name = clean(input?.name) || "Manuel varlık";
  const symbol = cleanSymbol(input?.symbol);
  const currency = cleanSymbol(input?.currency) || inferCurrency(symbol, name);
  const quantity = parseCapitalNumber(input?.quantity);
  const unitPrice = parseCapitalNumber(input?.unitPrice);
  const rawTotal = parseCapitalNumber(input?.totalValue) ?? (quantity != null && unitPrice != null ? quantity * unitPrice : null);
  const manualAssetType = input?.assetType && isAssetType(input.assetType) ? input.assetType : null;
  const assetType = manualAssetType ?? inferAssetType("MANUAL_ENTRY", name, symbol, currency, rawTotal);

  if (rawTotal == null || Math.abs(rawTotal) <= 0) {
    throw new DocumentUploadError("Manuel giriş için toplam değer veya miktar/birim fiyat bilgisi gerekli.");
  }

  const confidence = confidenceFor({ importType: "MANUAL_ENTRY", assetType, name, symbol, totalValue: rawTotal, quantity, unitPrice });
  return {
    tempId: "manual-1",
    rowNumber: null,
    assetType,
    name,
    symbol,
    currency,
    quantity,
    unitPrice,
    totalValue: Math.abs(rawTotal),
    totalValueLabel: formatMoney(Math.abs(rawTotal), valuationCurrency),
    valuationCurrency,
    confidence,
    confidenceLabel: `%${Math.round(confidence * 100)}`,
    confidenceLevel: confidence >= 0.7 ? "HIGH" : "LOW",
    note: "Manuel mali bilgi girişinden önerildi.",
    rawData: { name, symbol: symbol ?? "", currency: currency ?? "", totalValue: String(rawTotal) }
  };
}

function serializePreview(
  table: ExtractedCapitalTable,
  importType: CapitalImportType,
  mapping: CapitalImportMapping,
  detectedColumns: CapitalImportMapping,
  suggestions: CapitalImportSuggestionDraft[],
  duplicateWarning: string | null
): CapitalImportPreview {
  const warning = [duplicateWarning, table.warning].filter(Boolean).join(" ") || null;

  return {
    importType,
    sourceType: table.sourceType,
    fileName: table.fileName,
    fileSize: table.fileSize,
    fileHash: table.fileHash,
    columns: table.columns,
    previewRows: table.records.slice(0, 20),
    detectedColumns,
    mapping,
    totalRows: table.records.length,
    suggestions,
    highConfidenceSuggestions: suggestions.filter((suggestion) => suggestion.confidenceLevel === "HIGH"),
    lowConfidenceSuggestions: suggestions.filter((suggestion) => suggestion.confidenceLevel === "LOW"),
    warning
  };
}

function normalizeConfirmSuggestion(suggestion: CapitalImportConfirmSuggestion, defaultCurrency: string) {
  const name = clean(suggestion.name);
  const totalValue = parseCapitalNumber(suggestion.totalValue);

  if (!name) {
    throw new DocumentUploadError("Kabul edilen önerilerde varlık adı gerekli.");
  }

  if (!isAssetType(suggestion.assetType)) {
    throw new DocumentUploadError("Kabul edilen öneride geçerli varlık türü seçin.");
  }

  if (totalValue == null || totalValue <= 0) {
    throw new DocumentUploadError("Kabul edilen önerilerde toplam değer pozitif olmalı.");
  }

  return {
    rowNumber: suggestion.rowNumber ?? null,
    assetType: suggestion.assetType,
    name,
    symbol: cleanSymbol(suggestion.symbol),
    currency: cleanSymbol(suggestion.currency),
    quantity: parseCapitalNumber(suggestion.quantity),
    unitPrice: parseCapitalNumber(suggestion.unitPrice),
    totalValue,
    valuationCurrency: normalizeCurrency(suggestion.valuationCurrency ?? defaultCurrency),
    confidence: clamp(parseCapitalNumber(suggestion.confidence) ?? 0.5, 0, 1),
    note: clean(suggestion.note),
    rawData: suggestion.rawData ?? {},
    decision: (suggestion.decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED") as CapitalImportSuggestionStatus
  };
}

function inferAssetType(importType: CapitalImportType, name: string, symbol: string | null, currency: string | null, amount: number | null): AssetType {
  const text = normalizeText(`${name} ${symbol ?? ""} ${currency ?? ""}`);

  if ((amount ?? 0) < 0 || hasAny(text, ["borc", "borç", "kredi", "eksi", "loan", "debt", "kart borcu"])) return "DEBT";
  if (importType === "FX_STATEMENT") return "FX";
  if (importType === "GOLD_STATEMENT") return "GOLD";
  if (importType === "STOCK_PORTFOLIO") return text.includes("fon") || text.includes("fund") ? "FUND" : "STOCK";
  if (importType === "CRYPTO_PORTFOLIO") return "CRYPTO";
  if (importType === "BANK_STATEMENT") return hasAny(text, ["nakit", "cash", "kasa"]) ? "CASH" : "BANK";
  if (knownCryptoSymbols.some((item) => text.includes(item.toLowerCase()))) return "CRYPTO";
  if (knownGoldSymbols.some((item) => text.includes(item.toLowerCase())) || hasAny(text, ["altin", "altın", "gram", "gold"])) return "GOLD";
  if (knownCurrencySymbols.some((item) => text.includes(item.toLowerCase()))) return "FX";
  if (hasAny(text, ["fon", "fund"])) return "FUND";
  if (hasAny(text, ["hisse", "borsa", "stock", "equity", "pay"])) return "STOCK";
  if (hasAny(text, ["banka", "hesap", "balance", "mevduat"])) return "BANK";
  if (hasAny(text, ["nakit", "kasa", "cash"])) return "CASH";
  return "OTHER";
}

function confidenceFor(input: {
  importType: CapitalImportType;
  assetType: AssetType;
  name: string;
  symbol: string | null;
  totalValue: number;
  quantity: number | null;
  unitPrice: number | null;
}) {
  let confidence = 0.45;
  if (input.name.length > 2) confidence += 0.1;
  if (input.symbol) confidence += 0.15;
  if (input.totalValue > 0) confidence += 0.15;
  if (input.quantity != null || input.unitPrice != null) confidence += 0.08;
  if (input.importType !== "OTHER_FINANCIAL_DOCUMENT" && input.assetType !== "OTHER") confidence += 0.15;
  if (input.assetType === "OTHER") confidence -= 0.15;
  return clamp(Number(confidence.toFixed(2)), 0.1, 0.98);
}

function noteFor(assetType: AssetType, confidence: number) {
  const confidenceText = confidence >= 0.7 ? "Yüksek güvenli öneri" : "Düşük güvenli öneri; lütfen kontrol edin";
  if (assetType === "DEBT") return `${confidenceText}. Borç/eksi bakiye olarak net sermayeden düşülecek.`;
  return `${confidenceText}. Canlı fiyat çekilmedi; değer dosyadaki veya manuel girilen rakama göre oluşturulur.`;
}

function valueFor(record: Record<string, string>, column?: string) {
  return column ? record[column]?.trim() ?? "" : "";
}

function parseCapitalNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleanValue = String(value).trim();
  if (!cleanValue) return null;
  const parsed = toNumber(cleanValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractLargestNumber(text: string) {
  const values = text
    .match(/[+-]?\d[\d.,\s]*\d|[+-]?\d/g)
    ?.map((value) => parseCapitalNumber(value))
    .filter((value): value is number => value != null && Math.abs(value) > 0);

  if (!values?.length) return null;
  return values.sort((a, b) => Math.abs(b) - Math.abs(a))[0] ?? null;
}

function extractKnownSymbol(text: string) {
  const normalized = normalizeText(text).toUpperCase();
  const knownSymbol = [...knownCryptoSymbols, ...knownCurrencySymbols, "XAU", "GAU"].find((symbol) => normalized.includes(symbol));
  if (knownSymbol) return knownSymbol;
  const ticker = text.match(/\b[A-ZÇĞİÖŞÜ]{3,6}\b/u)?.[0];
  return ticker ?? "";
}

function inferCurrency(symbol: string | null, text: string) {
  const normalized = normalizeText(`${symbol ?? ""} ${text}`).toUpperCase();
  return knownCurrencySymbols.find((currency) => normalized.includes(currency)) ?? null;
}

function cleanSymbol(value: unknown) {
  const next = clean(value)?.toUpperCase().replace(/[^\w]/g, "").slice(0, 16);
  return next || null;
}

function clean(value: unknown) {
  const next = value == null ? "" : String(value).trim();
  return next || null;
}

function normalizeCurrency(value?: string | null) {
  const next = cleanSymbol(value);
  return next?.slice(0, 3) || "TRY";
}

function normalizeImportType(value: CapitalImportType) {
  if (!supportedImportTypes.includes(value)) {
    throw new DocumentUploadError("Geçerli bir mali bilgi türü seçin.");
  }
  return value;
}

function isAssetType(value: string): value is AssetType {
  return ["CASH", "BANK", "FX", "GOLD", "STOCK", "CRYPTO", "FUND", "REAL_ESTATE", "VEHICLE", "RECEIVABLE", "DEBT", "OTHER"].includes(value);
}

function optionalDecimal(value: unknown) {
  const parsed = parseCapitalNumber(value);
  return parsed == null ? null : new Prisma.Decimal(parsed);
}

function requiredDecimal(value: unknown) {
  const parsed = parseCapitalNumber(value);
  return new Prisma.Decimal(parsed ?? 0);
}

function mimeFromExtension(extension: string) {
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/csv";
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function importTypeLabel(importType: CapitalImportType) {
  const labels: Record<CapitalImportType, string> = {
    BANK_STATEMENT: "Banka ekstresi",
    FX_STATEMENT: "Döviz hesap dökümü",
    GOLD_STATEMENT: "Altın hesap dökümü",
    STOCK_PORTFOLIO: "Borsa portföy dökümü",
    CRYPTO_PORTFOLIO: "Crypto portföy dökümü",
    OTHER_FINANCIAL_DOCUMENT: "Diğer mali belge",
    MANUAL_ENTRY: "Manuel giriş"
  };
  return labels[importType];
}
