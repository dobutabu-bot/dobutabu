import type {
  BankStatementDateFormat,
  BankStatementMapping,
  BankStatementParseOptions,
  ThousandSeparator
} from "@/lib/bank/import/types";

export type BankStatementImportFormPayload = {
  file: File;
  options: BankStatementParseOptions;
};

export function parseBankStatementImportForm(formData: FormData, missingFileMessage: string): BankStatementImportFormPayload {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new BankStatementImportFormError(missingFileMessage);
  }

  return {
    file,
    options: {
      bankName: valueOf(formData.get("bankName")),
      cashAccountId: nullable(valueOf(formData.get("cashAccountId"))),
      currency: valueOf(formData.get("currency")) || "TRY",
      periodStart: nullable(valueOf(formData.get("periodStart"))),
      periodEnd: nullable(valueOf(formData.get("periodEnd"))),
      mapping: parseMapping(formData),
      dateFormat: parseDateFormat(valueOf(formData.get("dateFormat"))),
      decimalSeparator: valueOf(formData.get("decimalSeparator")) === "." ? "." : ",",
      thousandSeparator: parseThousandSeparator(valueOf(formData.get("thousandSeparator"))),
      delimiter: parseDelimiter(valueOf(formData.get("delimiter"))),
      maxRecordSize: parseMaxRecordSize(valueOf(formData.get("maxRecordSize"))),
      skipRecordsWithError: valueOf(formData.get("skipRecordsWithError")) !== "false"
    }
  };
}

function valueOf(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value || null;
}

function parseMapping(formData: FormData): BankStatementMapping {
  return {
    date: nullable(valueOf(formData.get("mapDate"))) ?? undefined,
    description: nullable(valueOf(formData.get("mapDescription"))) ?? undefined,
    debit: nullable(valueOf(formData.get("mapDebit"))) ?? undefined,
    credit: nullable(valueOf(formData.get("mapCredit"))) ?? undefined,
    balance: nullable(valueOf(formData.get("mapBalance"))) ?? undefined,
    currency: nullable(valueOf(formData.get("mapCurrency"))) ?? undefined
  };
}

function parseDateFormat(value: string): BankStatementDateFormat {
  if (value === "DD.MM.YYYY" || value === "YYYY-MM-DD" || value === "MM/DD/YYYY") {
    return value;
  }

  return "auto";
}

function parseThousandSeparator(value: string): ThousandSeparator {
  if (value === "," || value === "space" || value === "none") {
    return value;
  }

  return ".";
}

function parseDelimiter(value: string) {
  if (!value || value === "auto") return "auto";
  if (value === "tab") return "\t";
  if ([",", ";", "|"].includes(value)) return value;
  return "auto";
}

function parseMaxRecordSize(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1024 ? Math.min(parsed, 1024 * 1024 * 5) : undefined;
}

export class BankStatementImportFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankStatementImportFormError";
  }
}
