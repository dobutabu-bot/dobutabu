import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId, syncExpenseLedgerEntry, syncIncomeLedgerEntry } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { advanceInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, advanceInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, data.clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const cashAccountId = await resolveCashAccountId(user.id, undefined, tx);

      if (data.direction === "RECEIVED") {
        const income = await tx.income.create({
          data: {
            userId: user.id,
            clientId: data.clientId,
            caseFileId,
            cashAccountId,
            amount: data.amount,
            currency: "TRY",
            date: new Date(data.occurredAt),
            paymentMethod: "BANK_TRANSFER",
            category: "ADVANCE",
            description: nullable(data.description)
          }
        });
        return { entityType: "INCOME" as const, record: income, ledger: await syncIncomeLedgerEntry(user.id, income, tx) };
      }

      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          caseFileId,
          cashAccountId,
          amount: data.amount,
          currency: "TRY",
          date: new Date(data.occurredAt),
          paymentMethod: "BANK_TRANSFER",
          category: "OTHER",
          isClientExpense: true,
          description: nullable(data.description)
        }
      });
      return { entityType: "EXPENSE" as const, record: expense, ledger: await syncExpenseLedgerEntry(user.id, expense, tx) };
    });

    await writeAuditLog({
      entityType: created.entityType,
      entityId: created.record.id,
      action: "CREATE",
      newValue: created.record,
      message: data.direction === "RECEIVED" ? "Masraf avansı alındı" : "Masraf avansı harcandı",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: created.ledger.id,
      action: "CREATE",
      newValue: created.ledger,
      message: "Masraf avansı kasa hareketi oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Masraf avansı kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
