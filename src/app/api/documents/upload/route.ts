import { Prisma, type DocumentType } from "@prisma/client";

import { nullable, requireApiUser, unauthorized } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { tryProcessDocumentExtraction } from "@/lib/document-extraction";
import { documentTypeLabels } from "@/lib/document-labels";
import {
  createStoredDocumentName,
  DocumentUploadError,
  getDocumentUploadLimitBytes,
  writePrivateDocumentFile
} from "@/lib/document-storage";
import { hashBuffer } from "@/lib/documents/hash";
import { scanUploadedDocument } from "@/lib/documents/scanner";
import { sanitizeDocumentTitle, validateUploadedDocumentFile } from "@/lib/documents/validate-upload";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type OwnedReferenceInput = {
  clientId: string | null;
  caseFileId: string | null;
  incomeId: string | null;
  expenseId: string | null;
  invoiceOrReceiptId: string | null;
  cashLedgerEntryId: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ message: "Yüklenecek dosya seçilmedi." }, { status: 400 });
    }

    const maxBytes = await getDocumentUploadLimitBytes(user.id);
    const validation = await validateUploadedDocumentFile(file, maxBytes);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashBuffer(buffer);
    const scannerResult = await scanUploadedDocument({
      buffer,
      fileName: validation.originalFileName,
      mimeType: validation.mimeType,
      fileHash
    });

    if (scannerResult.status === "BLOCKED") {
      throw new DocumentUploadError("Belge güvenlik taramasından geçemedi. Lütfen dosyayı kontrol edin.");
    }

    if (scannerResult.status === "FAILED") {
      throw new DocumentUploadError("Belge güvenlik taraması tamamlanamadı. Lütfen daha sonra tekrar deneyin.");
    }

    const references = await validateOwnedReferences(user.id, {
      clientId: nullable(valueOf(formData.get("linkedClientId"))),
      caseFileId: nullable(valueOf(formData.get("linkedCaseFileId"))),
      incomeId: nullable(valueOf(formData.get("linkedIncomeId"))),
      expenseId: nullable(valueOf(formData.get("linkedExpenseId"))),
      invoiceOrReceiptId: nullable(valueOf(formData.get("linkedInvoiceOrReceiptId"))),
      cashLedgerEntryId: nullable(valueOf(formData.get("linkedCashLedgerEntryId")))
    });
    const duplicate = await prisma.document.findFirst({
      where: { userId: user.id, fileHash, deletedAt: null },
      select: {
        id: true,
        title: true,
        originalFileName: true,
        linkedClientId: true,
        linkedCaseFileId: true,
        linkedIncomeId: true,
        linkedExpenseId: true,
        linkedInvoiceOrReceiptId: true,
        linkedCashLedgerEntryId: true
      }
    });
    const duplicateAction = parseDuplicateAction(formData);

    if (duplicate && !duplicateAction) {
      return Response.json(
        {
          message: `Bu dosya daha önce yüklenmiş olabilir: ${duplicate.title || duplicate.originalFileName}`,
          duplicate: true,
          duplicateDocumentId: duplicate.id,
          canRelink: true,
          allowedDuplicateActions: ["link_existing", "upload_copy"]
        },
        { status: 409 }
      );
    }

    if (duplicate && duplicateAction === "link_existing") {
      const linked = await relinkDuplicateDocument(user.id, duplicate, references);
      return Response.json({
        ok: true,
        id: linked.id,
        duplicate: true,
        relinked: true,
        message: "Aynı dosya mevcut belge kaydına bağlandı."
      });
    }

    const documentType = parseDocumentType(formData.get("documentType"));
    const storedName = createStoredDocumentName(validation.extension);
    const storagePath = await writePrivateDocumentFile(storedName, buffer);
    const title = sanitizeDocumentTitle(valueOf(formData.get("title")), validation.originalFileName);
    const tagNames = parseTagNames(valueOf(formData.get("tags")));

    const document = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          userId: user.id,
          title,
          description: nullable(valueOf(formData.get("description"))),
          documentType,
          fileName: storedName,
          originalFileName: validation.originalFileName,
          mimeType: validation.mimeType,
          fileSize: file.size,
          storagePath,
          fileHash,
          documentDate: dateOrNull(valueOf(formData.get("documentDate"))),
          amount: decimalOrNull(valueOf(formData.get("amount"))),
          currency: (valueOf(formData.get("currency")) || "TRY").toUpperCase(),
          linkedClientId: references.clientId,
          linkedCaseFileId: references.caseFileId,
          linkedIncomeId: references.incomeId,
          linkedExpenseId: references.expenseId,
          linkedInvoiceOrReceiptId: references.invoiceOrReceiptId,
          linkedCashLedgerEntryId: references.cashLedgerEntryId
        }
      });

      await tx.documentProcessingLog.create({
        data: {
          userId: user.id,
          documentId: document.id,
          status: "NOT_PROCESSED",
          message:
            scannerResult.status === "SKIPPED"
              ? "Belge güvenli storage alanına yüklendi. AV/CDR taraması yapılandırılmadığı için atlandı."
              : "Belge güvenli storage alanına yüklendi ve güvenlik taraması tamamlandı."
        }
      });

      for (const name of tagNames) {
        const tag = await tx.documentTag.upsert({
          where: { userId_name: { userId: user.id, name } },
          update: {},
          create: { userId: user.id, name }
        });
        await tx.documentTagOnDocument.create({
          data: { documentId: document.id, tagId: tag.id }
        });
      }

      return document;
    });

    await writeAuditLog({
      entityType: "DOCUMENT",
      entityId: document.id,
      action: "CREATE",
      newValue: document,
      message: "Belge yüklendi",
      userId: user.id
    });

    const extraction = await tryProcessDocumentExtraction(user.id, document.id);

    return Response.json({
      ok: true,
      id: document.id,
      duplicate: false,
      scannerStatus: scannerResult.status,
      extractionStatus: extraction.status,
      extractionMessage: extraction.message
    });
  } catch (error) {
    if (error instanceof DocumentUploadError) {
      return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ message: "Belge yüklenemedi. Lütfen dosya ve bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

function valueOf(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function parseDocumentType(value: FormDataEntryValue | null): DocumentType {
  const rawValue = valueOf(value);

  if (rawValue in documentTypeLabels) {
    return rawValue as DocumentType;
  }

  return "OTHER";
}

function dateOrNull(value: string) {
  return value ? new Date(`${value}T00:00:00+03:00`) : null;
}

function decimalOrNull(value: string): Prisma.Decimal | null {
  if (!value.trim()) {
    return null;
  }

  const normalized = value.replace(",", ".");
  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new DocumentUploadError("Tutar alanı geçerli bir pozitif sayı olmalı.");
  }

  return new Prisma.Decimal(normalized);
}

function parseTagNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  ).map((tag) => tag.slice(0, 40));
}

