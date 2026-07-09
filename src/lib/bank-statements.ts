import path from "node:path";

import {
  Prisma,
  type BankStatementDirection,
  type BankStatementRowStatus,
  type BankStatementSourceType
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { getBankImportMappingSuggestion, rememberBankImportMapping } from "@/lib/bank/import/mapping-preferences";
import { parseCsvStatementTable } from "@/lib/bank/parsers/csv-parser";
import {
  createStatementRowHash,
  detectStatementColumns,
  normalizeStatementMapping,
  normalizeStatementRows,
  parseErrorColumn,
  parseStatementDate,
  parseStatementDecimal,
  parseWarningColumn,
  rawRowColumn,
  sourceRowNumberColumn,
  type NormalizedStatementTable
} from "@/lib/bank/parsers/normalize-rows";
import { parseXlsxStatementTable } from "@/lib/bank/parsers/xlsx-parser";
import {
  createStoredDocumentName,
  DocumentUploadError,
  getDocumentUploadLimitBytes,
  hashBuffer,
  sanitizeFileName,
  writePrivateDocumentFile
} from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatMoney, toNumber } from "@/lib/utils";

export type BankStatementColumnKey = "date" | "description" | "debit" | "credit" | "balance" | "currency";
export type BankStatementDateFormat = "auto" | "DD.MM.YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";
export type DecimalSeparator = "," | ".";
export type ThousandSeparator = "." | "," | "space" | "none";

export type BankStatementMapping = Partial<Record<BankStatementColumnKey, string>>;

export type BankStatementParseOptions = {
  bankName: string;
  cashAccountId?: string | null;
  currency: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  mapping?: BankStatementMapping;
  dateFormat?: BankStatementDateFormat;
  decimalSeparator?: DecimalSeparator;
  thousandSeparator?: ThousandSeparator;
  delimiter?: string | "auto";
  maxRecordSize?: number;
  skipRecordsWithError?: boolean;
};

export type BankStatementPreview = {
  sourceType: BankStatementSourceType;
  fileName: string;
  fileSize: number;
  fileHash: string;
  sourceConfidence: "HIGH" | "LOW";
  columns: string[];
  previewRows: Record<string, string>[];
  detectedColumns: BankStatementMapping;
  mapping: BankStatementMapping;
  mappingSource: "DETECTED" | "SAVED" | "MANUAL";
  mappingPreferenceId?: string;
  mappingSuggestionMessage?: string;
  parseSummary: BankStatementParseSummary;
  analysis: BankStatementAnalysis;
  duplicateImport?: {
    id: string;
    bankName: string;
    createdAt: string;
  };
  warning?: string;
};

export type BankStatementParseSummary = {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  duplicateRows: number;
  startDate: string | null;
  endDate: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
};

export type BankStatementAnalysis = {
  incomeRows: number;
  expenseRows: number;
  neutralRows: number;
  suggestedRows: Array<{
    rowNumber: number;
    date: string;
    description: string;
    amount: string;
    direction: BankStatementDirection;
    categorySuggestion: string;
    clientSuggestion: string;
    caseFileSuggestion: string;
    matchSuggestion: string;
    status: BankStatementRowStatus;
    errorMessage: string | null;
  }>;
};

export type ParsedBankStatementRow = {
  rowNumber: number;
  transactionDate: Date | null;
  description: string;
  debitAmount: Prisma.Decimal | null;
  creditAmount: Prisma.Decimal | null;
  amount: Prisma.Decimal | null;
  balance: Prisma.Decimal | null;
  currency: string;
  direction: BankStatementDirection;
  status: BankStatementRowStatus;
  errorMessage: string | null;
  rawData: Record<string, string>;
  rawHash: string;
  categorySuggestion: string | null;
  clientSuggestionId: string | null;
  clientSuggestionName: string | null;
  caseFileSuggestionId: string | null;
  caseFileSuggestionTitle: string | null;
  matchType: "NONE" | "SUGGESTED";
  matchedIncomeId: string | null;
  matchedExpenseId: string | null;
  matchedCashLedgerEntryId: string | null;
  matchLabel: string | null;
};

