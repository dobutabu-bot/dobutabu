import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { reminderInputSchema } from "@/lib/validations";

const amountReminderTypes = ["EXPENSE", "COLLECTION", "INVOICE", "TAX"];

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, reminderInputSchema);
    const relatedClientId = nullable(data.relatedClientId);
    const relatedCaseFileId = nullable(data.relatedCaseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, relatedClientId, relatedCaseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const cashAccountId =
      data.reminderType === "EXPENSE" ? await resolveCashAccountId(user.id, data.cashAccountId) : null;

    const reminder = await prisma.taskReminder.create({
      data: {
        userId: user.id,
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
    await writeAuditLog({
      entityType: "TASK_REMINDER",
      entityId: reminder.id,
      action: "CREATE",
      newValue: reminder,
      message: "Hatırlatma oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Hatırlatma kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
