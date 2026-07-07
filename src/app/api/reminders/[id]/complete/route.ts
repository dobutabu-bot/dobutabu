import { requireApiUser, unauthorized } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type ReminderCompleteRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: ReminderCompleteRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const current = await prisma.taskReminder.findFirst({
      where: { id, userId: user.id, status: "OPEN", deletedAt: null }
    });

    if (!current) {
      return Response.json({ message: "Açık hatırlatma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const reminder = await prisma.taskReminder.update({
      where: { id },
      data: { status: "DONE" }
    });
    await writeAuditLog({
      entityType: "TASK_REMINDER",
      entityId: reminder.id,
      action: "UPDATE",
      oldValue: current,
      newValue: reminder,
      message: "Hatırlatma tamamlandı",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Hatırlatma tamamlanamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
