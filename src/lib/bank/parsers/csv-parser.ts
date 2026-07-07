import { parse as parseCsvSync } from "csv-parse/sync";

import type { BankStatementParseOptions } from "@/lib/bank-statements";
import { normalizeStatementRows, type NormalizedStatementTable, type ParserIssue } from "@/lib/bank/parsers/normalize-rows";

export type CsvParserOptions = Pick<BankStatementParseOptions, "delimiter" | "maxRecordSize" | "skipRecordsWithError">;

const delimiterCandidates = [",", ";", "\t", "|"];
const defaultMaxRecordSize = 1024 * 1024;

export function parseCsvStatementTable(input: {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  fileHash: string;
  options?: CsvParserOptions;
}): NormalizedStatementTable {
  const issues: ParserIssue[] = [];
  const text = input.buffer.toString("utf8");
  const delimiter = normalizeDelimiter(input.options?.delimiter, text);
  const maxRecordSize = input.options?.maxRecordSize ?? defaultMaxRecordSize;

  try {
    const rows = parseCsvSync(text, {
      bom: true,
      delimiter,
      max_record_size: maxRecordSize,
      relax_column_count: true,
      skip_empty_lines: true,
      skip_records_with_error: input.options?.skipRecordsWithError ?? true,
      trim: true,
      on_skip: (error, raw) => {
        if (!error) return undefined;
        const csvError = error as Error & { lines?: number };
        issues.push({
          rowNumber: csvError.lines ?? null,
          message: error.message,
          raw: raw ?? null,
          severity: "ERROR"
        });
        return undefined;
      }
    }) as unknown[][];

    return normalizeStatementRows({
      sourceType: "CSV",
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      rawRows: rows,
      parseIssues: issues
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV dosyası okunamadı.";
    return normalizeStatementRows({
      sourceType: "CSV",
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      rawRows: [["Ham Satır", "Hata"], [input.buffer.toString("utf8").slice(0, maxRecordSize), message]],
      parseIssues: [{ rowNumber: null, message, raw: null, severity: "ERROR" }],
      warning: "CSV dosyası toleranslı parser ile okunurken hatalı satırlar ERROR olarak işaretlendi."
    });
  }
}

function normalizeDelimiter(delimiter: CsvParserOptions["delimiter"], text: string) {
  if (!delimiter || delimiter === "auto") {
    return detectDelimiter(text);
  }

  return delimiter;
}

function detectDelimiter(text: string) {
  const sampleLines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (sampleLines.length === 0) return ",";

  const [bestDelimiter] = delimiterCandidates
    .map((candidate) => ({
      candidate,
      score: sampleLines.reduce((total, line) => total + countDelimiterOutsideQuotes(line, candidate), 0)
    }))
    .sort((a, b) => b.score - a.score);

  return bestDelimiter.score > 0 ? bestDelimiter.candidate : ",";
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }

  return count;
}
