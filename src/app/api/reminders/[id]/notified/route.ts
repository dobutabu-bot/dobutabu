import { requireApiUser, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type ReminderNotifiedRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: ReminderNotifiedRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const current = await prisma.taskReminder.findFirst({
      where: {
        id,
        userId: user.id,
        status: "OPEN",
        deletedAt: null,
        notificationEnabled: true
      },
      select: { id: true }
    });

    if (!current) {
      return Response.json({ message: "Bildirim işaretlenecek açık hatırlatma bulunamadı." }, { status: 404 });
    }

    await prisma.taskReminder.update({
      where: { id },
      data: { notifiedAt: new Date() }
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Bildirim durumu kaydedilemedi." }, { status: 500 });
  }
}
