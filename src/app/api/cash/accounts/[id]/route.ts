import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CashAccountError, softDeleteCashAccount, updateCashAccount } from "@/lib/cash/cash-account-service";
import { cashAccountInputSchema } from "@/lib/validations";

type CashAccountRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: CashAccountRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await updateCashAccount(user.id, id, await parseJson(request, cashAccountInputSchema));

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Kasa hesabı güncellenemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: CashAccountRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await softDeleteCashAccount(user.id, id);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CashAccountError) return Response.json({ message: error.message }, { status: 400 });
    return Response.json({ message: "Kasa hesabı silinemedi veya arşivlenemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
