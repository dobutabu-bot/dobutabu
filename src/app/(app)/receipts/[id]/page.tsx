import { AlertTriangle, ArrowLeft, BriefcaseBusiness, FileText, ReceiptText, Scale } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import { cashLedgerDirectionLabels, cashLedgerEntryTypeLabels, receiptStatusLabels, receiptTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney, formatMoney } from "@/lib/utils";

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await prisma.invoiceOrReceipt.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      client: true,
      caseFile: true,
      relatedIncome: true,
      cashEntries: { where: { deletedAt: null }, include: { cashAccount: true }, orderBy: { date: "desc" } }
    }
  });

  if (!receipt) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "INVOICE_OR_RECEIPT",
    entityId: receipt.id
  });
  const ledgerEntry = receipt.cashEntries[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/receipts" className="secondary-action w-fit">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Makbuz/Faturaya Dön
        </Link>
      </div>

      <section className="surface flex gap-3 border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>Bu ekran yalnızca takip amaçlıdır. Resmi e-SMM/e-Fatura işlemleri ayrıca yetkili sistemden yapılmalıdır.</p>
      </section>

      <section className="surface-dark p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Makbuz / Fatura Detayı</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{receipt.number}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {receipt.client.name} · {receiptTypeLabels[receipt.type]} · {formatDate(receipt.issueDate)}
            </p>
          </div>
          <StatusBadge tone={receiptStatusTone(receipt.status)}>{receiptStatusLabels[receipt.status]}</StatusBadge>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Net Tutar" value={formatMoney(receipt.netAmount)} icon={Scale} tone={receipt.status === "UNPAID" ? "amber" : "green"} />
        <MetricCard title="Brüt Tutar" value={formatMoney(receipt.grossAmount)} icon={ReceiptText} />
        <MetricCard title="Tarih" value={formatDate(receipt.issueDate)} icon={FileText} />
        <MetricCard title="Dosya" value={receipt.caseFile?.title ?? "Dosya yok"} icon={BriefcaseBusiness} />
      </div>

      <section className="surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-slate-950">Belge Bilgileri</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Müvekkil" value={<Link href={`/clients/${receipt.clientId}`} className="font-medium text-slate-950 hover:underline">{receipt.client.name}</Link>} />
          <InfoRow label="Dosya" value={receipt.caseFile ? <Link href={`/cases/${receipt.caseFile.id}`} className="font-medium text-slate-950 hover:underline">{receipt.caseFile.title}</Link> : "-"} />
          <InfoRow label="Belge Türü" value={receiptTypeLabels[receipt.type]} />
          <InfoRow label="Durum" value={receiptStatusLabels[receipt.status]} />
          <InfoRow label="KDV" value={receipt.vatAmount == null ? "-" : formatMoney(receipt.vatAmount)} />
          <InfoRow label="Stopaj / Tevkifat" value={receipt.withholdingAmount == null ? "-" : formatMoney(receipt.withholdingAmount)} />
          <InfoRow label="Tahsilat Bağı" value={receipt.relatedIncome ? <Link href={`/collections/${receipt.relatedIncome.id}`} className="font-medium text-slate-950 hover:underline">{formatMoney(receipt.relatedIncome.amount, receipt.relatedIncome.currency)}</Link> : "-"} />
          <InfoRow label="Kasa Hareketi" value={ledgerEntry ? <Link href={`/cash/ledger/${ledgerEntry.id}`} className="font-medium text-slate-950 hover:underline">{ledgerEntry.cashAccount.name}</Link> : "-"} />
          <InfoRow label="Oluşturma" value={formatDate(receipt.createdAt)} />
          <InfoRow label="Güncelleme" value={formatDate(receipt.updatedAt)} />
        </dl>
        {receipt.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{receipt.notes}</p> : null}
      </section>

      {ledgerEntry ? (
        <section className="surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-950">Bağlı Kasa Hareketi</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MiniInfo label="Tarih" value={formatDate(ledgerEntry.date)} />
            <MiniInfo label="Tip" value={cashLedgerEntryTypeLabels[ledgerEntry.entryType]} />
            <MiniInfo label="Yön" value={cashLedgerDirectionLabels[ledgerEntry.direction]} />
            <MiniInfo label="Tutar" value={formatDirectionalMoney(ledgerEntry.amount, ledgerEntry.direction, ledgerEntry.currency)} />
          </div>
        </section>
      ) : null}

      <DocumentLinksSection
        entityType="INVOICE_OR_RECEIPT"
        entityId={receipt.id}
        documents={documentLinks.documents}
        options={documentLinks.options}
        uploadHref={documentLinks.uploadHref}
      />
    </div>
  );
}

function receiptStatusTone(status: keyof typeof receiptStatusLabels) {
  if (status === "PAID") return "green";
  if (status === "CANCELLED") return "neutral";
  if (status === "UNPAID") return "rose";
  return "amber";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
