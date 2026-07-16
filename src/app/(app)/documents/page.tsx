import type { DocumentType, Prisma } from "@prisma/client";
import { Download, Eye, FileQuestion, Filter, Grid2X2, Pencil, RotateCcw, ShieldCheck, Table2, Unlink, Upload } from "lucide-react";
import Link from "@/components/app-link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { RecordActionMenu } from "@/components/action-menu";
import { DataTable } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { documentExtractionStatusLabels, documentTypeLabels } from "@/lib/document-labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { cn, endOfDateInput, formatDate, formatMoney, parseDateInput, toNumber } from "@/lib/utils";

type DocumentsPageProps = {
  searchParams: Promise<{
    q?: string;
    documentType?: string;
    clientId?: string;
    caseFileId?: string;
    startDate?: string;
    endDate?: string;
    linkedType?: string;
    fileType?: string;
    tag?: string;
    view?: string;
    page?: string;
  }>;
};

const linkedTypeOptions = [
  { value: "CLIENT", label: "Müvekkile bağlı" },
  { value: "CASE_FILE", label: "Dosyaya bağlı" },
  { value: "INCOME", label: "Tahsilata bağlı" },
  { value: "EXPENSE", label: "Gidere bağlı" },
  { value: "INVOICE_OR_RECEIPT", label: "Makbuz/Faturaya bağlı" },
  { value: "CASH_LEDGER_ENTRY", label: "Kasa hareketine bağlı" },
  { value: "NONE", label: "Bağlantısız" }
] as const;