type DuplicateDocument = {
  id: string;
  linkedClientId: string | null;
  linkedCaseFileId: string | null;
  linkedIncomeId: string | null;
  linkedExpenseId: string | null;
  linkedInvoiceOrReceiptId: string | null;
  linkedCashLedgerEntryId: string | null;
};

function parseDuplicateAction(formData: FormData) {
  const action = valueOf(formData.get("duplicateAction"));
  const confirmDuplicate = valueOf(formData.get("confirmDuplicate"));

  if (action === "link_existing" || action === "upload_copy") {
    return action;
  }

  if (confirmDuplicate === "true") {
    return "upload_copy";
  }

  return null;
}

async function relinkDuplicateDocument(userId: string, duplicate: DuplicateDocument, references: OwnedReferenceInput) {
  const data: Partial<OwnedReferenceInput> = {};

  if (references.clientId) data.clientId = references.clientId;
  if (references.caseFileId) data.caseFileId = references.caseFileId;
  if (references.incomeId) data.incomeId = references.incomeId;
  if (references.expenseId) data.expenseId = references.expenseId;
  if (references.invoiceOrReceiptId) data.invoiceOrReceiptId = references.invoiceOrReceiptId;
  if (references.cashLedgerEntryId) data.cashLedgerEntryId = references.cashLedgerEntryId;

  if (Object.keys(data).length === 0) {
    throw new DocumentUploadError("Aynı dosya bulundu. Mevcut belgeye bağlamak için en az bir bağlantı seçin.");
  }

  const updated = await prisma.document.update({
    where: { id: duplicate.id },
    data: {
      linkedClientId: data.clientId ?? duplicate.linkedClientId,
      linkedCaseFileId: data.caseFileId ?? duplicate.linkedCaseFileId,
      linkedIncomeId: data.incomeId ?? duplicate.linkedIncomeId,
      linkedExpenseId: data.expenseId ?? duplicate.linkedExpenseId,
      linkedInvoiceOrReceiptId: data.invoiceOrReceiptId ?? duplicate.linkedInvoiceOrReceiptId,
      linkedCashLedgerEntryId: data.cashLedgerEntryId ?? duplicate.linkedCashLedgerEntryId
    }
  });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: updated.id,
    action: "UPDATE",
    oldValue: duplicate,
    newValue: updated,
    message: "Aynı hash değerine sahip mevcut belge yeni kayıtla ilişkilendirildi.",
    userId
  });

  return updated;
}

