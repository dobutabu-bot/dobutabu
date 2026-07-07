import { ZodError } from "zod";

import {
  nullable,
  parseJson,
  requireApiUser,
  unauthorized,
  validationError
} from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { receiptInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, receiptInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, data.clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const receipt = await prisma.invoiceOrReceipt.create({
      data: {
        userId: user.id,
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
      entityId: receipt.id,
      action: "CREATE",
      newValue: receipt,
      message: "Makbuz/fatura oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Makbuz/fatura kaydedilemedi. Belge numarasını ve tutarları kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
