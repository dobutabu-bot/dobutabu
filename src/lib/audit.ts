import { Prisma, type AuditAction, type AuditEntityType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type WriteAuditLogInput = {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  message?: string;
  userId?: string | null;
};

export const auditEntityLabels: Record<AuditEntityType, string> = {
  CLIENT: "Müvekkil",
  CASE_FILE: "Dosya",
  INCOME: "Tahsilat",
  EXPENSE: "Gider",
  INVOICE_OR_RECEIPT: "Makbuz/Fatura",
  TASK_REMINDER: "Hatırlatma",
  SETTING: "Ayar",
  CASH_ACCOUNT: "Kasa hesabı",
  CASH_LEDGER_ENTRY: "Kasa hareketi",
  CASH_TRANSFER: "Kasa transferi",
  BALANCE_SNAPSHOT: "Bakiye anlık görüntüsü",
  ASSET_ACCOUNT: "Varlık hesabı",
  ASSET_VALUATION: "Varlık değerlemesi",
  ASSET_TRANSACTION: "Varlık hareketi",
  CAPITAL_SNAPSHOT: "Sermaye anlık görüntüsü",
  CAPITAL_IMPORT: "Sermaye import",
  CAPITAL_IMPORT_SUGGESTION: "Sermaye import önerisi",
  DOCUMENT: "Belge",
  BANK_STATEMENT_IMPORT: "Banka ekstresi import",
  BANK_STATEMENT_ROW: "Banka ekstresi satırı",
  TRANSACTION_CATEGORY: "İşlem kategorisi",
  TRANSACTION_RULE: "Banka işlem kuralı"
};

export const auditActionLabels: Record<AuditAction, string> = {
  CREATE: "Oluşturma",
  UPDATE: "Güncelleme",
  DELETE: "Silme",
  RESTORE: "Geri alma",
  ARCHIVE: "Arşivleme",
  CANCEL: "İptal",
  VALUE_UPDATE: "Değer güncelleme"
};

export async function writeAuditLog(input: WriteAuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: toAuditJson(input.oldValue),
        newValue: toAuditJson(input.newValue),
        message: input.message,
        userId: input.userId ?? null
      }
    });
  } catch (error) {
    console.error("Audit log yazılamadı", error);
  }
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return normalizeJson(value) as Prisma.InputJsonValue;
}

function normalizeJson(value: unknown): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && "toString" in value && value.constructor?.name === "Decimal") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeJson(item)])
    );
  }

  return String(value);
}
