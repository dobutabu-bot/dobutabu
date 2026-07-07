import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { softDeleteTransactionRule, TransactionRuleError, updateTransactionRule } from "@/lib/transaction-rules";
import { transactionRuleInputSchema } from "@/lib/validations";

type TransactionRuleRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: TransactionRuleRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await updateTransactionRule(user.id, id, await parseJson(request, transactionRuleInputSchema));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TransactionRuleError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Kural güncellenemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: TransactionRuleRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await softDeleteTransactionRule(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TransactionRuleError) return Response.json({ message: error.message }, { status: 400 });
    return Response.json({ message: "Kural silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
