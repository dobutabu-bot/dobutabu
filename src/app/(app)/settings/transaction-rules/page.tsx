import { TransactionRulesScreen } from "@/components/transaction-rules-screen";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactionRules } from "@/lib/transaction-rules";

export default async function TransactionRulesPage() {
  const user = await requireUser();
  const [rules, clients, caseFiles, cashAccounts] = await Promise.all([
    getTransactionRules(user.id),
    prisma.client.findMany({
      where: { userId: user.id, deletedAt: null, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, archivedAt: null, client: { deletedAt: null, archivedAt: null } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true }
    })
  ]);

  return (
    <TransactionRulesScreen
      initialRules={rules}
      clients={clients.map((client) => ({ label: client.name, value: client.id }))}
      caseFiles={caseFiles.map((caseFile) => ({
        label: `${caseFile.title}${caseFile.fileNumber ? ` · ${caseFile.fileNumber}` : ""} · ${caseFile.client.name}`,
        value: caseFile.id
      }))}
      cashAccounts={cashAccounts.map((account) => ({ label: account.name, value: account.id }))}
    />
  );
}
