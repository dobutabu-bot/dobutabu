import type { Prisma } from "@prisma/client";
import { BriefcaseBusiness, Filter } from "lucide-react";
import Link from "@/components/app-link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { RecordCreateButton } from "@/components/record-create-button";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PdfActionMenuItem } from "@/components/pdf-download-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { caseStatusLabels, toOptions } from "@/lib/labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

type CasesPageProps = {
  searchParams: Promise<{ q?: string; clientId?: string; status?: string; page?: string }>;
};

const caseStatuses = ["ACTIVE", "CLOSED", "ARCHIVED"] as const;

type CaseStatusFilter = (typeof caseStatuses)[number];

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const selectedClientId = params.clientId?.trim() ?? "";
  const selectedStatus = isCaseStatus(params.status) ? params.status : "";
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const where: Prisma.CaseFileWhereInput = {
    userId: user.id,
    deletedAt: null,
    client: { deletedAt: null },
    ...(selectedClientId ? { clientId: selectedClientId } : {}),
    ...(selectedStatus ? { status: selectedStatus } : { status: { not: "ARCHIVED" } }),
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { fileNumber: { contains: query } },
            { caseType: { contains: query } },
            { courtOrOffice: { contains: query } },
            { client: { name: { contains: query } } }
          ]
        }
      : {})
  };

  const [filterClients, activeClients, cases, totalCount, activeCount, closedCount] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: { client: true }
    }),
    prisma.caseFile.count({ where }),
    prisma.caseFile.count({ where: { userId: user.id, deletedAt: null, status: "ACTIVE", client: { deletedAt: null } } }),
    prisma.caseFile.count({ where: { userId: user.id, deletedAt: null, status: "CLOSED", client: { deletedAt: null } } })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);

  const clientOptions = [
    { label: "Seçiniz", value: "" },
    ...activeClients.map((client) => ({ label: client.name, value: client.id }))
  ];
  const caseFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "title", label: "Başlık" },
    { name: "fileNumber", label: "Dosya No", placeholder: "2024/330 E. veya 2024/22943 İstanbul 19. İcra Dairesi", required: false },
    { name: "courtOrOffice", label: "Mahkeme / Daire", section: "advanced" as const },
    { name: "caseType", label: "Dosya Türü", required: false },
    { name: "status", label: "Durum", type: "select" as const, options: toOptions(caseStatusLabels), section: "advanced" as const },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3", section: "advanced" as const }
  ];
  const filterClientOptions = [
    { label: "Tüm müvekkiller", value: "" },
    ...filterClients.map((client) => ({
      label: client.archivedAt ? `${client.name} (Arşiv)` : client.name,
      value: client.id
    }))
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Dosya Yönetimi"
        title="Dosyalar"
        description="Müvekkil dosyalarını, durumlarını ve finans bağlantılarını kontrollü listede yönetin."
        actions={<RecordCreateButton label="Dosya Ekle" title="Dosya Ekle" endpoint="/api/cases" schemaKey="caseFile" autoOpenParam="create" defaults={{ clientId: "", title: "", fileNumber: "", courtOrOffice: "", caseType: "", status: "ACTIVE", notes: "" }} fields={caseFields} />}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Toplam Sonuç" value={String(totalCount)} detail={`${pagination.pageSize} kayıt / sayfa`} icon={BriefcaseBusiness} />
        <MetricCard title="Aktif" value={String(activeCount)} icon={BriefcaseBusiness} tone="green" />
        <MetricCard title="Kapalı" value={String(closedCount)} icon={BriefcaseBusiness} tone="neutral" />
      </section>

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_auto]" action="/cases">
          <label className="space-y-1">
            <span className="label">Arama</span>
            <input className="field" name="q" defaultValue={query} placeholder="Dosya, numara veya müvekkil" />
          </label>
          <label className="space-y-1">
            <span className="label">Müvekkile Göre Filtrele</span>
            <select className="field" name="clientId" defaultValue={selectedClientId}>
              {filterClientOptions.map((option) => (
                <option key={option.value || "all-clients"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Duruma Göre Filtrele</span>
            <select className="field" name="status" defaultValue={selectedStatus}>
              {toOptions(caseStatusLabels, { label: "Tüm durumlar", value: "" }).map((option) => (
                <option key={option.value || "all-statuses"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link
              href="/cases"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Temizle
            </Link>
          </div>
        </form>
      </section>

      <DataTable
        rows={cases}
        empty="Henüz dosya yok"
        columns={[
          {
            header: "Müvekkil",
            cell: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/clients/${row.clientId}`} className="font-medium text-slate-950 hover:text-slate-700">
                  {row.client.name}
                </Link>
                {row.client.archivedAt ? <StatusBadge tone="neutral">Arşiv</StatusBadge> : null}
              </div>
            )
          },
          {
            header: "Başlık",
            cell: (row) => (
              <Link href={`/cases/${row.id}`} className="font-medium text-slate-950 hover:text-slate-700">
                {row.title}
              </Link>
            )
          },
          { header: "Dosya No", cell: (row) => row.fileNumber ?? "-" },
          {
            header: "Durum",
            cell: (row) => (
              <StatusBadge tone={row.status === "CLOSED" ? "neutral" : row.status === "ARCHIVED" ? "amber" : "green"}>
                {caseStatusLabels[row.status]}
              </StatusBadge>
            )
          },
          {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/cases/${row.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  Detay
                </Link>
                <PdfActionMenuItem href={`/api/reports/case/${row.id}/pdf`} label="PDF indir" />
                <Link href={`/documents/new?linkedCaseFileId=${row.id}`} className="secondary-action min-h-11 px-3">
                  Belge bağla
                </Link>
                <RecordEditButton
                  title="Dosya Düzenle"
                  endpoint={`/api/cases/${row.id}`}
                  schemaKey="caseFile"
                  fields={caseFields}
                  successMessage="Dosya güncellendi."
                  successMessageRules={[{ field: "status", value: "ARCHIVED", message: "Dosya arşivlendi." }]}
                  defaults={{
                    clientId: row.clientId,
                    title: row.title,
                    fileNumber: row.fileNumber ?? "",
                    courtOrOffice: row.courtOrOffice ?? "",
                    caseType: row.caseType ?? "",
                    status: row.status,
                    notes: row.notes ?? ""
                  }}
                />
                {row.status === "ARCHIVED" ? null : (
                  <ConfirmActionButton
                    endpoint={`/api/cases/${row.id}`}
                    label="Sil/Arşivle"
                    title="Dosya silinsin/arşivlensin mi?"
                    description={`${row.title} normal listelerden ve finans raporlarından çıkarılacak. Bağlı tahsilat, gider ve makbuz kayıtları silinmez.`}
                    confirmLabel="Sil/Arşivle"
                    successMessage="Dosya silindi."
                  />
                )}
              </div>
            )
          }
        ]}
      />

      <Pagination
        page={Math.min(pagination.page, pageCount)}
        totalPages={pageCount}
        totalItems={totalCount}
        pageSize={pagination.pageSize}
        hrefForPage={(page) => createPageHref("/cases", { q: query, clientId: selectedClientId, status: selectedStatus }, page)}
      />
    </div>
  );
}

function isCaseStatus(value: string | undefined): value is CaseStatusFilter {
  return caseStatuses.includes(value as CaseStatusFilter);
}
