import { requireApiUser, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const [clients, caseFiles, cashAccounts, lastIncome, lastExpense] = await Promise.all([
    prisma.client.findMany({
      where: { userId: user.id, deletedAt: null, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: "ACTIVE", client: { deletedAt: null, archivedAt: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, clientId: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true }
    }),
    prisma.income.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { paymentMethod: true }
    }),
    prisma.expense.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { paymentMethod: true }
    })
  ]);

  return Response.json({
    clients,
    caseFiles,
    cashAccounts,
    lastPaymentMethods: {
      collection: lastIncome?.paymentMethod ?? "BANK_TRANSFER",
      expense: lastExpense?.paymentMethod ?? "BANK_TRANSFER"
    }
  });
}
