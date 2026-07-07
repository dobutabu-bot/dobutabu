import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DocumentUploadForm } from "@/components/document-upload-form";
import { requireUser } from "@/lib/auth";
import { getDocumentUploadLimitBytes } from "@/lib/document-storage";
import { expenseCategoryLabels, incomeCategoryLabels, receiptTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney, formatMoney } from "@/lib/utils";

type NewDocumentPageProps = {
  searchParams: Promise<{
    linkedClientId?: string;
    linkedCaseFileId?: string;
    linkedIncomeId?: string;
    linkedExpenseId?: string;
    linkedInvoiceOrReceiptId?: string;
    linkedCashLedgerEntryId?: string;
  }>;
};

export default async function NewDocumentPage({ searchParams }: NewDocumentPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const [
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    cashLedgerEntries,
    maxUploadBytes
  ] = await Promise.all([
    prisma.client.findMany({
      where: { userId: user.id, archivedAt: null, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
      take: 150
    }),
    prisma.income.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true } } },
      take: 100
    }),
    prisma.expense.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true } } },
      take: 100
    }),
    prisma.invoiceOrReceipt.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { issueDate: "desc" },
      include: { client: { select: { name: true } } },
      take: 100
    }),
    prisma.cashLedgerEntry.findMany({
      where: { userId: user.id, deletedAt: null, cashAccount: { deletedAt: null } },
      orderBy: { date: "desc" },
      include: { cashAccount: { select: { name: true } }, client: { select: { name: true } } },
      take: 120
    }),
    getDocumentUploadLimitBytes(user.id)
  ]);

  return (
    <div className="space-y-4">
      <Link href="/documents" className="secondary-action w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Belgelere Dön
      </Link>
      <DocumentUploadForm
        clients={clients.map((client) => ({ label: client.name, value: client.id }))}
        caseFiles={caseFiles.map((caseFile) => ({
          label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
          value: caseFile.id
        }))}
        incomes={incomes.map((income) => ({
          label: `${formatDate(income.date)} · ${income.client.name} · ${incomeCategoryLabels[income.category]} · ${formatMoney(income.amount, income.currency)}`,
          value: income.id
        }))}
        expenses={expenses.map((expense) => ({
          label: `${formatDate(expense.date)} · ${expense.client?.name ?? "Genel gider"} · ${expenseCategoryLabels[expense.category]} · ${formatMoney(expense.amount, expense.currency)}`,
          value: expense.id
        }))}
        invoiceOrReceipts={invoiceOrReceipts.map((receipt) => ({
          label: `${formatDate(receipt.issueDate)} · ${receipt.client.name} · ${receiptTypeLabels[receipt.type]} ${receipt.number}`,
          value: receipt.id
        }))}
        cashLedgerEntries={cashLedgerEntries.map((entry) => ({
          label: `${formatDate(entry.date)} · ${entry.cashAccount.name} · ${entry.client?.name ?? "Genel"} · ${formatDirectionalMoney(
            entry.amount,
            entry.direction,
            entry.currency
          )}`,
          value: entry.id
        }))}
        maxUploadMb={Math.round(maxUploadBytes / 1024 / 1024)}
        defaults={{
          linkedClientId: params.linkedClientId ?? "",
          linkedCaseFileId: params.linkedCaseFileId ?? "",
          linkedIncomeId: params.linkedIncomeId ?? "",
          linkedExpenseId: params.linkedExpenseId ?? "",
          linkedInvoiceOrReceiptId: params.linkedInvoiceOrReceiptId ?? "",
          linkedCashLedgerEntryId: params.linkedCashLedgerEntryId ?? ""
        }}
      />
    </div>
  );
}
