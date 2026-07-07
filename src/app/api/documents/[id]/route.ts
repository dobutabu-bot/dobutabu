import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { DocumentUploadError } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { documentMetadataInputSchema } from "@/lib/validations";

type DocumentRouteProps = {
  params: Promise<{ id: string }>;
};

type OwnedReferenceInput = {
  clientId: string | null;
  caseFileId: string | null;
  incomeId: string | null;
  expenseId: string | null;
  invoiceOrReceiptId: string | null;
  cashLedgerEntryId: string | null;
};

export async function PATCH(request: Request, { params }: DocumentRouteProps) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const existing = await prisma.document.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { tags: { include: { tag: true } } }
    });

    if (!existing) {
      return Response.json({ message: "Belge bulunamadı." }, { status: 404 });
    }

    const data = await parseJson(request, documentMetadataInputSchema);
    const references = await validateOwnedReferences(user.id, {
      clientId: nullable(data.linkedClientId),
      caseFileId: nullable(data.linkedCaseFileId),
      incomeId: nullable(data.linkedIncomeId),
      expenseId: nullable(data.linkedExpenseId),
      invoiceOrReceiptId: nullable(data.linkedInvoiceOrReceiptId),
      cashLedgerEntryId: nullable(data.linkedCashLedgerEntryId)
    });
    const tagNames = parseTagNames(data.tags);

    const document = await prisma.$transaction(async (tx) => {
      const document = await tx.document.update({
        where: { id },
        data: {
          title: data.title,
          description: nullable(data.description),
          documentType: data.documentType,
          documentDate: dateOrNull(data.documentDate),
          amount: decimalOrNull(data.amount),
          currency: data.currency.toUpperCase(),
          linkedClientId: references.clientId,
          linkedCaseFileId: references.caseFileId,
          linkedIncomeId: references.incomeId,
          linkedExpenseId: references.expenseId,
          linkedInvoiceOrReceiptId: references.invoiceOrReceiptId,
          linkedCashLedgerEntryId: references.cashLedgerEntryId
        }
      });

      await tx.documentTagOnDocument.deleteMany({ where: { documentId: id } });
      for (const name of tagNames) {
        const tag = await tx.documentTag.upsert({
          where: { userId_name: { userId: user.id, name } },
          update: {},
          create: { userId: user.id, name }
        });
        await tx.documentTagOnDocument.create({ data: { documentId: id, tagId: tag.id } });
      }

      return document;
    });

    await writeAuditLog({
      entityType: "DOCUMENT",
      entityId: document.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: document,
      message: "Belge güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof DocumentUploadError) return Response.json({ message: error.message }, { status: 400 });
    return Response.json({ message: "Belge güncellenemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: DocumentRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null }
  });

  if (!existing) {
    return Response.json({ message: "Belge bulunamadı." }, { status: 404 });
  }

  const document = await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: document.id,
    action: "DELETE",
    oldValue: existing,
    newValue: document,
    message: "Belge silindi",
    userId: user.id
  });

  return Response.json({ ok: true });
}

function dateOrNull(value: string | undefined | null) {
  return value ? new Date(`${value}T00:00:00+03:00`) : null;
}

function decimalOrNull(value: string | undefined | null): Prisma.Decimal | null {
  if (!value?.trim()) {
    return null;
  }

  return new Prisma.Decimal(value.replace(",", "."));
}

function parseTagNames(value: string | undefined | null) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  ).map((tag) => tag.slice(0, 40));
}

async function validateOwnedReferences(userId: string, input: OwnedReferenceInput): Promise<OwnedReferenceInput> {
  const [client, caseFile, income, expense, invoiceOrReceipt, cashLedgerEntry] = await Promise.all([
    input.clientId ? prisma.client.findFirst({ where: { id: input.clientId, userId, deletedAt: null }, select: { id: true } }) : null,
    input.caseFileId
      ? prisma.caseFile.findFirst({ where: { id: input.caseFileId, userId, deletedAt: null }, select: { id: true, clientId: true } })
      : null,
    input.incomeId ? prisma.income.findFirst({ where: { id: input.incomeId, userId, deletedAt: null }, select: { id: true } }) : null,
    input.expenseId ? prisma.expense.findFirst({ where: { id: input.expenseId, userId, deletedAt: null }, select: { id: true } }) : null,
    input.invoiceOrReceiptId
      ? prisma.invoiceOrReceipt.findFirst({ where: { id: input.invoiceOrReceiptId, userId, deletedAt: null }, select: { id: true } })
      : null,
    input.cashLedgerEntryId
      ? prisma.cashLedgerEntry.findFirst({ where: { id: input.cashLedgerEntryId, userId, deletedAt: null }, select: { id: true } })
      : null
  ]);

  if (input.clientId && !client) throw new DocumentUploadError("Seçilen müvekkil bulunamadı.");
  if (input.caseFileId && !caseFile) throw new DocumentUploadError("Seçilen dosya bulunamadı.");
  if (input.incomeId && !income) throw new DocumentUploadError("Seçilen tahsilat bulunamadı.");
  if (input.expenseId && !expense) throw new DocumentUploadError("Seçilen gider bulunamadı.");
  if (input.invoiceOrReceiptId && !invoiceOrReceipt) throw new DocumentUploadError("Seçilen makbuz/fatura bulunamadı.");
  if (input.cashLedgerEntryId && !cashLedgerEntry) throw new DocumentUploadError("Seçilen kasa hareketi bulunamadı.");
  if (client && caseFile && caseFile.clientId !== client.id) throw new DocumentUploadError("Seçilen dosya bu müvekkile ait değil.");

  return input;
}
