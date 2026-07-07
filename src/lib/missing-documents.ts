import type { DocumentLinkEntityType, DocumentLinkOption } from "@/lib/document-link-types";
import { writeAuditLog } from "@/lib/audit";
import { documentTypeLabels } from "@/lib/document-labels";
import { expenseCategoryLabels, incomeCategoryLabels, receiptStatusLabels, receiptTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney, formatMoney, toNumber } from "@/lib/utils";

export type MissingDocumentRecord = {
  id: string;
  entityType: Extract<DocumentLinkEntityType, "INCOME" | "EXPENSE" | "INVOICE_OR_RECEIPT" | "CASH_LEDGER_ENTRY">;
  typeLabel: string;
  date: string;
  amount: number;
  amountLabel: string;
  client: string;
  caseFile: string;
  description: string;
  uploadHref: string;
  detailHref: string;
};

export type UnlinkedFinancialDocument = {
  id: string;
  title: string;
  documentTypeLabel: string;
  date: string;
  amountLabel: string;
  client: string;
  caseFile: string;
  description: string;
  detailHref: string;
};

export type MissingDocumentsData = {
  records: MissingDocumentRecord[];
  unlinkedFinancialDocuments: UnlinkedFinancialDocument[];
  documentOptions: DocumentLinkOption[];
  summary: {
    missingIncomes: number;
    missingExpenses: number;
    missingCashLedgerEntries: number;
    missingInvoiceOrReceipts: number;
    documentsWithoutFinancialRecord: number;
    totalMissingRecords: number;
  };
};

export async function getMissingDocumentsData(userId: string): Promise<MissingDocumentsData> {
  const [incomes, expenses, cashLedgerEntries, invoiceOrReceipts, documentsWithoutFinancialRecord, documentOptions] = await Promise.all([
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } },
        client: { deletedAt: null, archivedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }]
      },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: 300
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } },
        AND: [
          { OR: [{ clientId: null }, { client: { deletedAt: null, archivedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }] }
        ]
      },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: 300
    }),
    prisma.cashLedgerEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        entryType: { not: "OPENING_BALANCE" },
        attachedDocuments: { none: { deletedAt: null } },
        income: { is: null },
        expense: { is: null },
        cashAccount: { deletedAt: null },
        OR: [{ clientId: null }, { client: { deletedAt: null, archivedAt: null } }],
        AND: [{ OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }] }]
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        cashAccount: { select: { name: true } },
        client: { select: { name: true } },
        caseFile: { select: { title: true, fileNumber: true } }
      },
      take: 300
    }),
    prisma.invoiceOrReceipt.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } },
        client: { deletedAt: null, archivedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }]
      },
      orderBy: { issueDate: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: 300
    }),
    prisma.document.findMany({
      where: {
        userId,
        deletedAt: null,
        linkedIncomeId: null,
        linkedExpenseId: null,
        linkedInvoiceOrReceiptId: null,
        linkedCashLedgerEntryId: null
      },
      orderBy: { uploadedAt: "desc" },
      include: {
        linkedClient: { select: { name: true } },
        linkedCaseFile: { select: { title: true, fileNumber: true } }
      },
      take: 200
    }),
    prisma.document.findMany({
      where: { userId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        documentType: true,
        originalFileName: true,
        uploadedAt: true,
        documentDate: true
      },
      take: 200
    })
  ]);

  const missingIncomeRecords = incomes.map((row): MissingDocumentRecord => ({
    id: row.id,
    entityType: "INCOME",
    typeLabel: "Belgesiz tahsilat",
    date: formatDate(row.date),
    amount: toNumber(row.amount),
    amountLabel: formatDirectionalMoney(row.amount, "IN", row.currency),
    client: row.client.name,
    caseFile: caseLabel(row.caseFile),
    description: row.description || incomeCategoryLabels[row.category],
    uploadHref: `/documents/new?linkedIncomeId=${row.id}`,
    detailHref: `/collections/${row.id}`
  }));
  const missingExpenseRecords = expenses.map((row): MissingDocumentRecord => ({
    id: row.id,
    entityType: "EXPENSE",
    typeLabel: "Belgesiz gider",
    date: formatDate(row.date),
    amount: -toNumber(row.amount),
    amountLabel: formatDirectionalMoney(row.amount, "OUT", row.currency),
    client: row.client?.name ?? "Genel gider",
    caseFile: caseLabel(row.caseFile),
    description: row.description || expenseCategoryLabels[row.category],
    uploadHref: `/documents/new?linkedExpenseId=${row.id}`,
    detailHref: `/expenses/${row.id}`
  }));
  const missingLedgerRecords = cashLedgerEntries.map((row): MissingDocumentRecord => ({
    id: row.id,
    entityType: "CASH_LEDGER_ENTRY",
    typeLabel: "Belgesiz kasa hareketi",
    date: formatDate(row.date),
    amount: row.direction === "OUT" ? -toNumber(row.amount) : toNumber(row.amount),
    amountLabel: formatDirectionalMoney(row.amount, row.direction, row.currency),
    client: row.client?.name ?? row.cashAccount.name,
    caseFile: caseLabel(row.caseFile),
    description: row.description || `${row.cashAccount.name} kasa hareketi`,
    uploadHref: `/documents/new?linkedCashLedgerEntryId=${row.id}`,
    detailHref: `/cash/ledger/${row.id}`
  }));
  const missingReceiptRecords = invoiceOrReceipts.map((row): MissingDocumentRecord => ({
    id: row.id,
    entityType: "INVOICE_OR_RECEIPT",
    typeLabel: "Belgesiz makbuz/fatura",
    date: formatDate(row.issueDate),
    amount: toNumber(row.netAmount),
    amountLabel: formatMoney(row.netAmount),
    client: row.client.name,
    caseFile: caseLabel(row.caseFile),
    description: `${receiptTypeLabels[row.type]} ${row.number} · ${receiptStatusLabels[row.status]}`,
    uploadHref: `/documents/new?linkedInvoiceOrReceiptId=${row.id}`,
    detailHref: `/receipts/${row.id}`
  }));
  const records = [
    ...missingIncomeRecords,
    ...missingExpenseRecords,
    ...missingLedgerRecords,
    ...missingReceiptRecords
  ].sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));

  return {
    records,
    unlinkedFinancialDocuments: documentsWithoutFinancialRecord.map((row) => ({
      id: row.id,
      title: row.title,
      documentTypeLabel: documentTypeLabels[row.documentType],
      date: formatDate(row.documentDate ?? row.uploadedAt),
      amountLabel: row.amount ? formatMoney(row.amount, row.currency) : "-",
      client: row.linkedClient?.name ?? "-",
      caseFile: caseLabel(row.linkedCaseFile),
      description: row.description || row.originalFileName,
      detailHref: `/documents/${row.id}`
    })),
    documentOptions: documentOptions.map((document) => ({
      id: document.id,
      label: `${document.title} · ${documentTypeLabels[document.documentType]}`,
      meta: `${formatDate(document.documentDate ?? document.uploadedAt)} · ${document.originalFileName}`
    })),
    summary: {
      missingIncomes: missingIncomeRecords.length,
      missingExpenses: missingExpenseRecords.length,
      missingCashLedgerEntries: missingLedgerRecords.length,
      missingInvoiceOrReceipts: missingReceiptRecords.length,
      documentsWithoutFinancialRecord: documentsWithoutFinancialRecord.length,
      totalMissingRecords: records.length
    }
  };
}

