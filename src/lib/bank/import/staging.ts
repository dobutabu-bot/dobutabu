import { buildBankStatementPreview, createBankStatementImport } from "@/lib/bank-statements";
import type { BankStatementParseOptions } from "@/lib/bank/import/types";

export async function buildStagedBankStatementPreview(userId: string, file: File, options: BankStatementParseOptions) {
  return buildBankStatementPreview(userId, file, options);
}

export async function commitStagedBankStatementImport(userId: string, file: File, options: BankStatementParseOptions) {
  return createBankStatementImport(userId, file, options);
}
