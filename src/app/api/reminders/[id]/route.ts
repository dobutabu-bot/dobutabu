import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { reminderInputSchema } from "@/lib/validations";

const amountReminderTypes = ["EXPENSE", "COLLECTION", "INVOICE", "TAX"];

type ReminderRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ReminderRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const current = await prisma.taskReminder.findFirst({ where: { id, userId: user.id, deletedAt: null } });

    if (!current) {
      return Response.json({ message: "Hatırlatma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const data = await parseJson(request, reminderInputSchema);
    const relatedClientId = nullable(data.relatedClientId);
    const relatedCaseFileId = nullable(data.relatedCaseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, relatedClientId, relatedCaseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const cashAccountId =
      data.reminderType === "EXPENSE" ? await resolveCashAccountId(user.id, data.cashAccountId) : null;

    const reminder = await prisma.taskReminder.update({
      where: { id },
      data: {
        title: data.title,
        description: nullable(data.description),
        dueDate: parseDateInput(data.dueDate),
        reminderType: data.reminderType,
        amount: amountReminderTypes.includes(data.reminderType) ? nullable(data.amount) : null,
        currency: data.currency.toUpperCase(),
        cashAccountId,
        relatedClientId: ownership.clientId,
        relatedCaseFileId,
        status: data.status,
        priority: data.priority,
        notifyBeforeDays: data.notifyBeforeDays,
        notificationEnabled: data.notificationEnabled
      }
    });
    const message =
      data.status === "DONE"
        ? "Hatırlatma tamamlandı"
        : data.status === "CANCELLED"
          ? "Hatırlatma iptal edildi"
          : "Hatırlatma güncellendi";
    await writeAuditLog({
      entityType: "TASK_REMINDER",
      entityId: reminder.id,
      action: data.status === "CANCELLED" ? "CANCEL" : "UPDATE",
      oldValue: current,
      newValue: reminder,
      message,
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Hatırlatma güncellenemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: ReminderRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const current = await prisma.taskReminder.findFirst({ where: { id, userId: user.id, deletedAt: null } });

    if (!current) {
      return Response.json({ message: "Hatırlatma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const deleted = await prisma.taskReminder.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      entityType: "TASK_REMINDER",
      entityId: current.id,
      action: "DELETE",
      oldValue: current,
      newValue: deleted,
      message: "Hatırlatma silindi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Hatırlatma silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