export class DocumentRequirementError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "DocumentRequirementError";
  }
}

export async function markDocumentNotRequired({
  userId,
  entityType,
  entityId
}: {
  userId: string;
  entityType: MissingDocumentRecord["entityType"];
  entityId: string;
}) {
  if (entityType === "INCOME") {
    const existing = await prisma.income.findFirst({ where: { id: entityId, userId, deletedAt: null } });
    if (!existing) throw new DocumentRequirementError("Tahsilat kaydı bulunamadı.", 404);
    const updated = await prisma.income.update({ where: { id: existing.id }, data: { documentNotRequired: true } });
    await writeAuditLog({
      entityType: "INCOME",
      entityId,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Tahsilat için belge gerekmiyor olarak işaretlendi",
      userId
    });
    return updated;
  }

  if (entityType === "EXPENSE") {
    const existing = await prisma.expense.findFirst({ where: { id: entityId, userId, deletedAt: null } });
    if (!existing) throw new DocumentRequirementError("Gider kaydı bulunamadı.", 404);
    const updated = await prisma.expense.update({ where: { id: existing.id }, data: { documentNotRequired: true } });
    await writeAuditLog({
      entityType: "EXPENSE",
      entityId,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Gider için belge gerekmiyor olarak işaretlendi",
      userId
    });
    return updated;
  }

  if (entityType === "INVOICE_OR_RECEIPT") {
    const existing = await prisma.invoiceOrReceipt.findFirst({ where: { id: entityId, userId, deletedAt: null } });
    if (!existing) throw new DocumentRequirementError("Makbuz/fatura kaydı bulunamadı.", 404);
    const updated = await prisma.invoiceOrReceipt.update({ where: { id: existing.id }, data: { documentNotRequired: true } });
    await writeAuditLog({
      entityType: "INVOICE_OR_RECEIPT",
      entityId,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Makbuz/fatura için belge gerekmiyor olarak işaretlendi",
      userId
    });
    return updated;
  }

  const existing = await prisma.cashLedgerEntry.findFirst({ where: { id: entityId, userId, deletedAt: null } });
  if (!existing) throw new DocumentRequirementError("Kasa hareketi bulunamadı.", 404);
  const updated = await prisma.cashLedgerEntry.update({ where: { id: existing.id }, data: { documentNotRequired: true } });
  await writeAuditLog({
    entityType: "CASH_LEDGER_ENTRY",
    entityId,
    action: "UPDATE",
    oldValue: existing,
    newValue: updated,
    message: "Kasa hareketi için belge gerekmiyor olarak işaretlendi",
    userId
  });
  return updated;
}

function caseLabel(caseFile: { title: string; fileNumber?: string | null } | null) {
  if (!caseFile) return "-";
  return `${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`;
}

function dateSortValue(value: string) {
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1).getTime();
}
