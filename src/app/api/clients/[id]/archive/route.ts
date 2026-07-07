import { requireApiUser, unauthorized } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type ClientArchiveRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: ClientArchiveRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const existing = await prisma.client.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });

    if (!existing) {
      return Response.json({ message: "Müvekkil bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const now = new Date();
    const updated = await prisma.client.update({
      where: { id },
      data: { archivedAt: now, deletedAt: now }
    });
    await writeAuditLog({
      entityType: "CLIENT",
      entityId: updated.id,
      action: "DELETE",
      oldValue: existing,
      newValue: updated,
      message: "Müvekkil silindi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Müvekkil silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
