import { createHash } from "node:crypto";

import { Prisma, type BankStatementSourceType } from "@prisma/client";

import { dateInputValue } from "@/lib/utils";
import type {
  BankStatementColumnKey,
  BankStatementDateFormat,
  BankStatementMapping,
  BankStatementParseOptions
} from "@/lib/bank-statements";

export const parseErrorColumn = "__parseError";
export const parseWarningColumn = "__parseWarning";
export const rawRowColumn = "__rawRow";
export const sourceRowNumberColumn = "__sourceRowNumber";

export type ParserIssueSeverity = "WARNING" | "ERROR";

export type ParserIssue = {
  rowNumber: number | null;
  message: string;
  raw: string | string[] | null;
  severity: ParserIssueSeverity;
};

export type NormalizedStatementTable = {
  sourceType: BankStatementSourceType;
  fileName: string;
  fileSize: number;
  fileHash: string;
  columns: string[];
  records: Record<string, string>[];
  parseIssues: ParserIssue[];
  warning?: string;
  columnsFingerprint: string;
};

export type NormalizeRowsInput = {
  sourceType: BankStatementSourceType;
  fileName: string;
  fileSize: number;
  fileHash: string;
  rawRows: unknown[][];
  parseIssues?: ParserIssue[];
  warning?: string;
};

const parserMetaColumns = [sourceRowNumberColumn, rawRowColumn, parseWarningColumn, parseErrorColumn];

export function normalizeStatementRows(input: NormalizeRowsInput): NormalizedStatementTable {
  const normalizedRows = input.rawRows
    .map((row) => row.map((cell) => normalizeCell(cell)))
    .filter((row) => row.some(Boolean));
  const headerIndex = findHeaderIndex(normalizedRows);
  const headers = normalizedRows[headerIndex]?.map((cell, index) => cell || `Kolon ${index + 1}`) ?? [];
  const columns = uniqueHeaders(headers);
  const dataRows = normalizedRows.slice(headerIndex + 1).map((row, index) => rowToRecord(columns, row, headerIndex + index + 2));
  const issueRows = issueRowsToRecords(columns, input.parseIssues ?? []);
  const records = [...dataRows, ...issueRows];

  return {
    sourceType: input.sourceType,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    columns,
    records,
    parseIssues: input.parseIssues ?? [],
    warning: input.warning,
    columnsFingerprint: createColumnsFingerprint(columns)
  };
}

export function detectStatementColumns(columns: string[]): BankStatementMapping {
  return {
    date: findColumn(columns, ["tarih", "date", "işlem tarihi", "islem tarihi", "valör", "valor"]),
    description: findColumn(columns, ["açıklama", "aciklama", "description", "işlem", "islem", "detay"]),
    debit: findColumn(columns, ["borç", "borc", "çıkış", "cikis", "debit", "withdrawal", "eksi"]),
    credit: findColumn(columns, ["alacak", "giriş", "giris", "credit", "deposit", "artı", "arti"]),
    balance: findColumn(columns, ["bakiye", "balance", "kalan"]),
    currency: findColumn(columns, ["para birimi", "döviz", "doviz", "currency"])
  };
}

export function normalizeStatementMapping(mapping: BankStatementMapping | undefined, base: BankStatementMapping): BankStatementMapping {
  const next = { ...base };

  for (const key of ["date", "description", "debit", "credit", "balance", "currency"] as BankStatementColumnKey[]) {
    if (mapping?.[key]) {
      next[key] = mapping[key];
    }
  }

  return next;
}

