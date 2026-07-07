import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { CashAccountError, resolveCashAccountId, syncIncomeLedgerEntry } from "@/lib/cash-ledger";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { collectionInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, collectionInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, data.clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    const { income, ledger } = await prisma.$transaction(async (tx) => {
      const cashAccountId = await resolveCashAccountId(user.id, data.cashAccountId, tx);
      const income = await tx.income.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          caseFileId,
          cashAccountId,
          amount: data.amount,
          currency: data.currency.toUpperCase(),
          date: parseDateInput(data.date),
          paymentMethod: data.paymentMethod,
          category: data.category,
          description: nullable(data.description),
          receiptIssued: data.receiptIssued,
          receiptNumber: nullable(data.receiptNumber)
        }
      });
      const ledger = await syncIncomeLedgerEntry(user.id, income, tx);
      return { income, ledger };
    });
    await writeAuditLog({
      entityType: "INCOME",
      entityId: income.id,
      action: "CREATE",
      newValue: income,
      message: "Tahsilat oluşturuldu",
      userId: user.id
    });
    await writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: "CREATE",
      newValue: ledger,
      message: "Tahsilat kasa hareketi oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Tahsilat kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
