import { BriefcaseBusiness, Download, ReceiptText, Scale, WalletCards } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DetailActivityLog } from "@/components/detail-activity-log";
import { DetailBreadcrumb, DetailHero, DetailInfoRow, DetailSection, DetailTabs } from "@/components/detail-shell";
import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { expenseCategoryLabels, paymentMethodLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney } from "@/lib/utils";

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [expense, activeClients, activeCases, activeCashAccounts] = await Promise.all([
    prisma.expense.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: {
        client: true,
        caseFile: true,
        cashAccount: true,
        cashEntries: { where: { deletedAt: null }, include: { cashAccount: true }, orderBy: { date: "desc" } }
      }
    }),
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    })
  ]);

  if (!expense) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "EXPENSE",
    entityId: expense.id
  });
  const ledgerEntry = expense.cashEntries[0] ?? null;
  const clientOptions = [{ label: "Genel gider", value: "" }, ...activeClients.map((client) => ({ label: client.name, value: client.id }))];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...activeCases.map((caseFile) => ({ label: `${caseFile.client.name} - ${caseFile.title}`, value: caseFile.id }))
  ];
  const cashAccountOptions = [
    { label: "Seçim yapılmazsa Ana Kasa", value: "" },
    ...activeCashAccounts.map((account) => ({ label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}`, value: account.id }))
  ];
  const fields = [
    { name: "amount", label: "Tutar", type: "currency" as const, min: "0", step: "0.01" },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(expenseCategoryLabels) },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2" },
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions, section: "advanced" as const },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    { name: "cashAccountId", label: "Bu işlem hangi kasaya işlensin?", type: "select" as const, options: cashAccountOptions, section: "advanced" as const },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    {
      name: "isClientExpense",
      label: "Müvekkile Yansıtılabilir mi?",
      type: "select" as const,
      options: [
        { label: "Hayır", value: "false" },
        { label: "Evet", value: "true" }
      ],
      section: "advanced" as const
    }
  ];

  return (
    <div className="space-y-5">
      <DetailBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Giderler", href: "/expenses" }, { label: expenseCategoryLabels[expense.category] }]} />
      <DetailHero
        eyebrow="Gider Detayı"
        title={expenseCategoryLabels[expense.category]}
        description={expense.description || expense.client?.name || "Genel gider kaydı"}
        status={<StatusBadge tone={expense.isClientExpense ? "amber" : "neutral"}>{expense.isClientExpense ? "Müvekkile yansıtılabilir" : "Genel/operasyonel gider"}</StatusBadge>}
        actions={
          <>
            <a href={`/api/reports/expenses/${expense.id}/pdf`} className="secondary-action">
              <Download className="h-4 w-4" aria-hidden />
              PDF indir
            </a>
            <RecordEditButton
              title="Gider Düzenle"
              endpoint={`/api/expenses/${expense.id}`}
              schemaKey="expense"
              fields={fields}
              successMessage="Gider güncellendi."
              defaults={{
                clientId: expense.clientId ?? "",
                caseFileId: expense.caseFileId ?? "",
                cashAccountId: expense.cashAccountId ?? "",
                amount: expense.amount.toString(),
                currency: expense.currency,
                date: dateInputValue(expense.date),
                paymentMethod: expense.paymentMethod,
                category: expense.category,
                isClientExpense: expense.isClientExpense ? "true" : "false",
                description: expense.description ?? ""
              }}
            />
            <ConfirmActionButton
              endpoint={`/api/expenses/${expense.id}`}
              label="Sil"
              title="Gider silinsin mi?"
              description="Bu gideri silmek istediğinizden emin misiniz? Silinen gider dashboard ve rapor hesaplarından düşecektir."
              confirmLabel="Sil"
              successMessage="Gider silindi."
              redirectTo="/expenses"
            />
          </>
        }
      />
      <DetailTabs />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Gider Tutarı" value={formatDirectionalMoney(expense.amount, "OUT", expense.currency)} icon={ReceiptText} tone="rose" />
        <MetricCard title="Tarih" value={formatDate(expense.date)} icon={Scale} />
        <MetricCard title="Kasa" value={expense.cashAccount?.name ?? "Ana Kasa"} icon={WalletCards} />
        <MetricCard title="Dosya" value={expense.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <DetailSection id="overview" title="Genel Bakış" description="Giderin müvekkil, dosya ve kayıt bilgileri.">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <DetailInfoRow label="Müvekkil" value={expense.client ? <Link href={`/clients/${expense.client.id}`} className="font-medium text-slate-950 hover:underline">{expense.client.name}</Link> : "-"} />
          <DetailInfoRow label="Dosya" value={expense.caseFile ? <Link href={`/cases/${expense.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{expense.caseFile.title}</Link> : "-"} />
          <DetailInfoRow label="Ödeme Yöntemi" value={paymentMethodLabels[expense.paymentMethod]} />
          <DetailInfoRow label="Kategori" value={expenseCategoryLabels[expense.category]} />
          <DetailInfoRow label="Yansıtılabilir" value={expense.isClientExpense ? "Evet" : "Hayır"} />
          <DetailInfoRow label="Kasa Hareketi" value={ledgerEntry ? <Link href={`/cash/ledger/${ledgerEntry.id}`} className="font-medium text-slate-950 hover:underline">{ledgerEntry.cashAccount.name}</Link> : "-"} />
          <DetailInfoRow label="Oluşturma" value={formatDate(expense.createdAt)} />
          <DetailInfoRow label="Güncelleme" value={formatDate(expense.updatedAt)} />
        </dl>
      </DetailSection>

      <DetailSection id="finance" title="Finans" description="Giderin kasa ve yansıtma bilgileri.">
        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard title="Kasa Hareketi" value={ledgerEntry ? ledgerEntry.cashAccount.name : "Yok"} icon={WalletCards} />
          <MetricCard title="Yansıtma" value={expense.isClientExpense ? "Müvekkile yansıtılabilir" : "Yansıtılamaz"} icon={Scale} tone={expense.isClientExpense ? "amber" : "neutral"} />
        </div>
      </DetailSection>

      <div id="documents" className="scroll-mt-24">
      <DocumentLinksSection
        entityType="EXPENSE"
        entityId={expense.id}
        documents={documentLinks.documents}
        options={documentLinks.options}
        uploadHref={documentLinks.uploadHref}
      />
      </div>
      <DetailActivityLog userId={user.id} entityType="EXPENSE" entityId={expense.id} />
    </div>
  );
}
