import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId, syncExpenseLedgerEntry } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { reminderExpensePaymentInputSchema } from "@/lib/validations";

type ReminderPayRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: ReminderPayRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, reminderExpensePaymentInputSchema);
    const current = await prisma.taskReminder.findFirst({
      where: { id, userId: user.id, status: "OPEN", deletedAt: null }
    });

    if (!current) {
      return Response.json({ message: "Açık hatırlatma bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    if (current.reminderType !== "EXPENSE") {
      return Response.json({ message: "Sadece gider hatırlatmaları gider kaydına dönüştürülebilir." }, { status: 400 });
    }

    const ownership = await validateOwnedClientAndCase(user.id, current.relatedClientId, current.relatedCaseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const { reminder, expense, ledger } = await prisma.$transaction(async (tx) => {
      const cashAccountId = await resolveCashAccountId(user.id, data.cashAccountId || current.cashAccountId, tx);
      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          clientId: ownership.clientId,
          caseFileId: current.relatedCaseFileId,
          cashAccountId,
          amount: data.amount,
          currency: current.currency.toUpperCase(),
          date: parseDateInput(data.date),
          paymentMethod: "BANK_TRANSFER",
          category: data.category,
          isClientExpense: false,
          description: nullable(data.description) ?? current.title
        }
      });
      const ledger = await syncExpenseLedgerEntry(user.id, expense, tx);
      const reminder = await tx.taskReminder.update({
        where: { id },
        data: { status: "DONE", cashAccountId }
      });

      return { reminder, expense, ledger };
    });

    await writeAuditLog({
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "CREATE",
      newValue: expense,
      message: "Gider hatırlatmasından gider kaydı oluşturuldu",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: "CREATE",
      newValue: ledger,
      message: "Hatırlatma ödemesi kasa hareketine işlendi",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "TASK_REMINDER",
      entityId: reminder.id,
      action: "UPDATE",
      oldValue: current,
      newValue: reminder,
      message: "Gider hatırlatması ödendi ve tamamlandı",
      userId: user.id
    });

    return Response.json({ ok: true, expenseId: expense.id });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Gider hatırlatması ödenemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
