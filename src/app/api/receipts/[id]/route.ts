import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { receiptInputSchema } from "@/lib/validations";

type ReceiptRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ReceiptRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, receiptInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const [existing, ownership] = await Promise.all([
      prisma.invoiceOrReceipt.findFirst({ where: { id, userId: user.id, deletedAt: null } }),
      validateOwnedClientAndCase(user.id, data.clientId, caseFileId)
    ]);

    if (!existing) {
      return Response.json({ message: "Makbuz/fatura kaydı bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const updated = await prisma.invoiceOrReceipt.update({
      where: { id },
      data: {
        clientId: data.clientId,
        caseFileId,
        number: data.number,
        type: data.type,
        status: data.status,
        issueDate: parseDateInput(data.issueDate),
        grossAmount: data.grossAmount,
        vatAmount: data.vatAmount ?? null,
        withholdingAmount: data.withholdingAmount ?? null,
        netAmount: data.netAmount,
        notes: nullable(data.notes)
      }
    });
    await writeAuditLog({
      entityType: "INVOICE_OR_RECEIPT",
      entityId: updated.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Makbuz/fatura güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Makbuz/fatura güncellenemedi. Belge numarasını ve tutarları kontrol edin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: ReceiptRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const existing = await prisma.invoiceOrReceipt.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });

    if (!existing) {
      return Response.json({ message: "Makbuz/fatura kaydı bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const canBeDeleted = existing.status === "DRAFT" || existing.status === "CANCELLED";

    const updated = await prisma.invoiceOrReceipt.update({
      where: { id },
      data: canBeDeleted ? { deletedAt: new Date() } : { status: "CANCELLED" }
    });
    await writeAuditLog({
      entityType: "INVOICE_OR_RECEIPT",
      entityId: updated.id,
      action: canBeDeleted ? "DELETE" : "CANCEL",
      oldValue: existing,
      newValue: updated,
      message: canBeDeleted ? "Taslak belge silindi" : existing.status === "ISSUED" ? "Kesilmiş belge iptal edildi" : "Belge iptal edildi",
      userId: user.id
    });

    return Response.json({ ok: true, action: canBeDeleted ? "deleted" : "cancelled" });
  } catch {
    return Response.json({ message: "Makbuz/fatura kaydı silinemedi veya iptal edilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
