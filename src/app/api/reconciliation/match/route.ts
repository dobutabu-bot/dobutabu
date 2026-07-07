import { z, ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { matchBankStatementRow, ReconciliationError } from "@/lib/reconciliation/reconciliation-service";

const matchSchema = z.object({
  bankRowId: z.string().min(1),
  targetType: z.enum(["LEDGER", "INCOME", "EXPENSE"]),
  targetId: z.string().min(1),
  matchMode: z.enum(["AUTO_MATCHED", "MANUALLY_MATCHED"]).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, matchSchema);
    await matchBankStatementRow({ userId: user.id, ...data });

    return Response.json({ ok: true, message: "Hareket eşleştirildi." });
  } catch (error) {
    if (error instanceof ReconciliationError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Eşleştirme yapılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