type ExtractedStatementTable = NormalizedStatementTable & {
  detectedColumnsJson?: Prisma.InputJsonObject;
  mappingJson?: Prisma.InputJsonObject;
  previewRowsText?: string;
  detectedColumns?: BankStatementMapping;
  effectiveMapping?: BankStatementMapping;
  mappingSource?: BankStatementPreview["mappingSource"];
  mappingPreferenceId?: string;
  mappingSuggestionMessage?: string;
};

const allowedStatementMimeTypes = {
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".pdf": ["application/pdf"]
};

const supportedExtensions = Object.keys(allowedStatementMimeTypes);

export async function buildBankStatementPreview(userId: string, file: File, options: BankStatementParseOptions) {
  const { table, parsedRows } = await parseBankStatementFile(userId, file, options);
  const duplicateImport = await findExistingImport(userId, table.fileHash);
  return serializePreview(table, parsedRows, duplicateImport);
}

export async function createBankStatementImport(userId: string, file: File, options: BankStatementParseOptions) {
  if (!options.bankName.trim()) {
    throw new DocumentUploadError("Banka adı gerekli.");
  }

  const { table, parsedRows } = await parseBankStatementFile(userId, file, options);
  const existingImport = await findExistingImport(userId, table.fileHash);

  if (existingImport) {
    throw new DocumentUploadError(`Bu ekstre daha önce içe aktarılmış olabilir: ${existingImport.bankName}`);
  }

  const cashAccount = options.cashAccountId
    ? await prisma.cashAccount.findFirst({
        where: { id: options.cashAccountId, userId, deletedAt: null },
        select: { id: true }
      })
    : null;

  if (options.cashAccountId && !cashAccount) {
    throw new DocumentUploadError("Seçili kasa/banka hesabı bulunamadı.");
  }

  const extension = path.extname(table.fileName).toLowerCase();
  const storedName = createStoredDocumentName(extension);
  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await writePrivateDocumentFile(storedName, buffer);
  const summary = summarizeRows(parsedRows);
  const sourceLabel = table.sourceType === "PDF" ? "PDF" : table.sourceType === "XLSX" ? "Excel" : "CSV";
  const title = `${options.bankName.trim()} banka ekstresi (${sourceLabel})`;

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        userId,
        title,
        description: "Banka ekstresi içe aktarma sihirbazı ile yüklendi.",
        documentType: "BANK_STATEMENT",
        fileName: storedName,
        originalFileName: table.fileName,
        mimeType: file.type || mimeFromExtension(extension),
        fileSize: table.fileSize,
        storagePath,
        fileHash: table.fileHash,
        documentDate: periodDateOrNull(options.periodEnd) ?? periodDateOrNull(options.periodStart),
        currency: options.currency.toUpperCase(),
        extractedText: table.sourceType === "PDF" ? table.previewRowsText : undefined,
        extractionStatus: table.sourceType === "PDF" ? "COMPLETED" : "NOT_PROCESSED"
      }
    });

    await tx.documentProcessingLog.create({
      data: {
        userId,
        documentId: document.id,
        status: table.sourceType === "PDF" ? "COMPLETED" : "NOT_PROCESSED",
        message: "Banka ekstresi sihirbazı dosyayı kaydetti."
      }
    });

    const bankImport = await tx.bankStatementImport.create({
      data: {
        userId,
        documentId: document.id,
        cashAccountId: cashAccount?.id ?? null,
        bankName: options.bankName.trim(),
        sourceType: table.sourceType,
        status: "IMPORTED",
        currency: options.currency.toUpperCase(),
        fileName: storedName,
        originalFileName: table.fileName,
        mimeType: file.type || mimeFromExtension(extension),
        fileSize: table.fileSize,
        storagePath,
        fileHash: table.fileHash,
        periodStart: periodDateOrNull(options.periodStart),
        periodEnd: periodDateOrNull(options.periodEnd),
        detectedColumns: table.detectedColumnsJson,
        columnMapping: table.mappingJson,
        dateFormat: options.dateFormat ?? "auto",
        decimalSeparator: options.decimalSeparator ?? ",",
        thousandSeparator: options.thousandSeparator ?? ".",
        totalRows: summary.totalRows,
        successfulRows: summary.successfulRows,
        failedRows: summary.failedRows,
        duplicateRows: summary.duplicateRows,
        openingBalance: summary.openingBalanceDecimal,
        closingBalance: summary.closingBalanceDecimal,
        notes: table.warning ?? null
      }
    });

    await rememberBankImportMapping(tx, {
      userId,
      bankName: options.bankName,
      sourceType: table.sourceType,
      columnsFingerprint: table.columnsFingerprint,
      detectedColumns: table.detectedColumns ?? {},
      columnMapping: table.effectiveMapping ?? {},
      options
    });

    const rowsToPersist = parsedRows.filter((row) => row.status !== "DUPLICATE");

    if (rowsToPersist.length > 0) {
      await tx.bankStatementRow.createMany({
        data: rowsToPersist.map((row) => ({
          userId,
          importId: bankImport.id,
          cashAccountId: cashAccount?.id ?? null,
          rowNumber: row.rowNumber,
          transactionDate: row.transactionDate,
          description: row.description || "-",
          debitAmount: row.debitAmount,
          creditAmount: row.creditAmount,
          amount: row.amount,
          balance: row.balance,
          currency: row.currency,
          direction: row.direction,
          status: row.status,
          errorMessage: row.errorMessage,
          rawData: row.rawData,
          rawHash: row.rawHash,
          categorySuggestion: row.categorySuggestion,
          clientSuggestionId: row.clientSuggestionId,
          caseFileSuggestionId: row.caseFileSuggestionId,
          matchType: row.matchType,
          matchedIncomeId: row.matchedIncomeId,
          matchedExpenseId: row.matchedExpenseId,
          matchedCashLedgerEntryId: row.matchedCashLedgerEntryId
        }))
      });
    }

    return { bankImport, document };
  });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: result.document.id,
    action: "CREATE",
    newValue: result.document,
    message: "Banka ekstresi belgesi yüklendi",
    userId
  });
  await writeAuditLog({
    entityType: "BANK_STATEMENT_IMPORT",
    entityId: result.bankImport.id,
    action: "CREATE",
    newValue: result.bankImport,
    message: "Banka ekstresi içe aktarıldı",
    userId
  });

  return { id: result.bankImport.id, preview: serializePreview(table, parsedRows) };
}

