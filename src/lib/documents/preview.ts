import { readSheet } from "read-excel-file/node";

import { readPrivateDocumentFile } from "@/lib/document-storage";

export type TabularDocumentPreview = {
  rows: string[][];
  truncated: boolean;
  kind: "csv" | "xlsx";
};

export async function getTabularDocumentPreview(input: {
  storagePath: string;
  mimeType: string;
  originalFileName: string;
}): Promise<TabularDocumentPreview | null> {
  if (isCsvFile(input.mimeType, input.originalFileName)) {
    return getCsvPreview(input.storagePath);
  }

  if (isXlsxFile(input.mimeType, input.originalFileName)) {
    return getXlsxPreview(input.storagePath);
  }

  return null;
}

export function isCsvFile(mimeType: string, fileName: string) {
  return mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");
}

export function isSpreadsheetFile(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls")
  );
}

export function isXlsxFile(mimeType: string, fileName: string) {
  return mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || fileName.toLowerCase().endsWith(".xlsx");
}

async function getCsvPreview(storagePath: string): Promise<TabularDocumentPreview | null> {
  try {
    const buffer = await readPrivateDocumentFile(storagePath);
    const lines = buffer
      .toString("utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const rows = lines.slice(0, 20).map((line) => parseCsvLine(line).slice(0, 12));

    return { rows, truncated: lines.length > 20, kind: "csv" };
  } catch {
    return null;
  }
}

async function getXlsxPreview(storagePath: string): Promise<TabularDocumentPreview | null> {
  try {
    const buffer = await readPrivateDocumentFile(storagePath);
    const rows = await readSheet(buffer);
    return {
      rows: rows.slice(0, 20).map((row) => row.slice(0, 12).map(formatCell)),
      truncated: rows.length > 20,
      kind: "xlsx"
    };
  } catch {
    return null;
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function formatCell(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
