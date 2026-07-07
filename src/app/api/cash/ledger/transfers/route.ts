import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CashAccountError } from "@/lib/cash/cash-account-service";
import { createCashTransfer } from "@/lib/cash/cash-ledger-service";
import { cashTransferInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, cashTransferInputSchema);
    await createCashTransfer(user.id, data);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error && error.message === "Aynı kasa hesabına transfer yapılamaz.") {
      return Response.json({ message: error.message }, { status: 400 });
    }
    return Response.json({ message: "Kasa transferi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