async function findExistingImport(userId: string, fileHash: string) {
  const existingImport = await prisma.bankStatementImport.findFirst({
    where: { userId, fileHash, deletedAt: null },
    select: { id: true, bankName: true, createdAt: true }
  });

  return existingImport
    ? {
        id: existingImport.id,
        bankName: existingImport.bankName,
        createdAt: existingImport.createdAt.toISOString()
      }
    : null;
}

async function parseBankStatementFile(userId: string, file: File, options: BankStatementParseOptions) {
  const maxBytes = await getDocumentUploadLimitBytes(userId);
  validateBankStatementFile(file, maxBytes);
  const buffer = Buffer.from(await file.arrayBuffer());
  const table = await extractStatementTable(file, buffer, options);
  const detectedColumns = detectStatementColumns(table.columns);
  const hasManualMapping = Object.values(options.mapping ?? {}).some(Boolean);
  const savedMapping = hasManualMapping
    ? null
    : await getBankImportMappingSuggestion({
        userId,
        bankName: options.bankName,
        sourceType: table.sourceType,
        columnsFingerprint: table.columnsFingerprint
      });
  const mappingSource: BankStatementPreview["mappingSource"] = hasManualMapping ? "MANUAL" : savedMapping ? "SAVED" : "DETECTED";
  const mapping = normalizeStatementMapping(options.mapping, savedMapping?.mapping ?? detectedColumns);
  const rows = await parseRows(userId, table.records, mapping, options);

  return {
    table: {
      ...table,
      detectedColumnsJson: toJsonMapping(detectedColumns),
      mappingJson: toJsonMapping(mapping),
      detectedColumns,
      effectiveMapping: mapping,
      mappingSource,
      mappingPreferenceId: savedMapping?.id,
      mappingSuggestionMessage: savedMapping
        ? savedMapping.source === "EXACT"
          ? "Aynı banka ve aynı kolon yapısı için kayıtlı eşleme önerildi."
          : "Aynı banka için daha önce kullanılan eşleme önerildi."
        : undefined,
      previewRowsText: table.records
        .slice(0, 20)
        .map((row) => table.columns.map((column) => row[column] ?? "").join(" | "))
        .join("\n")
    },
    parsedRows: rows
  };
}

function toJsonMapping(mapping: BankStatementMapping): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(mapping).filter(([, value]) => Boolean(value))) as Prisma.InputJsonObject;
}

