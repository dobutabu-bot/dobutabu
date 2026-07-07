import { ArrowLeft, BriefcaseBusiness, Download, HandCoins, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { incomeCategoryLabels, paymentMethodLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney } from "@/lib/utils";

type CollectionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const collection = await prisma.income.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      caseFile: true,
      cashAccount: true,
      cashEntries: { where: { deletedAt: null }, include: { cashAccount: true }, orderBy: { date: "desc" } }
    }
  });

  if (!collection) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "INCOME",
    entityId: collection.id
  });
  const ledgerEntry = collection.cashEntries[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/collections" className="secondary-action w-fit">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tahsilatlara Dön
        </Link>
        <Link href={`/api/reports/collections/${collection.id}/pdf`} className="secondary-action w-fit">
          <Download className="h-4 w-4" aria-hidden />
          PDF indir
        </Link>
      </div>

      <section className="surface-dark p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Tahsilat Detayı</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{collection.client.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {collection.description || incomeCategoryLabels[collection.category]}
            </p>
          </div>
          <StatusBadge tone="green">{incomeCategoryLabels[collection.category]}</StatusBadge>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Tahsilat Tutarı" value={formatDirectionalMoney(collection.amount, "IN", collection.currency)} icon={HandCoins} tone="green" />
        <MetricCard title="Tarih" value={formatDate(collection.date)} icon={ReceiptText} />
        <MetricCard title="Kasa" value={collection.cashAccount?.name ?? "Ana Kasa"} icon={WalletCards} />
        <MetricCard title="Dosya" value={collection.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <section className="surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-950">Tahsilat Bilgileri</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Müvekkil" value={<Link href={`/clients/${collection.clientId}`} className="font-medium text-slate-950 hover:underline">{collection.client.name}</Link>} />
          <InfoRow label="Dosya" value={collection.caseFile ? <Link href={`/cases/${collection.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{collection.caseFile.title}</Link> : "-"} />
          <InfoRow label="Ödeme Yöntemi" value={paymentMethodLabels[collection.paymentMethod]} />
          <InfoRow label="Kategori" value={incomeCategoryLabels[collection.category]} />
          <InfoRow label="Makbuz" value={collection.receiptNumber ?? (collection.receiptIssued ? "Kesildi" : "Kesilmedi")} />
          <InfoRow label="Kasa Hareketi" value={ledgerEntry ? <Link href={`/cash/ledger/${ledgerEntry.id}`} className="font-medium text-slate-950 hover:underline">{ledgerEntry.cashAccount.name}</Link> : "-"} />
          <InfoRow label="Oluşturma" value={formatDate(collection.createdAt)} />
          <InfoRow label="Güncelleme" value={formatDate(collection.updatedAt)} />
        </dl>
      </section>

      <DocumentLinksSection
        entityType="INCOME"
        entityId={collection.id}
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