async function validateOwnedReferences(userId: string, input: OwnedReferenceInput): Promise<OwnedReferenceInput> {
  const [client, caseFile, income, expense, invoiceOrReceipt, cashLedgerEntry] = await Promise.all([
    input.clientId
      ? prisma.client.findFirst({ where: { id: input.clientId, userId, deletedAt: null }, select: { id: true } })
      : null,
    input.caseFileId
      ? prisma.caseFile.findFirst({
          where: { id: input.caseFileId, userId, deletedAt: null },
          select: { id: true, clientId: true }
        })
      : null,
    input.incomeId
      ? prisma.income.findFirst({ where: { id: input.incomeId, userId, deletedAt: null }, select: { id: true } })
      : null,
    input.expenseId
      ? prisma.expense.findFirst({ where: { id: input.expenseId, userId, deletedAt: null }, select: { id: true } })
      : null,
    input.invoiceOrReceiptId
      ? prisma.invoiceOrReceipt.findFirst({
          where: { id: input.invoiceOrReceiptId, userId, deletedAt: null },
          select: { id: true }
        })
      : null,
    input.cashLedgerEntryId
      ? prisma.cashLedgerEntry.findFirst({
          where: { id: input.cashLedgerEntryId, userId, deletedAt: null },
          select: { id: true }
        })
      : null
  ]);

  if (input.clientId && !client) throw new DocumentUploadError("Seçilen müvekkil bulunamadı.");
  if (input.caseFileId && !caseFile) throw new DocumentUploadError("Seçilen dosya bulunamadı.");
  if (input.incomeId && !income) throw new DocumentUploadError("Seçilen tahsilat bulunamadı.");
  if (input.expenseId && !expense) throw new DocumentUploadError("Seçilen gider bulunamadı.");
  if (input.invoiceOrReceiptId && !invoiceOrReceipt) throw new DocumentUploadError("Seçilen makbuz/fatura bulunamadı.");
  if (input.cashLedgerEntryId && !cashLedgerEntry) throw new DocumentUploadError("Seçilen kasa hareketi bulunamadı.");
  if (client && caseFile && caseFile.clientId !== client.id) {
    throw new DocumentUploadError("Seçilen dosya bu müvekkile ait değil.");
  }

  return input;
}
