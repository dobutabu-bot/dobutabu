import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { findOwnedClient } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { caseInputSchema } from "@/lib/validations";

type CaseRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: CaseRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, caseInputSchema);
    const [existing, client] = await Promise.all([
      prisma.caseFile.findFirst({ where: { id, userId: user.id, deletedAt: null } }),
      findOwnedClient(user.id, data.clientId)
    ]);

    if (!existing) {
      return Response.json({ message: "Dosya bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    if (!client) {
      return Response.json({ message: "Seçilen müvekkil bulunamadı. Lütfen güncel listeden yeniden seçin." }, { status: 400 });
    }

    if (client.archivedAt || client.deletedAt) {
      return Response.json({ message: "Arşivdeki müvekkile dosya bağlanamaz." }, { status: 400 });
    }

    const shouldArchive = data.status === "ARCHIVED";
    const updated = await prisma.caseFile.update({
      where: { id },
      data: {
        userId: user.id,
        clientId: data.clientId,
        title: data.title,
        fileNumber: nullable(data.fileNumber),
        courtOrOffice: nullable(data.courtOrOffice),
        caseType: nullable(data.caseType),
        status: data.status,
        archivedAt: shouldArchive ? existing.archivedAt ?? new Date() : null,
        notes: nullable(data.notes)
      }
    });
    await writeAuditLog({
      entityType: "CASE_FILE",
      entityId: updated.id,
      action: shouldArchive ? "ARCHIVE" : "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: shouldArchive ? "Dosya arşivlendi" : "Dosya güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Dosya güncellenemedi" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: CaseRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const existing = await prisma.caseFile.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });

    if (!existing) {
      return Response.json({ message: "Dosya bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const now = new Date();
    const updated = await prisma.caseFile.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: now, deletedAt: now }
    });
    await writeAuditLog({
      entityType: "CASE_FILE",
      entityId: updated.id,
      action: "ARCHIVE",
      oldValue: existing,
      newValue: updated,
      message: "Dosya arşivlendi/silindi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Dosya silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
