import { ZodError, z } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { DocumentLinkError, linkDocumentToEntity, unlinkDocumentFromEntity } from "@/lib/document-links";
import { documentLinkEntityTypes } from "@/lib/document-link-types";

const documentLinkInputSchema = z.object({
  documentId: z.string().min(1, "Belge seçimi gerekli"),
  entityType: z.enum(documentLinkEntityTypes),
  entityId: z.string().min(1, "Kayıt seçimi gerekli")
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, documentLinkInputSchema);
    await linkDocumentToEntity({ userId: user.id, ...data });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof DocumentLinkError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: "Belge bağlantısı kurulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, documentLinkInputSchema);
    await unlinkDocumentFromEntity({ userId: user.id, ...data });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof DocumentLinkError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: "Belge bağlantısı kaldırılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
