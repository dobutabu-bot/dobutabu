import { requireApiUser, unauthorized } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { tryProcessDocumentExtraction } from "@/lib/document-extraction";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type DocumentReprocessRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: DocumentReprocessRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null }
  });

  if (!existing) {
    return Response.json({ message: "Belge bulunamadı." }, { status: 404 });
  }

  const extraction = await tryProcessDocumentExtraction(user.id, id);
  const document = await prisma.document.findUniqueOrThrow({ where: { id } });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: document.id,
    action: "UPDATE",
    oldValue: existing,
    newValue: document,
    message: "Belge yeniden işlendi",
    userId: user.id
  });

  return Response.json({ ok: true, extractionStatus: extraction.status, message: extraction.message });
}