const fileTypeOptions = [
  { value: "PDF", label: "PDF" },
  { value: "IMAGE", label: "Görsel" },
  { value: "CSV", label: "CSV" },
  { value: "EXCEL", label: "Excel" }
] as const;

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const documentType = isDocumentType(params.documentType) ? params.documentType : "";
  const clientId = params.clientId?.trim() ?? "";
  const caseFileId = params.caseFileId?.trim() ?? "";
  const startDate = isDateInput(params.startDate) ? params.startDate : "";
  const endDate = isDateInput(params.endDate) ? params.endDate : "";
  const linkedType = isLinkedType(params.linkedType) ? params.linkedType : "";
  const fileType = isFileType(params.fileType) ? params.fileType : "";
  const tag = params.tag?.trim() ?? "";
  const view = params.view === "table" ? "table" : "cards";
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const andFilters: Prisma.DocumentWhereInput[] = [];

  if (startDate || endDate) {
    const range: Prisma.DateTimeFilter = {
      ...(startDate ? { gte: parseDateInput(startDate) } : {}),
      ...(endDate ? { lte: endOfDateInput(endDate) } : {})
    };
    andFilters.push({
      OR: [{ documentDate: range }, { documentDate: null, uploadedAt: range }]
    });
  }

  if (linkedType) {
    andFilters.push(linkedTypeWhere(linkedType));
  }

  if (fileType) {
    andFilters.push(fileTypeWhere(fileType));
  }

  const where: Prisma.DocumentWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(documentType ? { documentType } : {}),
    ...(clientId ? { linkedClientId: clientId } : {}),
    ...(caseFileId ? { linkedCaseFileId: caseFileId } : {}),
    ...(tag ? { tags: { some: { tag: { userId: user.id, name: tag } } } } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { originalFileName: { contains: query } },
            { description: { contains: query } },
            { extractedText: { contains: query } }
          ]
        }
      : {})
  };

  const [documents, totalCount, clients, caseFiles, tags] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        linkedClient: { select: { name: true } },
        linkedCaseFile: { select: { title: true, fileNumber: true } },
        linkedIncome: { select: { amount: true, currency: true, date: true } },
        linkedExpense: { select: { amount: true, currency: true, date: true } },
        linkedInvoiceOrReceipt: { select: { number: true } },
        linkedCashLedgerEntry: { select: { direction: true, amount: true, currency: true, date: true } },
        tags: { include: { tag: true } }
      }
    }),
    prisma.document.count({ where }),
    prisma.client.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
      take: 250
    }),
    prisma.documentTag.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { name: true }
    })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);
  const filterValues = { q: query, documentType, clientId, caseFileId, startDate, endDate, linkedType, fileType, tag, view };

  return (
    <div className="space-y-5">
      <section className="surface-dark flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">V3 Belge Merkezi</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Belgeler</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Dekont, makbuz, fiş, fatura, PDF, görsel ve banka ekstrelerini güvenli private storage alanında takip edin. {totalCount} sonuç bulundu.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/documents/unlinked" className="secondary-action min-h-12 justify-center border-white/15 bg-white/10 text-white hover:bg-white/15">
            <Unlink className="h-4 w-4" aria-hidden />
            Bağsız Belgeler
          </Link>
          <Link href="/documents/missing" className="secondary-action min-h-12 justify-center border-white/15 bg-white/10 text-white hover:bg-white/15">
            <FileQuestion className="h-4 w-4" aria-hidden />
            Eksik Belgeler
          </Link>
          <Link href="/documents/new" className="primary-action min-h-12 justify-center">
            <Upload className="h-4 w-4" aria-hidden />
            Belge Yükle
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Yüklenen belgeler kişisel veri, müvekkil bilgisi ve finansal bilgi içerebilir. Güvenli şekilde saklayınız.</span>
        </div>
      </section>

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" action="/documents">
          <input type="hidden" name="view" value={view} />
          <label className="space-y-1">
            <span className="label">Arama</span>
            <input className="field" name="q" defaultValue={query} placeholder="Başlık, dosya adı veya açıklama" />
          </label>
          <label className="space-y-1">
            <span className="label">Belge Türü</span>
            <select className="field" name="documentType" defaultValue={documentType}>
              <option value="">Tüm türler</option>
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Belge Tarihi Başlangıç</span>
            <input className="field" type="date" name="startDate" defaultValue={startDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Belge Tarihi Bitiş</span>
            <input className="field" type="date" name="endDate" defaultValue={endDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Müvekkil</span>
            <select className="field" name="clientId" defaultValue={clientId}>
              <option value="">Tüm müvekkiller</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Dosya</span>
            <select className="field" name="caseFileId" defaultValue={caseFileId}>
              <option value="">Tüm dosyalar</option>
              {caseFiles.map((caseFile) => (
                <option key={caseFile.id} value={caseFile.id}>
                  {caseFile.client.name} - {caseFile.title}
                  {caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Bağlı Kayıt Türü</span>
            <select className="field" name="linkedType" defaultValue={linkedType}>
              <option value="">Tüm bağlantılar</option>
              {linkedTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Dosya Tipi</span>
            <select className="field" name="fileType" defaultValue={fileType}>
              <option value="">Tüm tipler</option>
              {fileTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Etiket</span>
            <select className="field" name="tag" defaultValue={tag}>
              <option value="">Tüm etiketler</option>
              {tags.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-0 flex-wrap items-end gap-2 xl:col-span-4">
            <button type="submit" className="primary-action min-h-11 flex-1 px-4 text-sm leading-none xl:flex-none">
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link href="/documents" className="secondary-action min-h-11 flex-1 px-4 text-sm leading-none xl:flex-none">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Temizle
            </Link>
            <div className="ml-auto hidden rounded-2xl border border-slate-200 bg-white p-1 md:flex">
              <Link
                href={documentsHref(filterValues, { view: "cards" })}
                className={cn("secondary-action min-h-11 border-0 px-4 text-sm leading-none shadow-none", view === "cards" ? "bg-slate-950 text-white hover:bg-slate-900" : "")}
              >
                <Grid2X2 className="h-4 w-4" aria-hidden />
                Kart
              </Link>
              <Link
                href={documentsHref(filterValues, { view: "table" })}
                className={cn("secondary-action min-h-11 border-0 px-4 text-sm leading-none shadow-none", view === "table" ? "bg-slate-950 text-white hover:bg-slate-900" : "")}
              >
                <Table2 className="h-4 w-4" aria-hidden />
                Tablo
              </Link>
            </div>
          </div>
        </form>
      </section>

      {view === "table" ? (
        <DocumentsTable documents={documents} />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {documents.length === 0 ? (
            <div className="surface p-6 lg:col-span-2 xl:col-span-3">
              <p className="text-sm font-semibold text-slate-950">Henüz belge bulunamadı.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Filtreleri temizleyebilir veya yeni bir belge yükleyebilirsiniz.</p>
            </div>
          ) : (
            documents.map((document) => <DocumentCard key={document.id} document={document} />)
          )}
        </section>
      )}

      <Pagination
        page={Math.min(pagination.page, pageCount)}
        totalPages={pageCount}
        totalItems={totalCount}
        pageSize={pagination.pageSize}
        hrefForPage={(page) => createPageHref("/documents", filterValues, page)}
      />
    </div>
  );
}

function isDocumentType(value: string | undefined): value is DocumentType {
  return Boolean(value && value in documentTypeLabels);
}

function isDateInput(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isLinkedType(value: string | undefined): value is (typeof linkedTypeOptions)[number]["value"] {
  return Boolean(value && linkedTypeOptions.some((option) => option.value === value));
}

function isFileType(value: string | undefined): value is (typeof fileTypeOptions)[number]["value"] {
  return Boolean(value && fileTypeOptions.some((option) => option.value === value));
}

function linkedTypeWhere(linkedType: (typeof linkedTypeOptions)[number]["value"]): Prisma.DocumentWhereInput {
  if (linkedType === "CLIENT") return { linkedClientId: { not: null } };
  if (linkedType === "CASE_FILE") return { linkedCaseFileId: { not: null } };
  if (linkedType === "INCOME") return { linkedIncomeId: { not: null } };
  if (linkedType === "EXPENSE") return { linkedExpenseId: { not: null } };
  if (linkedType === "INVOICE_OR_RECEIPT") return { linkedInvoiceOrReceiptId: { not: null } };
  if (linkedType === "CASH_LEDGER_ENTRY") return { linkedCashLedgerEntryId: { not: null } };

  return {
    linkedClientId: null,
    linkedCaseFileId: null,
    linkedIncomeId: null,
    linkedExpenseId: null,
    linkedInvoiceOrReceiptId: null,
    linkedCashLedgerEntryId: null
  };
}

function fileTypeWhere(fileType: (typeof fileTypeOptions)[number]["value"]): Prisma.DocumentWhereInput {
  if (fileType === "PDF") return { mimeType: "application/pdf" };
  if (fileType === "IMAGE") return { mimeType: { startsWith: "image/" } };
  if (fileType === "CSV") return { OR: [{ mimeType: "text/csv" }, { originalFileName: { endsWith: ".csv" } }] };

  return {
    OR: [
      { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { mimeType: "application/vnd.ms-excel" },
      { originalFileName: { endsWith: ".xlsx" } },
      { originalFileName: { endsWith: ".xls" } }
    ]
  };
}

function documentsHref(
  current: Record<string, string>,
  overrides: Partial<Record<string, string>>
) {
  const params = new URLSearchParams();
  Object.entries({ ...current, ...overrides }).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/documents?${query}` : "/documents";
}

function linkedRecordLabel(document: {
  linkedClient: { name: string } | null;
  linkedCaseFile: { title: string; fileNumber: string | null } | null;
  linkedIncome: { amount: unknown; currency: string; date: Date } | null;
  linkedExpense: { amount: unknown; currency: string; date: Date } | null;
  linkedInvoiceOrReceipt: { number: string } | null;
  linkedCashLedgerEntry: { direction: string; amount: unknown; currency: string; date: Date } | null;
}) {
  const labels = [
    document.linkedClient ? `Müvekkil: ${document.linkedClient.name}` : "",
    document.linkedCaseFile
      ? `Dosya: ${document.linkedCaseFile.title}${document.linkedCaseFile.fileNumber ? ` (${document.linkedCaseFile.fileNumber})` : ""}`
      : "",
    document.linkedIncome ? `Tahsilat: ${formatMoney(document.linkedIncome.amount, document.linkedIncome.currency)}` : "",
    document.linkedExpense ? `Gider: ${formatMoney(document.linkedExpense.amount, document.linkedExpense.currency)}` : "",
    document.linkedInvoiceOrReceipt ? `Makbuz/Fatura: ${document.linkedInvoiceOrReceipt.number}` : "",
    document.linkedCashLedgerEntry
      ? `Kasa: ${document.linkedCashLedgerEntry.direction === "IN" ? "Giriş" : "Çıkış"} ${formatMoney(
          document.linkedCashLedgerEntry.amount,
          document.linkedCashLedgerEntry.currency
        )}`
      : ""
  ].filter(Boolean);

  return labels.length > 0 ? labels.slice(0, 2).join(" · ") : "Bağlantı yok";
}

function DocumentsTable({ documents }: { documents: DocumentListItem[] }) {
  return (
    <DataTable
      rows={documents}
      empty="Henüz belge yüklenmedi."
      columns={[
        {
          header: "Başlık",
          cell: (document) => (
            <Link href={`/documents/${document.id}`} className="font-semibold text-slate-950 hover:underline">
              {document.title}
            </Link>
          )
        },
        {
          header: "Tür",
          cell: (document) => <StatusBadge>{documentTypeLabels[document.documentType]}</StatusBadge>
        },
        {
          header: "Bağlantı",
          cell: (document) => [clientCaseLabel(document), linkedRecordLabel(document)].filter(Boolean).join(" · ")
        },
        {
          header: "Tarih / Tutar",
          cell: (document) => (
            <div className="space-y-1">
              <p>{formatDate(document.documentDate ?? document.uploadedAt)}</p>
              <PrivacyAmount as="p" className="font-semibold tabular-finance">
                {document.amount ? formatMoney(document.amount, document.currency) : "-"}
              </PrivacyAmount>
            </div>
          )
        },
        {
          header: "Durum",
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
  );
}

function DocumentCard({ document }: { document: DocumentListItem }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_20px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0f2740] p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {fileTypeLabel(document.mimeType, document.originalFileName)}
            </p>
            <Link href={`/documents/${document.id}`} className="mt-2 block break-words text-lg font-semibold leading-6 hover:underline">
              {document.title}
            </Link>
          </div>
          <StatusBadge>{documentTypeLabels[document.documentType]}</StatusBadge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <MiniInfo label="Tarih" value={formatDate(document.documentDate ?? document.uploadedAt)} />
          <MiniInfo label="Tutar" value={document.amount ? formatMoney(document.amount, document.currency) : "-"} sensitive />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 text-sm">
          <InfoBlock label="Müvekkil / Dosya" value={clientCaseLabel(document)} />
          <InfoBlock label="Bağlı kayıt" value={linkedRecordLabel(document)} />
          <InfoBlock label="Dosya" value={`${document.originalFileName} · ${formatFileSize(document.fileSize)}`} />
        </div>
        <TagList tags={document.tags.map((item) => item.tag.name)} />
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">İşleme durumu</span>
          <StatusBadge tone={document.extractionStatus === "FAILED" ? "rose" : "neutral"}>
            {documentExtractionStatusLabels[document.extractionStatus]}
          </StatusBadge>
        </div>
        <div className="flex justify-end">
          <RecordActionMenu label={`${document.title} belge işlemleri`}>
            <DocumentActions documentId={document.id} />
          </RecordActionMenu>
        </div>
      </div>
    </article>
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
        Düzenle
      </Link>
      <a href={`/api/documents/${documentId}/download`} className="secondary-action min-h-11 px-4 text-sm leading-none">
        <Download className="h-4 w-4" aria-hidden />
        İndir
      </a>
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

function MiniInfo({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {sensitive ? (
        <PrivacyAmount as="p" className="mt-1 truncate font-semibold text-slate-100">
          {value}
        </PrivacyAmount>
      ) : (
        <p className="mt-1 truncate font-semibold text-slate-100">{value}</p>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
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

function clientCaseLabel(document: {
  linkedClient: { name: string } | null;
  linkedCaseFile: { title: string; fileNumber: string | null } | null;
}) {
  const client = document.linkedClient?.name ?? "Müvekkil yok";
  const caseFile = document.linkedCaseFile
    ? `${document.linkedCaseFile.title}${document.linkedCaseFile.fileNumber ? ` (${document.linkedCaseFile.fileNumber})` : ""}`
    : "Dosya yok";

  return `${client} · ${caseFile}`;
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

  return `${toNumber(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type DocumentListItem = Prisma.DocumentGetPayload<{
  include: {
    linkedClient: { select: { name: true } };
    linkedCaseFile: { select: { title: true; fileNumber: true } };
    linkedIncome: { select: { amount: true; currency: true; date: true } };
    linkedExpense: { select: { amount: true; currency: true; date: true } };
    linkedInvoiceOrReceipt: { select: { number: true } };
    linkedCashLedgerEntry: { select: { direction: true; amount: true; currency: true; date: true } };
    tags: { include: { tag: true } };
  };
}>;
