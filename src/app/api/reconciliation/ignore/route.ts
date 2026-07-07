import { z, ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { ignoreBankStatementRow, ReconciliationError } from "@/lib/reconciliation/reconciliation-service";

const bankRowSchema = z.object({
  bankRowId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, bankRowSchema);
    await ignoreBankStatementRow(user.id, data.bankRowId);

    return Response.json({ ok: true, message: "Hareket yoksayıldı." });
  } catch (error) {
    if (error instanceof ReconciliationError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Hareket yoksayılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
