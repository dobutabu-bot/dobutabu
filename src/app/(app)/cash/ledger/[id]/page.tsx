import { ArrowLeft, BriefcaseBusiness, FileText, HandCoins, ReceiptText, WalletCards } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { cashLedgerDirectionLabels, cashLedgerEntryTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney } from "@/lib/utils";

type CashLedgerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CashLedgerDetailPage({ params }: CashLedgerDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const entry = await prisma.cashLedgerEntry.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      cashAccount: true,
      client: true,
      caseFile: true,
      income: true,
      expense: true,
      invoiceOrReceipt: true
    }
  });

  if (!entry) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "CASH_LEDGER_ENTRY",
    entityId: entry.id
  });
  const sourceHref = entry.incomeId
    ? `/collections/${entry.incomeId}`
    : entry.expenseId
      ? `/expenses/${entry.expenseId}`
      : entry.invoiceOrReceiptId
        ? `/receipts/${entry.invoiceOrReceiptId}`
        : "";

  return (
    <div className="space-y-5">
      <Link href="/cash/ledger" className="secondary-action w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kasa Hareketlerine Dön
      </Link>

      <section className="surface-dark p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Kasa Hareketi Detayı</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{entry.description || cashLedgerEntryTypeLabels[entry.entryType]}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {entry.cashAccount.name} · {formatDate(entry.date)}
            </p>
          </div>
          <StatusBadge tone={entry.direction === "IN" ? "green" : "rose"}>{cashLedgerDirectionLabels[entry.direction]}</StatusBadge>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Hareket Tutarı"
          value={formatDirectionalMoney(entry.amount, entry.direction, entry.currency)}
          icon={entry.direction === "IN" ? HandCoins : ReceiptText}
          tone={entry.direction === "IN" ? "green" : "rose"}
        />
        <MetricCard title="Kasa Hesabı" value={entry.cashAccount.name} icon={WalletCards} />
        <MetricCard title="Hareket Tipi" value={cashLedgerEntryTypeLabels[entry.entryType]} icon={FileText} />
        <MetricCard title="Dosya" value={entry.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <section className="surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-950">Kasa Hareketi Bilgileri</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Tarih" value={formatDate(entry.date)} />
          <InfoRow label="Referans No" value={entry.referenceNo} />
          <InfoRow label="Müvekkil" value={entry.client ? <Link href={`/clients/${entry.client.id}`} className="font-medium text-slate-950 hover:underline">{entry.client.name}</Link> : "-"} />
          <InfoRow label="Dosya" value={entry.caseFile ? <Link href={`/cases/${entry.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{entry.caseFile.title}</Link> : "-"} />
          <InfoRow label="Kaynak Kayıt" value={sourceHref ? <Link href={sourceHref} className="font-medium text-slate-950 hover:underline">{sourceLabel(entry)}</Link> : "-"} />
          <InfoRow label="Açıklama" value={entry.description} />
          <InfoRow label="Oluşturma" value={formatDate(entry.createdAt)} />
          <InfoRow label="Güncelleme" value={formatDate(entry.updatedAt)} />
        </dl>
      </section>

      <DocumentLinksSection
        entityType="CASH_LEDGER_ENTRY"
        entityId={entry.id}
        documents={documentLinks.documents}
        options={documentLinks.options}
        uploadHref={documentLinks.uploadHref}
      />
    </div>
  );
}

function sourceLabel(entry: {
  incomeId: string | null;
  expenseId: string | null;
  invoiceOrReceiptId: string | null;
  invoiceOrReceipt: { number: string } | null;
}) {
  if (entry.incomeId) return "Tahsilat kaydı";
  if (entry.expenseId) return "Gider kaydı";
  if (entry.invoiceOrReceiptId) return `Makbuz/Fatura: ${entry.invoiceOrReceipt?.number ?? ""}`;
  return "-";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{value || "-"}</dd>
    </div>
  );
}
