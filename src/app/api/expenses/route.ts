import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId, syncExpenseLedgerEntry } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { expenseInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, expenseInputSchema);
    let clientId = nullable(data.clientId);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    clientId = ownership.clientId;

    if (data.isClientExpense && !clientId && !caseFileId) {
      return Response.json({ message: "Yansıtılabilir gider için müvekkil veya dosya seçmelisiniz." }, { status: 400 });
    }

    const { expense, ledger } = await prisma.$transaction(async (tx) => {
      const cashAccountId = await resolveCashAccountId(user.id, data.cashAccountId, tx);
      const expense = await tx.expense.create({
        data: {
          userId: user.id,
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
      const ledger = await syncExpenseLedgerEntry(user.id, expense, tx);
      return { expense, ledger };
    });
    await writeAuditLog({
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "CREATE",
      newValue: expense,
      message: "Gider oluşturuldu",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: "CREATE",
      newValue: ledger,
      message: "Gider kasa hareketi oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Gider kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
