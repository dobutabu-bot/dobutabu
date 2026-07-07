import { ZodError, z } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { documentLinkEntityTypes } from "@/lib/document-link-types";
import { DocumentRequirementError, markDocumentNotRequired } from "@/lib/missing-documents";

const supportedEntityTypes = documentLinkEntityTypes.filter((type) =>
  ["INCOME", "EXPENSE", "INVOICE_OR_RECEIPT", "CASH_LEDGER_ENTRY"].includes(type)
) as ["INCOME", "EXPENSE", "INVOICE_OR_RECEIPT", "CASH_LEDGER_ENTRY"];

const documentRequirementSchema = z.object({
  entityType: z.enum(supportedEntityTypes),
  entityId: z.string().min(1, "Kayıt seçimi gerekli")
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, documentRequirementSchema);
    await markDocumentNotRequired({ userId: user.id, ...data });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof DocumentRequirementError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: "Belge gereksinimi güncellenemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
