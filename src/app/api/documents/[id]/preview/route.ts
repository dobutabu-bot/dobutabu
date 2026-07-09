import { notFound } from "next/navigation";

import { requireApiUser, unauthorized } from "@/lib/api";
import { contentDisposition, readPrivateDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { withSensitiveDataHeaders } from "@/lib/security-headers";

export const runtime = "nodejs";

type DocumentPreviewRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: DocumentPreviewRouteProps) {
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

  let buffer: Buffer;

  try {
    buffer = await readPrivateDocumentFile(document.storagePath);
  } catch {
    return Response.json(
      { message: "Belge dosyası storage alanında bulunamadı. Yedek/restore veya storage eşleşmesini kontrol edin." },
      {
        status: 404,
        headers: withSensitiveDataHeaders()
      }
    );
  }

  return new Response(new Uint8Array(buffer), {
    headers: withSensitiveDataHeaders({
      "Content-Type": document.mimeType,
      "Content-Length": String(document.fileSize),
      "Content-Disposition": contentDisposition(document.originalFileName, "inline")
    })
  });
}
