import type { AuditEntityType } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type SoftDeleteRecord = {
  id: string;
  deletedAt: Date | null;
};

type SoftDeleteInput<TRecord extends SoftDeleteRecord> = {
  userId: string;
  entityType: AuditEntityType;
  findExisting: () => Promise<TRecord | null>;
  markDeleted: (deletedAt: Date) => Promise<TRecord>;
  message: string;
};

type RestoreInput<TRecord extends SoftDeleteRecord> = {
  userId: string;
  entityType: AuditEntityType;
  findExisting: () => Promise<TRecord | null>;
  markRestored: () => Promise<TRecord>;
  message: string;
};

export type V3SoftDeleteModel =
  | "document"
  | "documentProcessingLog"
  | "bankStatementImport"
  | "bankStatementRow"
  | "transactionCategory"
  | "transactionRule"
  | "assetAccount"
  | "assetValuation"
  | "assetTransaction"
  | "capitalSnapshot";

export async function softDeleteWithAudit<TRecord extends SoftDeleteRecord>({
  userId,
  entityType,
  findExisting,
  markDeleted,
  message
}: SoftDeleteInput<TRecord>) {
  const existing = await findExisting();

  if (!existing) {
    return null;
  }

  const deletedAt = new Date();
  const deleted = await markDeleted(deletedAt);

  await writeAuditLog({
    entityType,
    entityId: deleted.id,
    action: "DELETE",
    oldValue: existing,
    newValue: deleted,
    message,
    userId
  });

  return deleted;
}

export async function restoreWithAudit<TRecord extends SoftDeleteRecord>({
  userId,
  entityType,
  findExisting,
  markRestored,
  message
}: RestoreInput<TRecord>) {
  const existing = await findExisting();

  if (!existing) {
    return null;
  }

  const restored = await markRestored();

  await writeAuditLog({
    entityType,
    entityId: restored.id,
    action: "RESTORE",
    oldValue: existing,
    newValue: restored,
    message,
    userId
  });

  return restored;
}

export async function softDeleteV3Record(userId: string, model: V3SoftDeleteModel, id: string) {
  switch (model) {
    case "document":
      return softDeleteWithAudit({
        userId,
        entityType: "DOCUMENT",
        findExisting: () => prisma.document.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.document.update({ where: { id }, data: { deletedAt } }),
        message: "Belge kaydı silindi"
      });
    case "documentProcessingLog":
      return softDeleteWithAudit({
        userId,
        entityType: "DOCUMENT",
        findExisting: () => prisma.documentProcessingLog.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.documentProcessingLog.update({ where: { id }, data: { deletedAt } }),
        message: "Belge işleme logu silindi"
      });
    case "bankStatementImport":
      return softDeleteWithAudit({
        userId,
        entityType: "BANK_STATEMENT_IMPORT",
        findExisting: () => prisma.bankStatementImport.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.bankStatementImport.update({ where: { id }, data: { deletedAt } }),
        message: "Banka ekstresi import kaydı silindi"
      });
    case "bankStatementRow":
      return softDeleteWithAudit({
        userId,
        entityType: "BANK_STATEMENT_ROW",
        findExisting: () => prisma.bankStatementRow.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.bankStatementRow.update({ where: { id }, data: { deletedAt } }),
        message: "Banka ekstresi satırı silindi"
      });
    case "transactionCategory":
      return softDeleteWithAudit({
        userId,
        entityType: "TRANSACTION_CATEGORY",
        findExisting: () => prisma.transactionCategory.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.transactionCategory.update({ where: { id }, data: { deletedAt, isActive: false } }),
        message: "İşlem kategorisi silindi"
      });
    case "transactionRule":
      return softDeleteWithAudit({
        userId,
        entityType: "TRANSACTION_RULE",
        findExisting: () => prisma.transactionRule.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.transactionRule.update({ where: { id }, data: { deletedAt, isActive: false } }),
        message: "Akıllı sınıflandırma kuralı silindi"
      });
    case "assetAccount":
      return softDeleteWithAudit({
        userId,
        entityType: "ASSET_ACCOUNT",
        findExisting: () => prisma.assetAccount.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.assetAccount.update({ where: { id }, data: { deletedAt, isActive: false } }),
        message: "Varlık hesabı silindi"
      });
    case "assetValuation":
      return softDeleteWithAudit({
        userId,
        entityType: "ASSET_VALUATION",
        findExisting: () => prisma.assetValuation.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.assetValuation.update({ where: { id }, data: { deletedAt } }),
        message: "Varlık değerleme kaydı silindi"
      });
    case "assetTransaction":
      return softDeleteWithAudit({
        userId,
        entityType: "ASSET_TRANSACTION",
        findExisting: () => prisma.assetTransaction.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.assetTransaction.update({ where: { id }, data: { deletedAt } }),
        message: "Varlık hareketi silindi"
      });
    case "capitalSnapshot":
      return softDeleteWithAudit({
        userId,
        entityType: "CAPITAL_SNAPSHOT",
        findExisting: () => prisma.capitalSnapshot.findFirst({ where: { id, userId, deletedAt: null } }),
        markDeleted: (deletedAt) => prisma.capitalSnapshot.update({ where: { id }, data: { deletedAt } }),
        message: "Sermaye anlık görüntüsü silindi"
      });
  }
}