export function parseStatementDate(value: string, format: BankStatementDateFormat) {
  const clean = value.trim();
  if (!clean) return null;

  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const trMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  const usMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if ((format === "YYYY-MM-DD" || format === "auto") && isoMatch) {
    return safeDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  if ((format === "DD.MM.YYYY" || format === "auto") && trMatch) {
    return safeDate(normalizeYear(trMatch[3]), Number(trMatch[2]), Number(trMatch[1]));
  }

  if (format === "MM/DD/YYYY" && usMatch) {
    return safeDate(normalizeYear(usMatch[3]), Number(usMatch[1]), Number(usMatch[2]));
  }

  const fallback = new Date(clean);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseStatementDecimal(value: string, options: Pick<BankStatementParseOptions, "decimalSeparator" | "thousandSeparator">) {
  const clean = value.trim();
  if (!clean) return null;
  const decimalSeparator = options.decimalSeparator ?? ",";
  const thousandSeparator = options.thousandSeparator ?? ".";
  let normalized = clean.replace(/[₺$€£]/g, "").trim();

  if (thousandSeparator === "space") {
    normalized = normalized.replace(/\s/g, "");
  } else if (thousandSeparator !== "none") {
    normalized = normalized.split(thousandSeparator).join("");
  }

  if (decimalSeparator === ",") {
    normalized = normalized.replace(",", ".");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "-" || normalized === ".") return null;

  try {
    const decimal = new Prisma.Decimal(normalized);
    return decimal.isNaN() ? null : decimal.abs();
  } catch {
    return null;
  }
}

export function createStatementRowHash(input: {
  transactionDate: Date | null;
  rawDescription: string;
  debitAmount: Prisma.Decimal | null;
  creditAmount: Prisma.Decimal | null;
  balance: Prisma.Decimal | null;
  currency: string;
  rawData: Record<string, string>;
}) {
  return createHash("sha256")
    .update(
      [
        input.transactionDate ? dateInputValue(input.transactionDate) : "",
        normalizeText(input.rawDescription),
        input.debitAmount?.toString() ?? "",
        input.creditAmount?.toString() ?? "",
        input.balance?.toString() ?? "",
        input.currency,
        normalizeText(input.rawData[rawRowColumn] ?? "")
      ].join("|")
    )
    .digest("hex");
}

export function createColumnsFingerprint(columns: string[]) {
  return createHash("sha256").update(columns.map(normalizeText).join("|")).digest("hex");
}

function findHeaderIndex(rows: string[][]) {
  const index = rows.findIndex((row) => {
    const normalized = normalizeText(row.join(" "));
    return ["tarih", "aciklama", "borc", "alacak", "bakiye", "date", "debit", "credit"].some((keyword) => normalized.includes(keyword));
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

function rowToRecord(columns: string[], row: string[], sourceRowNumber: number) {
  const record = columns.reduce<Record<string, string>>((next, column, index) => {
    next[column] = row[index] ?? "";
    return next;
  }, {});

  if (row.length < columns.length) {
    record[parseWarningColumn] = `Eksik kolon: ${columns.length - row.length} alan boş geldi.`;
  }

  if (row.length > columns.length) {
    const extraCells = row.slice(columns.length);
    record[parseWarningColumn] = `Fazla kolon: ${extraCells.length} ek alan raw satırda saklandı.`;
    extraCells.forEach((cell, index) => {
      record[`Ek Kolon ${index + 1}`] = cell;
    });
  }

  record[sourceRowNumberColumn] = String(sourceRowNumber);
  record[rawRowColumn] = JSON.stringify(row);
  return record;
}

function issueRowsToRecords(columns: string[], issues: ParserIssue[]) {
  return issues
    .filter((issue) => issue.severity === "ERROR")
    .map((issue, index) => {
      const record: Record<string, string> = {};
      const fallbackColumn = columns[0] ?? "Ham Satır";
      record[fallbackColumn] = Array.isArray(issue.raw) ? issue.raw.join(" ") : issue.raw ?? "";
      record[parseErrorColumn] = issue.message;
      record[sourceRowNumberColumn] = issue.rowNumber ? String(issue.rowNumber) : `parser-${index + 1}`;
      record[rawRowColumn] = Array.isArray(issue.raw) ? JSON.stringify(issue.raw) : issue.raw ?? "";
      return record;
    });
}

function normalizeCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return dateInputValue(value);
  return String(value).trim();
}

function findColumn(columns: string[], keywords: string[]) {
  return columns.find((column) => {
    const normalized = normalizeText(column);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
  });
}

function safeDate(year: number, month: number, day: number) {
  if (!year || !month || !day || month > 12 || day > 31) return null;
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+03:00`);
}

function normalizeYear(value: string) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
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

export function stripParserMetaColumns(columns: string[]) {
  return columns.filter((column) => !parserMetaColumns.includes(column));
}
