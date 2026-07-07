import { Prisma, type BankStatementSourceType } from "@prisma/client";

import type { BankStatementMapping, BankStatementParseOptions } from "@/lib/bank/import/types";
import { prisma } from "@/lib/prisma";

export type BankImportMappingSuggestion = {
  id: string;
  mapping: BankStatementMapping;
  dateFormat: string | null;
  decimalSeparator: string | null;
  thousandSeparator: string | null;
  source: "EXACT" | "BANK";
};

export async function getBankImportMappingSuggestion(input: {
  userId: string;
  bankName: string;
  sourceType: BankStatementSourceType;
  columnsFingerprint: string;
}): Promise<BankImportMappingSuggestion | null> {
  const bankNameKey = normalizeBankNameKey(input.bankName);
  if (!bankNameKey) return null;

  const exact = await prisma.bankImportMapping.findFirst({
    where: {
      userId: input.userId,
      bankNameKey,
      sourceType: input.sourceType,
      columnsFingerprint: input.columnsFingerprint,
      isActive: true,
      deletedAt: null
    },
    orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }]
  });

  if (exact) return serializeMapping(exact, "EXACT");

  const bankLevel = await prisma.bankImportMapping.findFirst({
    where: {
      userId: input.userId,
      bankNameKey,
      sourceType: input.sourceType,
      isActive: true,
      deletedAt: null
    },
    orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }, { updatedAt: "desc" }]
  });

  return bankLevel ? serializeMapping(bankLevel, "BANK") : null;
}

export async function rememberBankImportMapping(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    bankName: string;
    sourceType: BankStatementSourceType;
    columnsFingerprint: string;
    detectedColumns: BankStatementMapping;
    columnMapping: BankStatementMapping;
    options: Pick<BankStatementParseOptions, "dateFormat" | "decimalSeparator" | "thousandSeparator">;
  }
) {
  const bankName = input.bankName.trim();
  const bankNameKey = normalizeBankNameKey(bankName);
  if (!bankNameKey || !hasMapping(input.columnMapping)) return;

  await tx.bankImportMapping.upsert({
    where: {
      userId_bankNameKey_sourceType_columnsFingerprint: {
        userId: input.userId,
        bankNameKey,
        sourceType: input.sourceType,
        columnsFingerprint: input.columnsFingerprint
      }
    },
    create: {
      userId: input.userId,
      bankName,
      bankNameKey,
      sourceType: input.sourceType,
      columnsFingerprint: input.columnsFingerprint,
      detectedColumns: toJsonMapping(input.detectedColumns),
      columnMapping: toJsonMapping(input.columnMapping),
      dateFormat: input.options.dateFormat ?? "auto",
      decimalSeparator: input.options.decimalSeparator ?? ",",
      thousandSeparator: input.options.thousandSeparator ?? ".",
      usageCount: 1,
      lastUsedAt: new Date()
    },
    update: {
      bankName,
      detectedColumns: toJsonMapping(input.detectedColumns),
      columnMapping: toJsonMapping(input.columnMapping),
      dateFormat: input.options.dateFormat ?? "auto",
      decimalSeparator: input.options.decimalSeparator ?? ",",
      thousandSeparator: input.options.thousandSeparator ?? ".",
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
      isActive: true,
      deletedAt: null
    }
  });
}

export function normalizeBankNameKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/\s+/g, " ");
}

function serializeMapping(
  mapping: {
    id: string;
    columnMapping: Prisma.JsonValue;
    dateFormat: string | null;
    decimalSeparator: string | null;
    thousandSeparator: string | null;
  },
  source: BankImportMappingSuggestion["source"]
): BankImportMappingSuggestion {
  return {
    id: mapping.id,
    mapping: fromJsonMapping(mapping.columnMapping),
    dateFormat: mapping.dateFormat,
    decimalSeparator: mapping.decimalSeparator,
    thousandSeparator: mapping.thousandSeparator,
    source
  };
}

function hasMapping(mapping: BankStatementMapping) {
  return Object.values(mapping).some(Boolean);
}

function toJsonMapping(mapping: BankStatementMapping): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(mapping).filter(([, value]) => Boolean(value))) as Prisma.InputJsonObject;
}

function fromJsonMapping(value: Prisma.JsonValue): BankStatementMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
  ) as BankStatementMapping;
}
