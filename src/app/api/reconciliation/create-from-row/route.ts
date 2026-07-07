import { z, ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { createRecordFromBankRow, ReconciliationError } from "@/lib/reconciliation/reconciliation-service";

const createFromRowSchema = z.object({
  bankRowId: z.string().min(1),
  kind: z.enum(["INCOME", "EXPENSE", "LEDGER"]),
  clientId: z.string().optional().nullable(),
  caseFileId: z.string().optional().nullable(),
  cashAccountId: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
  date: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  incomeCategory: z.enum(["LEGAL_FEE", "ADVANCE", "EXPENSE_REIMBURSEMENT", "OTHER"]).optional().nullable(),
  expenseCategory: z.enum(["COURT_FEE", "NOTARY", "TRAVEL", "ACCOMMODATION", "OFFICE", "TAX", "PERSONNEL", "MEAL", "OTHER"]).optional().nullable(),
  isClientExpense: z.boolean().optional().nullable()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, createFromRowSchema);
    await createRecordFromBankRow({ userId: user.id, ...data });

    const message =
      data.kind === "INCOME"
        ? "Tahsilat oluşturuldu ve banka hareketiyle eşleştirildi."
        : data.kind === "EXPENSE"
          ? "Gider oluşturuldu ve banka hareketiyle eşleştirildi."
          : "Kasa hareketi oluşturuldu ve banka hareketiyle eşleştirildi.";

    return Response.json({ ok: true, message });
  } catch (error) {
    if (error instanceof ReconciliationError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Kayıt oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