function validateBankStatementFile(file: File, maxBytes: number) {
  const fileName = sanitizeFileName(file.name);
  const extension = path.extname(fileName).toLowerCase();
  const allowedMimes = allowedStatementMimeTypes[extension as keyof typeof allowedStatementMimeTypes];

  if (!allowedMimes || !supportedExtensions.includes(extension)) {
    throw new DocumentUploadError("Banka ekstresi için CSV, XLSX veya PDF dosyası yükleyebilirsiniz.");
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

async function extractStatementTable(file: File, buffer: Buffer, options: BankStatementParseOptions): Promise<ExtractedStatementTable> {
  const fileName = sanitizeFileName(file.name);
  const extension = path.extname(fileName).toLowerCase();
  const fileHash = hashBuffer(buffer);

  if (extension === ".csv") {
    return parseCsvStatementTable({ buffer, fileName, fileSize: file.size, fileHash, options });
  }

  if (extension === ".xlsx") {
    try {
      return await parseXlsxStatementTable({ buffer, fileName, fileSize: file.size, fileHash });
    } catch {
      throw new DocumentUploadError("Excel dosyası önizlemesi oluşturulamadı. Dosya bozuk veya desteklenmeyen biçimde olabilir.");
    }
  }

  const pdfText = await extractPdfText(buffer);
  const rows = pdfText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((line: string) => splitPdfLine(line));

  return {
    ...normalizePdfRows(fileName, file.size, fileHash, rows),
    warning: "PDF banka ekstreleri bankadan bankaya değişebilir. En doğru sonuç için mümkünse CSV veya Excel formatı kullanınız."
  };
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

function splitPdfLine(line: string) {
  return line
    .split(/\s{2,}|\t+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function normalizePdfRows(fileName: string, fileSize: number, fileHash: string, rawRows: unknown[][]): ExtractedStatementTable {
  return normalizeStatementRows({
    sourceType: "PDF",
    fileName,
    fileSize,
    fileHash,
    rawRows
  });
}

async function parseRows(
  userId: string,
  records: Record<string, string>[],
  mapping: BankStatementMapping,
  options: BankStatementParseOptions
): Promise<ParsedBankStatementRow[]> {
  const [clients, caseFiles, recentEntries, existingRows] = await Promise.all([
    prisma.client.findMany({ where: { userId, deletedAt: null, archivedAt: null }, select: { id: true, name: true } }),
    prisma.caseFile.findMany({
      where: { userId, deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" }, client: { deletedAt: null, archivedAt: null } },
      select: { id: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashLedgerEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { date: "desc" },
      take: 1000,
      select: { id: true, incomeId: true, expenseId: true, direction: true, amount: true, date: true, description: true }
    }),
    prisma.bankStatementRow.findMany({
      where: { userId, deletedAt: null },
      select: { rawHash: true }
    })
  ]);
  const existingHashes = new Set(existingRows.map((row) => row.rawHash));
  const seenHashes = new Set<string>();

  return records.map((record, index) => {
    const rowNumber = parseSourceRowNumber(record[sourceRowNumberColumn], index + 1);
    const rawDate = valueFor(record, mapping.date);
    const parserError = record[parseErrorColumn]?.trim() ?? "";
    const parserWarning = record[parseWarningColumn]?.trim() ?? "";
    const rawDescription = valueFor(record, mapping.description) || visibleRecordValues(record).join(" ").slice(0, 240);
    const rawDebit = valueFor(record, mapping.debit);
    const rawCredit = valueFor(record, mapping.credit);
    const rawBalance = valueFor(record, mapping.balance);
    const currency = (valueFor(record, mapping.currency) || options.currency || "TRY").toUpperCase().slice(0, 3);
    const transactionDate = parseStatementDate(rawDate, options.dateFormat ?? "auto");
    const debitAmount = parseStatementDecimal(rawDebit, options);
    const creditAmount = parseStatementDecimal(rawCredit, options);
    const balance = parseStatementDecimal(rawBalance, options);
    const amount = creditAmount && creditAmount.greaterThan(0) ? creditAmount : debitAmount && debitAmount.greaterThan(0) ? debitAmount.negated() : null;
    const direction: BankStatementDirection = amount ? (amount.greaterThan(0) ? "IN" : amount.lessThan(0) ? "OUT" : "NEUTRAL") : "NEUTRAL";
    const rawHash = createStatementRowHash({ transactionDate, rawDescription, debitAmount, creditAmount, balance, currency, rawData: record });
    const duplicate = existingHashes.has(rawHash) || seenHashes.has(rawHash);
    seenHashes.add(rawHash);
    const errors = [
      parserError,
      transactionDate ? "" : "Tarih okunamadı",
      rawDescription ? "" : "Açıklama yok",
      amount ? "" : "Borç/alacak tutarı okunamadı"
    ].filter(Boolean);
    const status: BankStatementRowStatus = duplicate ? "DUPLICATE" : errors.length > 0 ? "ERROR" : "SUCCESS";
    const clientSuggestion = suggestClient(rawDescription, clients);
    const caseFileSuggestion = suggestCaseFile(rawDescription, caseFiles);
    const match = suggestLedgerMatch({ transactionDate, amount, direction }, recentEntries);

    return {
      rowNumber,
      transactionDate,
      description: rawDescription || "-",
      debitAmount,
      creditAmount,
      amount,
      balance,
      currency,
      direction,
      status,
      errorMessage: duplicate ? "Duplicate satır" : [parserWarning, ...errors].filter(Boolean).join(", ") || null,
      rawData: record,
      rawHash,
      categorySuggestion: suggestCategory(rawDescription, direction),
      clientSuggestionId: clientSuggestion?.id ?? null,
      clientSuggestionName: clientSuggestion?.name ?? null,
      caseFileSuggestionId: caseFileSuggestion?.id ?? null,
      caseFileSuggestionTitle: caseFileSuggestion?.title ?? null,
      matchType: match ? "SUGGESTED" : "NONE",
      matchedIncomeId: match?.incomeId ?? null,
      matchedExpenseId: match?.expenseId ?? null,
      matchedCashLedgerEntryId: match?.id ?? null,
      matchLabel: match ? `${formatDate(match.date)} - ${formatMoney(match.amount)}` : null
    };
  });
}

function serializePreview(
  table: ExtractedStatementTable,
  parsedRows: ParsedBankStatementRow[],
  duplicateImport?: { id: string; bankName: string; createdAt: string } | null
): BankStatementPreview {
  const summary = summarizeRows(parsedRows);
  const analysis = analyzeRows(parsedRows);
  const detectedColumns = table.detectedColumns ?? detectStatementColumns(table.columns);
  const mapping = table.effectiveMapping ?? detectedColumns;

  return {
    sourceType: table.sourceType,
    fileName: table.fileName,
    fileSize: table.fileSize,
    fileHash: table.fileHash,
    sourceConfidence: table.sourceType === "PDF" ? "LOW" : "HIGH",
    columns: table.columns,
    previewRows: table.records.slice(0, 20),
    detectedColumns,
    mapping,
    mappingSource: table.mappingSource ?? "DETECTED",
    mappingPreferenceId: table.mappingPreferenceId,
    mappingSuggestionMessage: table.mappingSuggestionMessage,
    parseSummary: {
      totalRows: summary.totalRows,
      successfulRows: summary.successfulRows,
      failedRows: summary.failedRows,
      duplicateRows: summary.duplicateRows,
      startDate: summary.startDate ? formatDate(summary.startDate) : null,
      endDate: summary.endDate ? formatDate(summary.endDate) : null,
      openingBalance: summary.openingBalanceDecimal ? formatMoney(summary.openingBalanceDecimal) : null,
      closingBalance: summary.closingBalanceDecimal ? formatMoney(summary.closingBalanceDecimal) : null
    },
    analysis,
    duplicateImport: duplicateImport ?? undefined,
    warning: table.warning
  };
}

function summarizeRows(rows: ParsedBankStatementRow[]) {
  const validRows = rows.filter((row) => row.transactionDate);
  const balanceRows = rows.filter((row) => row.balance != null);
  const dates = validRows.map((row) => row.transactionDate as Date).sort((a, b) => a.getTime() - b.getTime());

  return {
    totalRows: rows.length,
    successfulRows: rows.filter((row) => row.status === "SUCCESS").length,
    failedRows: rows.filter((row) => row.status === "ERROR").length,
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    openingBalanceDecimal: balanceRows[0]?.balance ?? null,
    closingBalanceDecimal: balanceRows[balanceRows.length - 1]?.balance ?? null
  };
}

function analyzeRows(rows: ParsedBankStatementRow[]): BankStatementAnalysis {
  return {
    incomeRows: rows.filter((row) => row.direction === "IN" && row.status === "SUCCESS").length,
    expenseRows: rows.filter((row) => row.direction === "OUT" && row.status === "SUCCESS").length,
    neutralRows: rows.filter((row) => row.direction === "NEUTRAL").length,
    suggestedRows: rows.slice(0, 20).map((row) => ({
      rowNumber: row.rowNumber,
      date: row.transactionDate ? formatDate(row.transactionDate) : "-",
      description: row.description,
      amount: row.amount ? formatMoney(row.amount.abs(), row.currency) : "-",
      direction: row.direction,
      categorySuggestion: row.categorySuggestion ?? "-",
      clientSuggestion: row.clientSuggestionName ?? "-",
      caseFileSuggestion: row.caseFileSuggestionTitle ?? "-",
      matchSuggestion: row.matchLabel ?? "-",
      status: row.status,
      errorMessage: row.errorMessage
    }))
  };
}

function valueFor(record: Record<string, string>, column: string | undefined) {
  return column ? record[column]?.trim() ?? "" : "";
}

function visibleRecordValues(record: Record<string, string>) {
  const hiddenKeys = new Set([sourceRowNumberColumn, rawRowColumn, parseWarningColumn, parseErrorColumn]);
  return Object.entries(record)
    .filter(([key, value]) => !hiddenKeys.has(key) && Boolean(value))
    .map(([, value]) => value);
}

function parseSourceRowNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function suggestCategory(description: string, direction: BankStatementDirection) {
  const text = normalizeText(description);
  if (direction === "IN") {
    if (text.includes("vekalet") || text.includes("avukat") || text.includes("ucret")) return "Avukatlık ücreti";
    if (text.includes("avans")) return "Avans";
    return "Tahsilat";
  }

  if (text.includes("vergi") || text.includes("kdv") || text.includes("sgk")) return "Vergi";
  if (text.includes("noter")) return "Noter";
  if (text.includes("harc") || text.includes("mahkeme")) return "Harç";
  if (text.includes("elektrik") || text.includes("su") || text.includes("internet") || text.includes("kira")) return "Ofis gideri";
  if (text.includes("yemek") || text.includes("restoran")) return "Yemek";
  if (text.includes("taksi") || text.includes("otopark") || text.includes("ulasim")) return "Ulaşım";
  return direction === "OUT" ? "Gider" : null;
}

function suggestClient(description: string, clients: Array<{ id: string; name: string }>) {
  const text = normalizeText(description);
  return clients.find((client) => normalizeText(client.name).split(" ").some((part) => part.length > 2 && text.includes(part)));
}

function suggestCaseFile(
  description: string,
  caseFiles: Array<{ id: string; title: string; fileNumber: string | null; client: { name: string } }>
) {
  const text = normalizeText(description);
  return caseFiles.find((caseFile) => {
    const fileNumber = normalizeText(caseFile.fileNumber ?? "");
    const title = normalizeText(caseFile.title);
    return (fileNumber && text.includes(fileNumber)) || title.split(" ").some((part) => part.length > 3 && text.includes(part));
  });
}

function suggestLedgerMatch(
  row: { transactionDate: Date | null; amount: Prisma.Decimal | null; direction: BankStatementDirection },
  entries: Array<{ id: string; incomeId: string | null; expenseId: string | null; direction: BankStatementDirection; amount: Prisma.Decimal; date: Date; description: string | null }>
) {
  if (!row.transactionDate || !row.amount || row.direction === "NEUTRAL") return null;
  const amount = Math.abs(toNumber(row.amount));
  const day = dateInputValue(row.transactionDate);

  return entries.find((entry) => {
    const entryAmount = Math.abs(toNumber(entry.amount));
    const dayDiff = Math.abs(new Date(dateInputValue(entry.date)).getTime() - new Date(day).getTime()) / 86400000;
    return entry.direction === row.direction && Math.abs(entryAmount - amount) < 0.01 && dayDiff <= 3;
  });
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c");
}

function periodDateOrNull(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00+03:00`) : null;
}

function mimeFromExtension(extension: string) {
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/csv";
}
