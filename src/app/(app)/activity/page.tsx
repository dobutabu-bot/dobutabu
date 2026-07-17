import type { AuditAction, AuditEntityType, Prisma } from "@prisma/client";
import { Filter, History } from "lucide-react";
import Link from "@/components/app-link";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { auditActionLabels, auditEntityLabels } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { endOfDateInput, formatDate, parseDateInput } from "@/lib/utils";

type ActivityPageProps = {
  searchParams: Promise<{
    entityType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
};

const auditEntityTypes = Object.keys(auditEntityLabels) as AuditEntityType[];
const auditActions = Object.keys(auditActionLabels) as AuditAction[];

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedEntityType = isAuditEntityType(params.entityType) ? params.entityType : undefined;
  const selectedAction = isAuditAction(params.action) ? params.action : undefined;
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const filters = {
    entityType: selectedEntityType ?? "",
    action: selectedAction ?? "",
    startDate: cleanDate(params.startDate),
    endDate: cleanDate(params.endDate)
  };
  const createdAt: Prisma.DateTimeFilter = {};

  if (filters.startDate) {
    createdAt.gte = parseDateInput(filters.startDate);
  }

  if (filters.endDate) {
    createdAt.lte = endOfDateInput(filters.endDate);
  }

  const where: Prisma.AuditLogWhereInput = {
    userId: user.id,
    ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
    ...(selectedAction ? { action: selectedAction } : {}),
    ...(createdAt.gte || createdAt.lte ? { createdAt } : {})
  };
  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        entityType: true,
        action: true,
        message: true,
        createdAt: true
      }
    }),
    prisma.auditLog.count({ where })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Yönetim"
        title="İşlem Geçmişi"
        description="Düzenleme, silme, arşivleme, iptal ve geri alma kayıtlarını denetleyin."
      />

      <section className="surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <History className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">İşlem Geçmişi</h2>
            <p className="mt-1 text-sm text-slate-500">Düzenleme, silme, arşivleme, iptal ve geri alma kayıtları.</p>
          </div>
        </div>

        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" action="/activity">
          <label className="space-y-1">
            <span className="label">Kayıt Tipi</span>
            <select className="field" name="entityType" defaultValue={filters.entityType}>
              <option value="">Tüm kayıt tipleri</option>
              {auditEntityTypes.map((type) => (
                <option key={type} value={type}>
                  {auditEntityLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">İşlem Türü</span>
            <select className="field" name="action" defaultValue={filters.action}>
              <option value="">Tüm işlemler</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {auditActionLabels[action]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Başlangıç Tarihi</span>
            <input className="field" type="date" name="startDate" defaultValue={filters.startDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Bitiş Tarihi</span>
            <input className="field" type="date" name="endDate" defaultValue={filters.endDate} />
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 xl:flex-none"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link
              href="/activity"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 xl:flex-none"
            >
              Temizle
            </Link>
          </div>
        </form>
      </section>

      {logs.length === 0 ? (
        <section className="surface p-4">
          <EmptyState title="Seçilen filtrelerde işlem kaydı yok" />
        </section>
      ) : (
        <DataTable
          rows={logs}
          empty="İşlem kaydı yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.createdAt) },
            {
              header: "İşlem",
              cell: (row) => <StatusBadge>{auditActionLabels[row.action]}</StatusBadge>
            },
            { header: "Kayıt Tipi", cell: (row) => auditEntityLabels[row.entityType] },
            { header: "Açıklama", cell: (row) => row.message ?? "İşlem kaydı oluşturuldu", className: "font-medium text-slate-950" }
          ]}
        />
      )}

      <Pagination
        page={Math.min(pagination.page, pageCount)}
        totalPages={pageCount}
        totalItems={totalCount}
        pageSize={pagination.pageSize}
        hrefForPage={(page) =>
          createPageHref(
            "/activity",
            {
              entityType: filters.entityType,
              action: filters.action,
              startDate: filters.startDate,
              endDate: filters.endDate
            },
            page
          )
        }
      />
    </div>
  );
}

function isAuditEntityType(value: string | undefined): value is AuditEntityType {
  return auditEntityTypes.includes(value as AuditEntityType);
}

function isAuditAction(value: string | undefined): value is AuditAction {
  return auditActions.includes(value as AuditAction);
}

function cleanDate(value: string | undefined) {
  const next = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}
