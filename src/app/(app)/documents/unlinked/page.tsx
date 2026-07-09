import type { Prisma } from "@prisma/client";
import { ArrowLeft, Download, Eye, FileQuestion, Link2, Pencil, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { documentExtractionStatusLabels, documentTypeLabels } from "@/lib/document-labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toNumber } from "@/lib/utils";

type UnlinkedDocument = Prisma.DocumentGetPayload<{
  include: { tags: { include: { tag: true } } };
}>;

export default async function UnlinkedDocumentsPage() {
  const user = await requireUser();
  const documents = await prisma.document.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      linkedClientId: null,
      linkedCaseFileId: null,
      linkedIncomeId: null,
      linkedExpenseId: null,
      linkedInvoiceOrReceiptId: null,
      linkedCashLedgerEntryId: null
    },
    orderBy: { uploadedAt: "desc" },
    include: { tags: { include: { tag: true } } },
    take: 300
  });

  const totalAmount = documents.reduce((total, document) => total + (document.amount ? toNumber(document.amount) : 0), 0);

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/documents" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Belgelere dön
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Belge Merkezi</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Bağsız Belgeler</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Hiçbir müvekkil, dosya, finans kaydı veya kasa hareketiyle ilişkilendirilmemiş belgeleri buradan yönetin.
            </p>
          </div>
          <Link href="/documents/new" className="primary-action min-h-12 justify-center">
            <Link2 className="h-4 w-4" aria-hidden />
            Yeni Belge Yükle
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Bağsız Belge" value={`${documents.length}`} detail="Hiçbir kayda bağlı değil" icon={FileQuestion} tone={documents.length > 0 ? "amber" : "green"} />
        <MetricCard title="Tutar Bilgisi Olan" value={`${documents.filter((document) => document.amount).length}`} detail="Metadata tutarı girilmiş" icon={ShieldCheck} />
        <MetricCard title="Toplam Metadata Tutarı" value={formatMoney(totalAmount)} detail="Bağlantısız belgelerdeki tutar" icon={Download} />
      </section>

      <section className="surface flex gap-3 p-4 text-sm leading-6 text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          Bağsız belge silmek zorunda değilsiniz. “Düzenle” ekranından belgeyi müvekkil, dosya, tahsilat, gider, makbuz/fatura veya kasa hareketine bağlayabilirsiniz.
        </p>
      </section>

      <DataTable<UnlinkedDocument>
        rows={documents}
        empty="Bağsız belge yok"
        columns={[
          {
            header: "Belge",
            cell: (document) => (
              <Link href={`/documents/${document.id}`} className="font-semibold text-slate-950 hover:underline">
                {document.title}
              </Link>
            )
          },
          { header: "Tür", cell: (document) => <StatusBadge>{documentTypeLabels[document.documentType]}</StatusBadge> },
          { header: "Tarih", cell: (document) => formatDate(document.documentDate ?? document.uploadedAt) },
          { header: "Tutar", cell: (document) => (document.amount ? formatMoney(document.amount, document.currency) : "-"), className: "font-medium tabular-nums text-slate-950" },
          {
            header: "Dosya",
            cell: (document) => (
              <div className="space-y-1">
                <p className="max-w-[18rem] truncate">{document.originalFileName}</p>
                <p className="text-xs text-slate-500">
                  {fileTypeLabel(document.mimeType, document.originalFileName)} · {formatFileSize(document.fileSize)}
                </p>
              </div>
            )
          },
          {
            header: "Etiketler",
            cell: (document) => <TagList tags={document.tags.map((item) => item.tag.name)} />
          },
          {
            header: "İşleme",
            cell: (document) => (
              <StatusBadge tone={document.extractionStatus === "FAILED" ? "rose" : "neutral"}>
                {documentExtractionStatusLabels[document.extractionStatus]}
              </StatusBadge>
            )
          },
          {
            header: "İşlem",
            cell: (document) => <DocumentActions documentId={document.id} />
          }
        ]}
      />
    </div>
  );
}

function DocumentActions({ documentId }: { documentId: string }) {
  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2">
      <Link href={`/documents/${documentId}`} className="secondary-action min-h-11 px-4 text-sm leading-none">
        <Eye className="h-4 w-4" aria-hidden />
        Önizle
      </Link>
      <Link href={`/documents/${documentId}/edit`} className="secondary-action min-h-11 px-4 text-sm leading-none">
        <Pencil className="h-4 w-4" aria-hidden />
        Bağla / Düzenle
      </Link>
      <Link href={`/api/documents/${documentId}/download`} className="secondary-action min-h-11 px-4 text-sm leading-none">
        <Download className="h-4 w-4" aria-hidden />
        İndir
      </Link>
      <ConfirmActionButton
        endpoint={`/api/documents/${documentId}`}
        label="Sil"
        title="Belge silinsin mi?"
        description="Bu işlem belgeyi normal listelerden kaldırır. Fiziksel dosya güvenli temizlik için storage alanında kalabilir."
        successMessage="Belge silindi."
      />
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-xs text-slate-400">Etiket yok</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          {tag}
        </span>
      ))}
    </div>
  );
}

function fileTypeLabel(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "PDF";
  if (mimeType.startsWith("image/")) return "Görsel";
  if (mimeType === "text/csv" || lowerName.endsWith(".csv")) return "CSV";
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) return "Excel";
  return mimeType;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