export async function restoreV3Record(userId: string, model: V3SoftDeleteModel, id: string) {
  switch (model) {
    case "document":
      return restoreWithAudit({
        userId,
        entityType: "DOCUMENT",
        findExisting: () => prisma.document.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.document.update({ where: { id }, data: { deletedAt: null } }),
        message: "Belge kaydı geri alındı"
      });
    case "documentProcessingLog":
      return restoreWithAudit({
        userId,
        entityType: "DOCUMENT",
        findExisting: () => prisma.documentProcessingLog.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.documentProcessingLog.update({ where: { id }, data: { deletedAt: null } }),
        message: "Belge işleme logu geri alındı"
      });
    case "bankStatementImport":
      return restoreWithAudit({
        userId,
        entityType: "BANK_STATEMENT_IMPORT",
        findExisting: () => prisma.bankStatementImport.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.bankStatementImport.update({ where: { id }, data: { deletedAt: null } }),
        message: "Banka ekstresi import kaydı geri alındı"
      });
    case "bankStatementRow":
      return restoreWithAudit({
        userId,
        entityType: "BANK_STATEMENT_ROW",
        findExisting: () => prisma.bankStatementRow.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.bankStatementRow.update({ where: { id }, data: { deletedAt: null } }),
        message: "Banka ekstresi satırı geri alındı"
      });
    case "transactionCategory":
      return restoreWithAudit({
        userId,
        entityType: "TRANSACTION_CATEGORY",
        findExisting: () => prisma.transactionCategory.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.transactionCategory.update({ where: { id }, data: { deletedAt: null, isActive: true } }),
        message: "İşlem kategorisi geri alındı"
      });
    case "transactionRule":
      return restoreWithAudit({
        userId,
        entityType: "TRANSACTION_RULE",
        findExisting: () => prisma.transactionRule.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.transactionRule.update({ where: { id }, data: { deletedAt: null, isActive: true } }),
        message: "Akıllı sınıflandırma kuralı geri alındı"
      });
    case "assetAccount":
      return restoreWithAudit({
        userId,
        entityType: "ASSET_ACCOUNT",
        findExisting: () => prisma.assetAccount.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.assetAccount.update({ where: { id }, data: { deletedAt: null, isActive: true } }),
        message: "Varlık hesabı geri alındı"
      });
    case "assetValuation":
      return restoreWithAudit({
        userId,
        entityType: "ASSET_VALUATION",
        findExisting: () => prisma.assetValuation.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.assetValuation.update({ where: { id }, data: { deletedAt: null } }),
        message: "Varlık değerleme kaydı geri alındı"
      });
    case "assetTransaction":
      return restoreWithAudit({
        userId,
        entityType: "ASSET_TRANSACTION",
        findExisting: () => prisma.assetTransaction.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.assetTransaction.update({ where: { id }, data: { deletedAt: null } }),
        message: "Varlık hareketi geri alındı"
      });
    case "capitalSnapshot":
      return restoreWithAudit({
        userId,
        entityType: "CAPITAL_SNAPSHOT",
        findExisting: () => prisma.capitalSnapshot.findFirst({ where: { id, userId, deletedAt: { not: null } } }),
        markRestored: () => prisma.capitalSnapshot.update({ where: { id }, data: { deletedAt: null } }),
        message: "Sermaye anlık görüntüsü geri alındı"
      });
  }
}
