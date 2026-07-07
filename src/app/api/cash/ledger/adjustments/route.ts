import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CashAccountError } from "@/lib/cash/cash-account-service";
import { createManualAdjustment } from "@/lib/cash/cash-ledger-service";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { cashAdjustmentInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, cashAdjustmentInputSchema);
    const clientId = nullable(data.clientId);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    await createManualAdjustment(user.id, {
      ...data,
      clientId: ownership.clientId,
      caseFileId
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Kasa düzeltmesi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
