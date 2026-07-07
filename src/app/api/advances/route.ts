import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { advanceInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, advanceInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, data.clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    if (data.direction === "RECEIVED") {
      await prisma.income.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          caseFileId,
          amount: data.amount,
          currency: "TRY",
          date: new Date(data.occurredAt),
          paymentMethod: "BANK_TRANSFER",
          category: "ADVANCE",
          description: nullable(data.description)
        }
      });
    } else {
      await prisma.expense.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          caseFileId,
          amount: data.amount,
          currency: "TRY",
          date: new Date(data.occurredAt),
          paymentMethod: "BANK_TRANSFER",
          category: "OTHER",
          isClientExpense: true,
          description: nullable(data.description)
        }
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Masraf avansı kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
