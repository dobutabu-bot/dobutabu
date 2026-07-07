import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { createTransactionRule, getTransactionRules, TransactionRuleError } from "@/lib/transaction-rules";
import { transactionRuleInputSchema } from "@/lib/validations";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  return Response.json({ rules: await getTransactionRules(user.id) });
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    await createTransactionRule(user.id, await parseJson(request, transactionRuleInputSchema));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TransactionRuleError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Kural kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
