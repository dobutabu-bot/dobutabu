import { ArrowLeft, BriefcaseBusiness, Download, ReceiptText, Scale, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { expenseCategoryLabels, paymentMethodLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney } from "@/lib/utils";

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      caseFile: true,
      cashAccount: true,
      cashEntries: { where: { deletedAt: null }, include: { cashAccount: true }, orderBy: { date: "desc" } }
    }
  });

  if (!expense) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "EXPENSE",
    entityId: expense.id
  });
  const ledgerEntry = expense.cashEntries[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/expenses" className="secondary-action w-fit">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Giderlere Dön
        </Link>
        <Link href={`/api/reports/expenses/${expense.id}/pdf`} className="secondary-action w-fit">
          <Download className="h-4 w-4" aria-hidden />
          PDF indir
        </Link>
      </div>

      <section className="surface-dark p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Gider Detayı</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{expenseCategoryLabels[expense.category]}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {expense.description || expense.client?.name || "Genel gider kaydı"}
            </p>
          </div>
          <StatusBadge tone={expense.isClientExpense ? "amber" : "neutral"}>
            {expense.isClientExpense ? "Müvekkile yansıtılabilir" : "Genel/operasyonel gider"}
          </StatusBadge>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Gider Tutarı" value={formatDirectionalMoney(expense.amount, "OUT", expense.currency)} icon={ReceiptText} tone="rose" />
        <MetricCard title="Tarih" value={formatDate(expense.date)} icon={Scale} />
        <MetricCard title="Kasa" value={expense.cashAccount?.name ?? "Ana Kasa"} icon={WalletCards} />
        <MetricCard title="Dosya" value={expense.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <section className="surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-950">Gider Bilgileri</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Müvekkil" value={expense.client ? <Link href={`/clients/${expense.client.id}`} className="font-medium text-slate-950 hover:underline">{expense.client.name}</Link> : "-"} />
          <InfoRow label="Dosya" value={expense.caseFile ? <Link href={`/cases/${expense.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{expense.caseFile.title}</Link> : "-"} />
          <InfoRow label="Ödeme Yöntemi" value={paymentMethodLabels[expense.paymentMethod]} />
          <InfoRow label="Kategori" value={expenseCategoryLabels[expense.category]} />
          <InfoRow label="Yansıtılabilir" value={expense.isClientExpense ? "Evet" : "Hayır"} />
          <InfoRow label="Kasa Hareketi" value={ledgerEntry ? <Link href={`/cash/ledger/${ledgerEntry.id}`} className="font-medium text-slate-950 hover:underline">{ledgerEntry.cashAccount.name}</Link> : "-"} />
          <InfoRow label="Oluşturma" value={formatDate(expense.createdAt)} />
          <InfoRow label="Güncelleme" value={formatDate(expense.updatedAt)} />
        </dl>
      </section>

      <DocumentLinksSection
        entityType="EXPENSE"
        entityId={expense.id}
        documents={documentLinks.documents}
        options={documentLinks.options}
        uploadHref={documentLinks.uploadHref}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{value || "-"}</dd>
    </div>
  );
}
