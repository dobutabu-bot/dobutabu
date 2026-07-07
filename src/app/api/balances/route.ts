import { ZodError } from "zod";

import {
  nullable,
  parseJson,
  requireApiUser,
  unauthorized,
  validationError
} from "@/lib/api";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/utils";
import { balanceInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, balanceInputSchema);
    const caseFileId = nullable(data.caseFileId);
    const ownership = await validateOwnedClientAndCase(user.id, data.clientId, caseFileId);

    if (!ownership.ok) {
      return Response.json({ message: ownership.message }, { status: 400 });
    }

    if (data.type === "RECEIVABLE") {
      await prisma.invoiceOrReceipt.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          caseFileId,
          type: "OTHER",
          number: `MANUAL-${Date.now()}`,
          issueDate: data.dueDate ? parseDateInput(data.dueDate) : new Date(),
          grossAmount: data.amount,
          netAmount: data.amount,
          status: data.status === "PAID" ? "PAID" : data.status === "CANCELLED" ? "CANCELLED" : "UNPAID",
          notes: nullable(data.description)
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
          date: data.dueDate ? parseDateInput(data.dueDate) : new Date(),
          paymentMethod: "OTHER",
          category: "OTHER",
          isClientExpense: false,
          description: nullable(data.description)
        }
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Bakiye kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
