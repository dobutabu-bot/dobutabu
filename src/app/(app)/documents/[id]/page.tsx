import { ArrowLeft, Download, ExternalLink, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DocumentProcessingLog } from "@/components/documents/document-processing-log";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentOcrButton } from "@/components/document-ocr-button";
import { DocumentReprocessButton } from "@/components/document-reprocess-button";
import { PrivacyAmount, PrivacyDocumentFrame } from "@/components/privacy/privacy-mask";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { documentExtractionStatusLabels, documentTypeLabels } from "@/lib/document-labels";
import { getTabularDocumentPreview } from "@/lib/documents/preview";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

type DocumentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      linkedClient: { select: { id: true, name: true } },
      linkedCaseFile: { select: { id: true, title: true, fileNumber: true } },
      linkedIncome: { select: { id: true, amount: true, currency: true, date: true } },
      linkedExpense: { select: { id: true, amount: true, currency: true, date: true } },
      linkedInvoiceOrReceipt: { select: { id: true, number: true } },
      linkedCashLedgerEntry: { select: { id: true, direction: true, amount: true, currency: true, date: true } },
      tags: { include: { tag: true } },
      processingLogs: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });

  if (!document) {
    notFound();
  }
  const tabularPreview = await getTabularDocumentPreview({
    storagePath: document.storagePath,
    mimeType: document.mimeType,
    originalFileName: document.originalFileName
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/documents" className="secondary-action">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Belgelere Dön
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/documents/${document.id}/edit`} className="secondary-action">
            <Pencil className="h-4 w-4" aria-hidden />
            Düzenle
          </Link>
          <DocumentReprocessButton documentId={document.id} />
          {isOcrActionVisible(document.mimeType) ? <DocumentOcrButton documentId={document.id} /> : null}
          <Link href={`/api/documents/${document.id}/download`} className="primary-action">
            <Download className="h-4 w-4" aria-hidden />
            İndir
          </Link>
          <ConfirmActionButton
            endpoint={`/api/documents/${document.id}`}
            label="Sil"
            title="Belge silinsin mi?"
            description="Bu işlem belgeyi normal listelerden kaldırır. Fiziksel dosya güvenli temizlik için storage alanında kalabilir."
            successMessage="Belge silindi."
            redirectTo="/documents"
          />
        </div>
      </div>

      <section className="surface-dark p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Belge Detayı</p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-white">{document.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{document.description || "Açıklama girilmemiş."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge>{documentTypeLabels[document.documentType]}</StatusBadge>
            <StatusBadge tone={document.extractionStatus === "FAILED" ? "rose" : "neutral"}>
              {documentExtractionStatusLabels[document.extractionStatus]}
            </StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="surface overflow-hidden">
          <div className="border-b border-slate-100 bg-white/70 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Güvenli Önizleme</h2>
          </div>
          <DocumentPreview
            id={document.id}
            mimeType={document.mimeType}
            originalFileName={document.originalFileName}
            title={document.title}
            tabularPreview={tabularPreview}
          />
        </div>

        <div className="space-y-5">
          <section className="surface p-4">
            <h2 className="text-sm font-semibold text-slate-950">Belge Bilgileri</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <InfoRow label="Dosya adı" value={document.originalFileName} />
              <InfoRow label="MIME" value={document.mimeType} />
              <InfoRow label="Boyut" value={formatFileSize(document.fileSize)} />
              <InfoRow label="Belge tarihi" value={formatDate(document.documentDate)} />
              <InfoRow label="Yüklenme" value={formatDate(document.uploadedAt)} />
              <InfoRow label="Tutar" value={document.amount ? formatMoney(document.amount, document.currency) : "-"} sensitive />
              <InfoRow label="Hash" value={document.fileHash.slice(0, 16)} />
            </dl>
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Etiketler</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {document.tags.length > 0 ? (
                  document.tags.map(({ tag }) => (
                    <span key={tag.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Etiket yok.</span>
                )}
              </div>
            </div>
          </section>

          <section className="surface p-4">
            <h2 className="text-sm font-semibold text-slate-950">Bağlantılar</h2>
            <div className="mt-3 grid gap-2">
              {document.linkedClient ? <LinkedRow href={`/clients/${document.linkedClient.id}`} label={`Müvekkil: ${document.linkedClient.name}`} /> : null}
              {document.linkedCaseFile ? <LinkedRow href={`/cases/${document.linkedCaseFile.id}`} label={`Dosya: ${document.linkedCaseFile.title}`} /> : null}
              {document.linkedIncome ? <LinkedRow href={`/collections/${document.linkedIncome.id}`} label={`Tahsilat: ${formatMoney(document.linkedIncome.amount, document.linkedIncome.currency)}`} sensitive /> : null}
              {document.linkedExpense ? <LinkedRow href={`/expenses/${document.linkedExpense.id}`} label={`Gider: ${formatMoney(document.linkedExpense.amount, document.linkedExpense.currency)}`} sensitive /> : null}
              {document.linkedInvoiceOrReceipt ? <LinkedRow href={`/receipts/${document.linkedInvoiceOrReceipt.id}`} label={`Makbuz/Fatura: ${document.linkedInvoiceOrReceipt.number}`} /> : null}
              {document.linkedCashLedgerEntry ? <LinkedRow href={`/cash/ledger/${document.linkedCashLedgerEntry.id}`} label={`Kasa hareketi: ${formatMoney(document.linkedCashLedgerEntry.amount, document.linkedCashLedgerEntry.currency)}`} sensitive /> : null}
              {!hasAnyLink(document) ? <p className="text-sm text-slate-500">Bu belge henüz bir kayıtla ilişkilendirilmemiş.</p> : null}
            </div>
          </section>

          <DocumentProcessingLog logs={document.processingLogs} />

          <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Bu belge private storage alanından auth kontrollü route ile servis edilir.</span>
            </div>
          </section>
        </div>
      </section>

      {document.extractedText ? (
        <section className="surface p-4">
          <h2 className="text-sm font-semibold text-slate-950">Çıkarılan Metin</h2>
          <div className="mt-3 rounded-3xl bg-slate-950">
            <PrivacyDocumentFrame>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                {document.extractedText}
              </pre>
            </PrivacyDocumentFrame>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      {sensitive ? (
        <PrivacyAmount as="dd" className="min-w-0 break-words text-right font-medium text-slate-900">
          {value}
        </PrivacyAmount>
      ) : (
        <dd className="min-w-0 break-words text-right font-medium text-slate-900">{value}</dd>
      )}
    </div>
  );
}

function LinkedRow({ href, label, sensitive = false }: { href: string; label: string; sensitive?: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
      {sensitive ? <PrivacyAmount className="min-w-0 truncate">{label}</PrivacyAmount> : <span className="min-w-0 truncate">{label}</span>}
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}

function hasAnyLink(document: {
  linkedClient: unknown;
  linkedCaseFile: unknown;
  linkedIncome: unknown;
  linkedExpense: unknown;
  linkedInvoiceOrReceipt: unknown;
  linkedCashLedgerEntry: unknown;
}) {
  return Boolean(
    document.linkedClient ||
      document.linkedCaseFile ||
      document.linkedIncome ||
      document.linkedExpense ||
      document.linkedInvoiceOrReceipt ||
      document.linkedCashLedgerEntry
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isOcrActionVisible(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "application/pdf";
}
