import { notFound } from "next/navigation";

import { requireApiUser, unauthorized } from "@/lib/api";
import { contentDisposition, readPrivateDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { withSensitiveDataHeaders } from "@/lib/security-headers";

export const runtime = "nodejs";

type DocumentDownloadRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: DocumentDownloadRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { storagePath: true, originalFileName: true, mimeType: true, fileSize: true }
  });

  if (!document) {
    notFound();
  }

  const buffer = await readPrivateDocumentFile(document.storagePath);

  return new Response(new Uint8Array(buffer), {
    headers: withSensitiveDataHeaders({
      "Content-Type": document.mimeType,
      "Content-Length": String(document.fileSize),
      "Content-Disposition": contentDisposition(document.originalFileName, "attachment")
    })
  });
}
