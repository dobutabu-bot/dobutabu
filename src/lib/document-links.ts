import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { documentTypeLabels } from "@/lib/document-labels";
import {
  documentLinkEntityLabels,
  documentLinkFieldByEntityType,
  documentUploadParamByEntityType,
  type DocumentLinkEntityType,
  type DocumentLinkOption,
  type LinkedDocumentItem
} from "@/lib/document-link-types";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney, formatMoney, toNumber } from "@/lib/utils";

type DocumentLinkInput = {
  userId: string;
  documentId: string;
  entityType: DocumentLinkEntityType;
  entityId: string;
};

type DocumentLinkSectionInput = {
  userId: string;
  entityType: DocumentLinkEntityType;
  entityId: string;
};

const documentLinkSelect = {
  id: true,
  title: true,
  documentType: true,
  originalFileName: true,
  fileSize: true,
  uploadedAt: true,
  documentDate: true,
  amount: true,
  currency: true,
  tags: { include: { tag: true } }
} satisfies Prisma.DocumentSelect;

type DocumentLinkRow = Prisma.DocumentGetPayload<{ select: typeof documentLinkSelect }>;

export class DocumentLinkError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "DocumentLinkError";
  }
}

export async function getDocumentLinkSectionData(input: DocumentLinkSectionInput) {
  const field = documentLinkField(input.entityType);
  await ensureOwnedTarget(input.userId, input.entityType, input.entityId);

  const [linkedDocuments, availableDocuments] = await Promise.all([
    prisma.document.findMany({
      where: { userId: input.userId, deletedAt: null, [field]: input.entityId } as Prisma.DocumentWhereInput,
      orderBy: { uploadedAt: "desc" },
      select: documentLinkSelect
    }),
    prisma.document.findMany({
      where: { userId: input.userId, deletedAt: null, NOT: { [field]: input.entityId } } as Prisma.DocumentWhereInput,
      orderBy: { uploadedAt: "desc" },
      select: documentLinkSelect,
      take: 150
    })
  ]);

  return {
    documents: linkedDocuments.map(serializeLinkedDocument),
    options: availableDocuments.map(serializeDocumentOption),
    uploadHref: documentUploadHref(input.entityType, input.entityId)
  };
}

export async function linkDocumentToEntity(input: DocumentLinkInput) {
  const field = documentLinkField(input.entityType);
  const [document, target] = await Promise.all([
    prisma.document.findFirst({
      where: { id: input.documentId, userId: input.userId, deletedAt: null }
    }),
    ensureOwnedTarget(input.userId, input.entityType, input.entityId)
  ]);

  if (!document) {
    throw new DocumentLinkError("Belge bulunamadı.", 404);
  }

  const updatedDocument = await prisma.document.update({
    where: { id: document.id },
    data: { [field]: input.entityId } as Prisma.DocumentUpdateInput
  });

  await writeDocumentLinkAudit({
    actionMessage: `${documentLinkEntityLabels[input.entityType]} bağlantısı kuruldu`,
    document,
    entityId: input.entityId,
    entityLabel: target.label,
    entityType: input.entityType,
    newDocument: updatedDocument,
    oldDocument: document,
    userId: input.userId
  });

  return updatedDocument;
}

export async function unlinkDocumentFromEntity(input: DocumentLinkInput) {
  const field = documentLinkField(input.entityType);
  const document = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      userId: input.userId,
      deletedAt: null,
      [field]: input.entityId
    } as Prisma.DocumentWhereInput
  });

  if (!document) {
    throw new DocumentLinkError("Belge bağlantısı bulunamadı.", 404);
  }

  const updatedDocument = await prisma.document.update({
    where: { id: document.id },
    data: { [field]: null } as Prisma.DocumentUpdateInput
  });

  await writeDocumentLinkAudit({
    actionMessage: `${documentLinkEntityLabels[input.entityType]} bağlantısı kaldırıldı`,
    document,
    entityId: input.entityId,
    entityLabel: documentLinkEntityLabels[input.entityType],
    entityType: input.entityType,
    newDocument: updatedDocument,
    oldDocument: document,
    userId: input.userId
  });

  return updatedDocument;
}

function documentLinkField(entityType: DocumentLinkEntityType) {
  return documentLinkFieldByEntityType[entityType];
}

function documentUploadHref(entityType: DocumentLinkEntityType, entityId: string) {
  const params = new URLSearchParams({ [documentUploadParamByEntityType[entityType]]: entityId });
  return `/documents/new?${params.toString()}`;
}

