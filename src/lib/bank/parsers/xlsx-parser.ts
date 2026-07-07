import { readSheet } from "read-excel-file/node";

import { normalizeStatementRows, type NormalizedStatementTable } from "@/lib/bank/parsers/normalize-rows";

export async function parseXlsxStatementTable(input: {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  fileHash: string;
}): Promise<NormalizedStatementTable> {
  try {
    const rows = await readSheet(input.buffer);
    return normalizeStatementRows({
      sourceType: "XLSX",
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      rawRows: rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel dosyası okunamadı.";
    throw new Error(message);
  }
}
