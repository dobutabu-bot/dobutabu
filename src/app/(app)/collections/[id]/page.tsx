import { BriefcaseBusiness, HandCoins, ReceiptText, WalletCards } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DetailActivityLog } from "@/components/detail-activity-log";
import { DetailBreadcrumb, DetailHero, DetailInfoRow, DetailSection, DetailTabs } from "@/components/detail-shell";
import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { incomeCategoryLabels, paymentMethodLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney } from "@/lib/utils";

type CollectionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [collection, activeClients, activeCases, activeCashAccounts] = await Promise.all([
    prisma.income.findFirst({
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

  if (!collection) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "INCOME",
    entityId: collection.id
  });
  const ledgerEntry = collection.cashEntries[0] ?? null;
  const clientOptions = [{ label: "Seçiniz", value: "" }, ...activeClients.map((client) => ({ label: client.name, value: client.id }))];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...activeCases.map((caseFile) => ({ label: `${caseFile.client.name} - ${caseFile.title}`, value: caseFile.id }))
  ];
  const cashAccountOptions = [
    { label: "Seçim yapılmazsa Ana Kasa", value: "" },
    ...activeCashAccounts.map((account) => ({ label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}`, value: account.id }))
  ];
  const fields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "amount", label: "Tutar", type: "currency" as const, min: "0", step: "0.01" },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    { name: "cashAccountId", label: "Bu işlem hangi kasaya işlensin?", type: "select" as const, options: cashAccountOptions, section: "advanced" as const },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(incomeCategoryLabels), section: "advanced" as const },
    {
      name: "receiptIssued",
      label: "Makbuz Kesildi mi?",
      type: "select" as const,
      options: [
        { label: "Hayır", value: "false" },
        { label: "Evet", value: "true" }
      ],
      section: "advanced" as const
    },
    { name: "receiptNumber", label: "Makbuz Numarası", section: "advanced" as const }
  ];

  return (
    <div className="space-y-5">
      <DetailBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tahsilatlar", href: "/collections" }, { label: collection.client.name }]} />
      <DetailHero
        eyebrow="Tahsilat Detayı"
        title={collection.client.name}
        description={collection.description || incomeCategoryLabels[collection.category]}
        status={<StatusBadge tone="green">{incomeCategoryLabels[collection.category]}</StatusBadge>}
        actions={
          <>
            <PdfDownloadButton href={`/api/reports/collections/${collection.id}/pdf`} label="PDF indir" />
            <RecordEditButton
              title="Tahsilat Düzenle"
              endpoint={`/api/collections/${collection.id}`}
              schemaKey="collection"
              fields={fields}
              successMessage="Tahsilat güncellendi."
              defaults={{
                clientId: collection.clientId,
                caseFileId: collection.caseFileId ?? "",
                cashAccountId: collection.cashAccountId ?? "",
                amount: collection.amount.toString(),
                currency: collection.currency,
                date: dateInputValue(collection.date),
                paymentMethod: collection.paymentMethod,
                category: collection.category,
                description: collection.description ?? "",
                receiptIssued: collection.receiptIssued ? "true" : "false",
                receiptNumber: collection.receiptNumber ?? ""
              }}
            />
            <ConfirmActionButton
              endpoint={`/api/collections/${collection.id}`}
              label="Sil"
              title="Tahsilat silinsin mi?"
              description="Bu tahsilatı silmek istediğinizden emin misiniz? Silinen tahsilat dashboard ve rapor hesaplarından düşecektir."
              confirmLabel="Sil"
              successMessage="Tahsilat silindi."
              redirectTo="/collections"
            />
          </>
        }
      />
      <DetailTabs />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Tahsilat Tutarı" value={formatDirectionalMoney(collection.amount, "IN", collection.currency)} icon={HandCoins} tone="green" />
        <MetricCard title="Tarih" value={formatDate(collection.date)} icon={ReceiptText} />
        <MetricCard title="Kasa" value={collection.cashAccount?.name ?? "Ana Kasa"} icon={WalletCards} />
        <MetricCard title="Dosya" value={collection.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <DetailSection id="overview" title="Genel Bakış" description="Tahsilatın müvekkil, dosya ve kayıt bilgileri.">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <DetailInfoRow label="Müvekkil" value={<Link href={`/clients/${collection.clientId}`} className="font-medium text-slate-950 hover:underline">{collection.client.name}</Link>} />
          <DetailInfoRow label="Dosya" value={collection.caseFile ? <Link href={`/cases/${collection.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{collection.caseFile.title}</Link> : "-"} />
          <DetailInfoRow label="Ödeme Yöntemi" value={paymentMethodLabels[collection.paymentMethod]} />
          <DetailInfoRow label="Kategori" value={incomeCategoryLabels[collection.category]} />
          <DetailInfoRow label="Makbuz" value={collection.receiptNumber ?? (collection.receiptIssued ? "Kesildi" : "Kesilmedi")} />
          <DetailInfoRow label="Kasa Hareketi" value={ledgerEntry ? <Link href={`/cash/ledger/${ledgerEntry.id}`} className="font-medium text-slate-950 hover:underline">{ledgerEntry.cashAccount.name}</Link> : "-"} />
          <DetailInfoRow label="Oluşturma" value={formatDate(collection.createdAt)} />
          <DetailInfoRow label="Güncelleme" value={formatDate(collection.updatedAt)} />
        </dl>
      </DetailSection>

      <DetailSection id="finance" title="Finans" description="Tahsilatın kasa ve belge bağlantıları.">
        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard title="Kasa Hareketi" value={ledgerEntry ? ledgerEntry.cashAccount.name : "Yok"} icon={WalletCards} />
          <MetricCard title="Makbuz Durumu" value={collection.receiptNumber ?? (collection.receiptIssued ? "Kesildi" : "Kesilmedi")} icon={ReceiptText} />
        </div>
      </DetailSection>

      <div id="documents" className="scroll-mt-24">
      <DocumentLinksSection
        entityType="INCOME"
        entityId={collection.id}
        documents={documentLinks.documents}
        options={documentLinks.options}
        uploadHref={documentLinks.uploadHref}
      />
      </div>
      <DetailActivityLog userId={user.id} entityType="INCOME" entityId={collection.id} />
    </div>
  );
}
