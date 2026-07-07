import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId, syncExpenseLedgerEntry } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { expenseInputSchema } from "@/lib/validations";

type ExpenseRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ExpenseRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, expenseInputSchema);
    let clientId = nullable(data.clientId);
    const caseFileId = nullable(data.caseFileId);
    const [existing, existingLedger, ownership] = await Promise.all([
      prisma.expense.findFirst({ where: { id, userId: user.id, deletedAt: null } }),
      prisma.cashLedgerEntry.findUnique({ where: { expenseId: id } }),
      validateOwnedClientAndCase(user.id, clientId, caseFileId)
    ]);

    if (!existing) {
      return Response.json({ message: "Gider bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    clientId = ownership.clientId;

    if (data.isClientExpense && !clientId && !caseFileId) {
      return Response.json({ message: "Yansıtılabilir gider için müvekkil veya dosya seçmelisiniz." }, { status: 400 });
    }

    const { updated, ledger } = await prisma.$transaction(async (tx) => {
      const cashAccountId = await resolveCashAccountId(user.id, data.cashAccountId, tx);
      const updated = await tx.expense.update({
        where: { id },
        data: {
          clientId,
          caseFileId,
          cashAccountId,
          amount: data.amount,
          currency: data.currency.toUpperCase(),
          date: parseDateInput(data.date),
          paymentMethod: data.paymentMethod,
          category: data.category,
          isClientExpense: data.isClientExpense,
          description: nullable(data.description)
        }
      });
      const ledger = await syncExpenseLedgerEntry(user.id, updated, tx);
      return { updated, ledger };
    });
    await writeAuditLog({
      entityType: "EXPENSE",
      entityId: updated.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Gider güncellendi",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: existingLedger ? "UPDATE" : "CREATE",
      oldValue: existingLedger,
      newValue: ledger,
      message: existingLedger ? "Gider kasa hareketi güncellendi" : "Gider kasa hareketi oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Gider güncellenemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: ExpenseRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const existing = await prisma.expense.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });

    if (!existing) {
      return Response.json({ message: "Gider bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const existingLedger = await prisma.cashLedgerEntry.findUnique({ where: { expenseId: id } });
    const { updated, ledger } = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      const ledger = await syncExpenseLedgerEntry(user.id, updated, tx);
      return { updated, ledger };
    });
    await writeAuditLog({
      entityType: "EXPENSE",
      entityId: updated.id,
      action: "DELETE",
      oldValue: existing,
      newValue: updated,
      message: "Gider silindi",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: "DELETE",
      oldValue: existingLedger,
      newValue: ledger,
      message: "Gider kasa hareketi silindi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ message: "Gider silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
