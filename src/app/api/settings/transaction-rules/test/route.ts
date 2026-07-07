import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { testTransactionRules } from "@/lib/transaction-rules";
import { transactionRuleTestSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    return Response.json(await testTransactionRules(user.id, await parseJson(request, transactionRuleTestSchema)));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Test çalıştırılamadı. Lütfen örnek açıklamayı kontrol edin." }, { status: 500 });
  }
}