function serializeLinkedDocument(document: DocumentLinkRow): LinkedDocumentItem {
  return {
    id: document.id,
    title: document.title,
    documentTypeLabel: documentTypeLabels[document.documentType],
    fileName: document.originalFileName,
    fileSizeLabel: formatFileSize(document.fileSize),
    dateLabel: formatDate(document.documentDate ?? document.uploadedAt),
    amountLabel: document.amount ? formatMoney(document.amount, document.currency) : "-",
    tags: document.tags.map((item) => item.tag.name)
  };
}

function serializeDocumentOption(document: DocumentLinkRow): DocumentLinkOption {
  return {
    id: document.id,
    label: `${document.title} · ${documentTypeLabels[document.documentType]}`,
    meta: `${formatDate(document.documentDate ?? document.uploadedAt)} · ${document.originalFileName}`
  };
}

async function ensureOwnedTarget(userId: string, entityType: DocumentLinkEntityType, entityId: string) {
  if (entityType === "CLIENT") {
    const row = await prisma.client.findFirst({
      where: { id: entityId, userId, deletedAt: null },
      select: { id: true, name: true }
    });
    if (!row) throw new DocumentLinkError("Müvekkil bulunamadı.", 404);
    return { label: row.name };
  }

  if (entityType === "CASE_FILE") {
    const row = await prisma.caseFile.findFirst({
      where: { id: entityId, userId, deletedAt: null },
      select: { id: true, title: true, fileNumber: true }
    });
    if (!row) throw new DocumentLinkError("Dosya bulunamadı.", 404);
    return { label: `${row.title}${row.fileNumber ? ` (${row.fileNumber})` : ""}` };
  }

  if (entityType === "INCOME") {
    const row = await prisma.income.findFirst({
      where: { id: entityId, userId, deletedAt: null },
      select: { id: true, amount: true, currency: true, date: true, client: { select: { name: true } } }
    });
    if (!row) throw new DocumentLinkError("Tahsilat bulunamadı.", 404);
    return { label: `${row.client.name} · ${formatDate(row.date)} · ${formatDirectionalMoney(row.amount, "IN", row.currency)}` };
  }

  if (entityType === "EXPENSE") {
    const row = await prisma.expense.findFirst({
      where: { id: entityId, userId, deletedAt: null },
      select: { id: true, amount: true, currency: true, date: true, client: { select: { name: true } } }
    });
    if (!row) throw new DocumentLinkError("Gider bulunamadı.", 404);
    return { label: `${row.client?.name ?? "Genel gider"} · ${formatDate(row.date)} · ${formatDirectionalMoney(row.amount, "OUT", row.currency)}` };
  }

  if (entityType === "INVOICE_OR_RECEIPT") {
    const row = await prisma.invoiceOrReceipt.findFirst({
      where: { id: entityId, userId, deletedAt: null },
      select: { id: true, number: true, issueDate: true, netAmount: true, client: { select: { name: true } } }
    });
    if (!row) throw new DocumentLinkError("Makbuz/fatura kaydı bulunamadı.", 404);
    return { label: `${row.client.name} · ${row.number} · ${formatMoney(row.netAmount)}` };
  }

  const row = await prisma.cashLedgerEntry.findFirst({
    where: { id: entityId, userId, deletedAt: null },
    select: {
      id: true,
      direction: true,
      entryType: true,
      amount: true,
      currency: true,
      date: true,
      cashAccount: { select: { name: true } }
    }
  });
  if (!row) throw new DocumentLinkError("Kasa hareketi bulunamadı.", 404);
  return {
    label: `${row.cashAccount.name} · ${formatDate(row.date)} · ${formatDirectionalMoney(row.amount, row.direction, row.currency)}`
  };
}

async function writeDocumentLinkAudit(input: {
  actionMessage: string;
  document: { id: string; title: string };
  entityId: string;
  entityLabel: string;
  entityType: DocumentLinkEntityType;
  newDocument: unknown;
  oldDocument: unknown;
  userId: string;
}) {
  const targetLabel = documentLinkEntityLabels[input.entityType];

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: input.document.id,
    action: "UPDATE",
    oldValue: input.oldDocument,
    newValue: input.newDocument,
    message: `${input.actionMessage}: ${input.entityLabel}`,
    userId: input.userId
  });

  await writeAuditLog({
    entityType: input.entityType,
    entityId: input.entityId,
    action: "UPDATE",
    message: `${targetLabel} için belge bağlantısı güncellendi: ${input.document.title}`,
    userId: input.userId
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${toNumber(bytes / 1024 / 1024).toFixed(1)} MB`;
}
