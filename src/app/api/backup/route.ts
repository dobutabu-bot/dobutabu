import { requireApiUser, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withSensitiveDataHeaders } from "@/lib/security-headers";
import { dateInputValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const generatedAt = new Date();
  const [
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    taskReminders,
    cashAccounts,
    cashLedgerEntries,
    cashTransfers,
    balanceSnapshots,
    documents,
    documentTags,
    documentProcessingLogs,
    bankStatementImports,
    bankStatementRows,
    transactionRules,
    assetAccounts,
    assetValuations,
    assetTransactions,
    capitalSnapshots,
    capitalImports,
    capitalImportSuggestions,
    auditLogs,
    settings
  ] =
    await Promise.all([
      prisma.client.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
      prisma.caseFile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.income.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.expense.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.invoiceOrReceipt.findMany({ where: { userId: user.id }, orderBy: { issueDate: "desc" } }),
      prisma.taskReminder.findMany({ where: { userId: user.id }, orderBy: { dueDate: "asc" } }),
      prisma.cashAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.cashLedgerEntry.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.cashTransfer.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.balanceSnapshot.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.document.findMany({
        where: { userId: user.id },
        orderBy: { uploadedAt: "desc" },
        include: { tags: { include: { tag: true } } }
      }),
      prisma.documentTag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
      prisma.documentProcessingLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.bankStatementImport.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.bankStatementRow.findMany({ where: { userId: user.id }, orderBy: [{ transactionDate: "desc" }, { rowNumber: "asc" }] }),
      prisma.transactionRule.findMany({ where: { userId: user.id }, orderBy: [{ priority: "asc" }, { createdAt: "desc" }] }),
      prisma.assetAccount.findMany({ where: { userId: user.id }, orderBy: [{ assetType: "asc" }, { name: "asc" }] }),
      prisma.assetValuation.findMany({ where: { userId: user.id }, orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }] }),
      prisma.assetTransaction.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      prisma.capitalSnapshot.findMany({ where: { userId: user.id }, orderBy: { snapshotDate: "desc" } }),
      prisma.capitalImport.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.capitalImportSuggestion.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.appSetting.findMany({ where: { userId: user.id }, orderBy: { key: "asc" } })
    ]);

  return Response.json(
    {
      version: 3,
      generatedAt: generatedAt.toISOString(),
      securityNotice:
        "Bu JSON yedek müvekkil, belge metadata, banka ekstresi ham satırları, sermaye/portföy bilgileri ve audit log içerebilir. Fiziksel belge dosyaları JSON içine gömülmez; storage/documents klasörü ayrıca yedeklenmelidir.",
      clients,
      caseFiles,
      incomes,
      expenses,
      invoiceOrReceipts,
      taskReminders,
      cashAccounts,
      cashLedgerEntries,
      cashTransfers,
      balanceSnapshots,
      documents,
      documentTags,
      documentProcessingLogs,
      bankStatementImports,
      bankStatementRows,
      transactionRules,
      assetAccounts,
      assetValuations,
      assetTransactions,
      capitalSnapshots,
      capitalImports,
      capitalImportSuggestions,
      auditLogs,
      settings
    },
    {
      headers: withSensitiveDataHeaders({
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="buro-finans-yedek-${dateInputValue(generatedAt)}.json"`
      })
    }
  );
}
