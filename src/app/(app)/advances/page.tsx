import { Prisma } from "@prisma/client";
import { Banknote, Eye, FilePlus2, Filter } from "lucide-react";
import Link from "@/components/app-link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { RecordCreateDrawerButton } from "@/components/record-create-drawer-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { advanceDirectionLabels, incomeCategoryLabels, paymentMethodLabels, toOptions } from "@/lib/labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney, formatMoney, toNumber } from "@/lib/utils";

type AdvanceDirection = keyof typeof advanceDirectionLabels;
type AdvanceSource = "INCOME" | "EXPENSE";
type DocumentStatusFilter = "" | "WITH_DOCUMENT" | "MISSING_DOCUMENT";
type AdvanceSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

type AdvanceFilters = {
  startDate: string;
  endDate: string;
  clientId: string;
  caseFileId: string;
  direction: "" | AdvanceDirection;
  minAmount: string;
  maxAmount: string;
  documentStatus: DocumentStatusFilter;
  sort: AdvanceSort;
};

type AdvanceRow = {
  id: string;
  source: AdvanceSource;
  date: Date;
  clientId: string;
  client: string;
  caseFileId: string;
  caseFile: string;
  description: string;
  direction: AdvanceDirection;
  amount: Prisma.Decimal;
  amountValue: number;
  currency: string;
  paymentMethod: keyof typeof paymentMethodLabels;
  hasDocument: boolean;
  detailHref: string;
  documentUploadHref: string;
};

type AdvancesPageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    startDate?: string;
    endDate?: string;
    clientId?: string;
    caseFileId?: string;
    direction?: string;
    minAmount?: string;
    maxAmount?: string;
    documentStatus?: string;
    sort?: string;
  }>;
};

const documentStatusLabels: Record<Exclude<DocumentStatusFilter, "">, string> = {
  WITH_DOCUMENT: "Belgesi var",
  MISSING_DOCUMENT: "Belgesiz"
};

const sortLabels: Record<AdvanceSort, string> = {
  "date-desc": "En yeni",
  "date-asc": "En eski",
  "amount-desc": "Tutar yüksek",
  "amount-asc": "Tutar düşük"
};

export default async function AdvancesPage({ searchParams }: AdvancesPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseAdvanceFilters(params);
  const pagination = parsePagination({ page: params.page, pageSize: params.pageSize }, { pageSize: 25, maxPageSize: 100 });
  const includeReceived = filters.direction !== "SPENT";
  const includeSpent = filters.direction !== "RECEIVED";
  const baseReceivedWhere = baseReceivedAdvanceWhere(user.id);
  const baseSpentWhere = baseSpentAdvanceWhere(user.id);
  const receivedWhere = includeReceived ? applyIncomeFilters(baseReceivedWhere, filters) : neverIncomeWhere(user.id);
  const spentWhere = includeSpent ? applyExpenseFilters(baseSpentWhere, filters) : neverExpenseWhere(user.id);
  const orderBy = orderByForSort(filters.sort);

  const [
    clients,
    cases,
    receivedAdvances,
    spentAdvances,
    receivedCount,
    spentCount,
    totalReceived,
    totalSpent
  ] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.income.findMany({
      where: receivedWhere,
      orderBy,
      include: { client: true, caseFile: true, attachedDocuments: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
      take: pagination.pageSize * pagination.page
    }),
    prisma.expense.findMany({
      where: spentWhere,
      orderBy,
      include: { client: true, caseFile: true, attachedDocuments: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
      take: pagination.pageSize * pagination.page
    }),
    prisma.income.count({ where: receivedWhere }),
    prisma.expense.count({ where: spentWhere }),
    prisma.income.aggregate({ where: baseReceivedWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: baseSpentWhere, _sum: { amount: true } })
  ]);

  const totalCount = receivedCount + spentCount;
  const pageCount = totalPages(totalCount, pagination.pageSize);
  const rows = [
    ...receivedAdvances.map((row): AdvanceRow => ({
      id: row.id,
      source: "INCOME",
      date: row.date,
      clientId: row.clientId,
      client: row.client.name,
      caseFileId: row.caseFileId ?? "",
      caseFile: row.caseFile?.title ?? "-",
      description: row.description ?? "-",
      direction: "RECEIVED",
      amount: row.amount,
      amountValue: toNumber(row.amount),
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      hasDocument: row.attachedDocuments.length > 0,
      detailHref: `/collections/${row.id}`,
      documentUploadHref: `/documents/new?linkedIncomeId=${row.id}`
    })),
    ...spentAdvances.map((row): AdvanceRow => ({
      id: row.id,
      source: "EXPENSE",
      date: row.date,
      clientId: row.clientId ?? "",
      client: row.client?.name ?? "-",
      caseFileId: row.caseFileId ?? "",
      caseFile: row.caseFile?.title ?? "-",
      description: row.description ?? "-",
      direction: "SPENT",
      amount: row.amount,
      amountValue: toNumber(row.amount),
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      hasDocument: row.attachedDocuments.length > 0,
      detailHref: `/expenses/${row.id}`,
      documentUploadHref: `/documents/new?linkedExpenseId=${row.id}`
    }))
  ].sort((a, b) => compareAdvanceRows(a, b, filters.sort)).slice(pagination.skip, pagination.skip + pagination.take);

  const clientOptions = [
    { label: "Seçiniz", value: "" },
    ...clients.map((client) => ({ label: client.name, value: client.id }))
  ];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...cases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}`,
      value: caseFile.id
    }))
  ];
  const filterClientOptions = [{ label: "Tüm müvekkiller", value: "" }, ...clientOptions.slice(1)];
  const filterCaseOptions = [{ label: "Tüm dosyalar", value: "" }, ...caseOptions.slice(1)];
  const advanceFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01", highlightWhen: { field: "direction", values: ["RECEIVED", "SPENT"] } },
    {
      name: "direction",
      label: "Yön",
      type: "select" as const,
      options: [
        { label: "Alındı", value: "RECEIVED" },
        { label: "Harcandı", value: "SPENT" }
      ]
    },
    { name: "occurredAt", label: "Tarih", type: "date" as const, section: "advanced" as const },
    { name: "description", label: "Açıklama", placeholder: "Masraf avansı, harç kullanımı, bilirkişi ödemesi..." },
    {
      name: "notes",
      label: "Not",
      type: "textarea" as const,
      section: "advanced" as const,
      className: "md:col-span-2 xl:col-span-3",
      hint: "Belgeyi kayıt oluştuktan sonra satırdaki Belge bağla aksiyonuyla ekleyebilirsiniz."
    }
  ];
  const receivedEditFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    { name: "cashAccountId", label: "Kasa hesabı", type: "select" as const, options: [{ label: "Değiştirme", value: "" }], section: "advanced" as const },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "date", label: "Tarih", type: "date" as const, section: "advanced" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    { name: "category", label: "Kategori", type: "select" as const, options: [{ label: incomeCategoryLabels.ADVANCE, value: "ADVANCE" }], section: "advanced" as const },
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
  const spentEditFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    { name: "cashAccountId", label: "Kasa hesabı", type: "select" as const, options: [{ label: "Değiştirme", value: "" }], section: "advanced" as const },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "date", label: "Tarih", type: "date" as const, section: "advanced" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    { name: "category", label: "Kategori", type: "select" as const, options: [{ label: "Diğer", value: "OTHER" }], section: "advanced" as const },
    { name: "isClientExpense", label: "Müvekkile Yansıtılabilir mi?", type: "select" as const, options: [{ label: "Evet", value: "true" }], section: "advanced" as const }
  ];
  const receivedTotalAmount = totalReceived._sum.amount ?? new Prisma.Decimal(0);
  const spentTotalAmount = totalSpent._sum.amount ?? new Prisma.Decimal(0);
  const availableBalance = receivedTotalAmount.minus(spentTotalAmount);
  const filterParams = filterParamsForHref(filters, pagination.pageSize);
  const pdfHref = createAdvancePdfHref(filters);

  return (
    <div className="space-y-5" data-testid="advances-content-ready">
      <PageHeader
        eyebrow="Finans"
        title="Masraf Avansları"
        description="Müvekkil ve dosya bazlı alınan ve harcanan masraf avanslarının takibi."
        actions={
          <>
            <PdfDownloadButton href={pdfHref} label="PDF Rapor" className="justify-center px-4" />
            <RecordCreateDrawerButton
              label="Avans Hareketi Ekle"
              title="Avans Hareketi Ekle"
              description="Müvekkil ve dosya bazlı masraf avansı alın veya harcanan avansı kaydedin."
              endpoint="/api/advances"
              schemaKey="advance"
              autoOpenParam="create"
              defaults={{
                clientId: "",
                caseFileId: "",
                description: "",
                amount: "",
                direction: "RECEIVED",
                occurredAt: dateInputValue(),
                notes: ""
              }}
              fields={advanceFields}
              submitLabel="Avans hareketi kaydet"
              successMessage="Avans hareketi oluşturuldu."
            />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Toplam Alınan" value={formatMoney(receivedTotalAmount)} detail="Masraf avansı girişi" icon={Banknote} tone="green" />
        <MetricCard title="Toplam Harcanan" value={formatMoney(spentTotalAmount)} detail="Yansıtılabilir kullanım" icon={Banknote} tone="rose" />
        <MetricCard title="Kullanılabilir Bakiye" value={formatMoney(availableBalance)} detail="Alınan - harcanan" icon={Banknote} tone={availableBalance.gte(0) ? "green" : "rose"} />
      </section>

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" action="/advances">
          <label className="space-y-1">
            <span className="label">Başlangıç Tarihi</span>
            <input className="field" type="date" name="startDate" defaultValue={filters.startDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Bitiş Tarihi</span>
            <input className="field" type="date" name="endDate" defaultValue={filters.endDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Müvekkil</span>
            <select className="field" name="clientId" defaultValue={filters.clientId}>
              {filterClientOptions.map((option) => (
                <option key={option.value || "all-clients"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Dosya</span>
            <select className="field" name="caseFileId" defaultValue={filters.caseFileId}>
              {filterCaseOptions.map((option) => (
                <option key={option.value || "all-cases"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Yön</span>
            <select className="field" name="direction" defaultValue={filters.direction}>
              <option value="">Tüm hareketler</option>
              <option value="RECEIVED">Alındı</option>
              <option value="SPENT">Harcandı</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Belge</span>
            <select className="field" name="documentStatus" defaultValue={filters.documentStatus}>
              <option value="">Tümü</option>
              <option value="WITH_DOCUMENT">{documentStatusLabels.WITH_DOCUMENT}</option>
              <option value="MISSING_DOCUMENT">{documentStatusLabels.MISSING_DOCUMENT}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Min. Tutar</span>
            <input className="field" type="number" min="0" step="0.01" name="minAmount" defaultValue={filters.minAmount} />
          </label>
          <label className="space-y-1">
            <span className="label">Maks. Tutar</span>
            <input className="field" type="number" min="0" step="0.01" name="maxAmount" defaultValue={filters.maxAmount} />
          </label>
          <label className="space-y-1">
            <span className="label">Sıralama</span>
            <select className="field" name="sort" defaultValue={filters.sort}>
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Sayfa Boyutu</span>
            <select className="field" name="pageSize" defaultValue={String(pagination.pageSize)}>
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} kayıt
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button className="primary-action min-h-11 w-full justify-center" type="submit">
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link href="/advances" className="secondary-action min-h-11 justify-center px-4">
              Temizle
            </Link>
          </div>
        </form>
      </section>

      <DataTable
        rows={rows}
        empty="Henüz masraf avansı hareketi yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.date) },
          { header: "Müvekkil", cell: (row) => row.client },
          { header: "Açıklama", cell: (row) => row.description },
          {
            header: "Yön",
            cell: (row) => (
              <StatusBadge tone={row.direction === "RECEIVED" ? "green" : "rose"}>
                {row.direction === "RECEIVED" ? "Alındı" : "Harcandı"}
              </StatusBadge>
            )
          },
          {
            header: "Tutar",
            cell: (row) => formatDirectionalMoney(row.amount, row.direction === "RECEIVED" ? "IN" : "OUT", row.currency),
            className: "text-right font-semibold tabular-finance"
          },
          {
            header: "İşlemler",
            cell: (row) => (
              <div className="contents">
                <Link href={row.detailHref} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Eye className="h-4 w-4" aria-hidden />
                  Görüntüle
                </Link>
                {row.source === "INCOME" ? (
                  <RecordEditButton
                    title="Avans Girişi Düzenle"
                    endpoint={`/api/collections/${row.id}`}
                    schemaKey="collection"
                    fields={receivedEditFields}
                    successMessage="Avans girişi güncellendi."
                    defaults={{
                      clientId: row.clientId,
                      caseFileId: row.caseFileId,
                      cashAccountId: "",
                      amount: row.amount.toString(),
                      currency: row.currency,
                      date: dateInputValue(row.date),
                      paymentMethod: row.paymentMethod,
                      category: "ADVANCE",
                      description: row.description === "-" ? "" : row.description,
                      receiptIssued: "false",
                      receiptNumber: ""
                    }}
                  />
                ) : (
                  <RecordEditButton
                    title="Avans Kullanımı Düzenle"
                    endpoint={`/api/expenses/${row.id}`}
                    schemaKey="expense"
                    fields={spentEditFields}
                    successMessage="Avans kullanımı güncellendi."
                    defaults={{
                      clientId: row.clientId,
                      caseFileId: row.caseFileId,
                      cashAccountId: "",
                      amount: row.amount.toString(),
                      currency: row.currency,
                      date: dateInputValue(row.date),
                      paymentMethod: row.paymentMethod,
                      category: "OTHER",
                      isClientExpense: "true",
                      description: row.description === "-" ? "" : row.description
                    }}
                  />
                )}
                <Link href={row.documentUploadHref} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <FilePlus2 className="h-4 w-4" aria-hidden />
                  Belge bağla
                </Link>
                <ConfirmActionButton
                  endpoint={row.source === "INCOME" ? `/api/collections/${row.id}` : `/api/expenses/${row.id}`}
                  label="Sil"
                  title="Avans hareketi silinsin mi?"
                  description="Bu avans hareketi normal listeden kaldırılır ve ilgili finans hesaplarından düşer."
                  confirmLabel="Sil"
                  successMessage="Avans hareketi silindi."
                />
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
        hrefForPage={(page) => createPageHref("/advances", filterParams, page)}
      />
    </div>
  );
}

function parseAdvanceFilters(params: Awaited<AdvancesPageProps["searchParams"]>): AdvanceFilters {
  return {
    startDate: params.startDate?.trim() ?? "",
    endDate: params.endDate?.trim() ?? "",
    clientId: params.clientId?.trim() ?? "",
    caseFileId: params.caseFileId?.trim() ?? "",
    direction: params.direction === "RECEIVED" || params.direction === "SPENT" ? params.direction : "",
    minAmount: params.minAmount?.trim() ?? "",
    maxAmount: params.maxAmount?.trim() ?? "",
    documentStatus: params.documentStatus === "WITH_DOCUMENT" || params.documentStatus === "MISSING_DOCUMENT" ? params.documentStatus : "",
    sort: isAdvanceSort(params.sort) ? params.sort : "date-desc"
  };
}

function baseReceivedAdvanceWhere(userId: string): Prisma.IncomeWhereInput {
  return {
    userId,
    deletedAt: null,
    category: "ADVANCE",
    client: { archivedAt: null, deletedAt: null },
    OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
  };
}

function baseSpentAdvanceWhere(userId: string): Prisma.ExpenseWhereInput {
  return {
    userId,
    deletedAt: null,
    isClientExpense: true,
    AND: [
      { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
      { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
    ]
  };
}

function applyIncomeFilters(baseWhere: Prisma.IncomeWhereInput, filters: AdvanceFilters): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = { ...baseWhere };
  const andFilters: Prisma.IncomeWhereInput[] = [];
  const date = dateFilter(filters);
  const amount = amountFilter(filters);

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.caseFileId) where.caseFileId = filters.caseFileId;
  if (date) where.date = date;
  if (amount) where.amount = amount;
  if (filters.documentStatus === "WITH_DOCUMENT") andFilters.push({ attachedDocuments: { some: { deletedAt: null } } });
  if (filters.documentStatus === "MISSING_DOCUMENT") {
    andFilters.push({ attachedDocuments: { none: { deletedAt: null } }, documentNotRequired: false });
  }

  return appendAndFilters(where, andFilters);
}

function applyExpenseFilters(baseWhere: Prisma.ExpenseWhereInput, filters: AdvanceFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { ...baseWhere };
  const andFilters: Prisma.ExpenseWhereInput[] = [];
  const date = dateFilter(filters);
  const amount = amountFilter(filters);

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.caseFileId) where.caseFileId = filters.caseFileId;
  if (date) where.date = date;
  if (amount) where.amount = amount;
  if (filters.documentStatus === "WITH_DOCUMENT") andFilters.push({ attachedDocuments: { some: { deletedAt: null } } });
  if (filters.documentStatus === "MISSING_DOCUMENT") {
    andFilters.push({ attachedDocuments: { none: { deletedAt: null } }, documentNotRequired: false });
  }

  return appendAndFilters(where, andFilters);
}

function appendAndFilters<T extends { AND?: unknown }>(where: T, andFilters: T[]) {
  if (andFilters.length === 0) return where;
  const existing = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  return { ...where, AND: [...existing, ...andFilters] };
}

function neverIncomeWhere(userId: string): Prisma.IncomeWhereInput {
  return { userId, id: "__never__" };
}

function neverExpenseWhere(userId: string): Prisma.ExpenseWhereInput {
  return { userId, id: "__never__" };
}

function dateFilter(filters: AdvanceFilters): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (filters.startDate) range.gte = new Date(`${filters.startDate}T00:00:00.000`);
  if (filters.endDate) range.lte = new Date(`${filters.endDate}T23:59:59.999`);
  return Object.keys(range).length > 0 ? range : undefined;
}

function amountFilter(filters: AdvanceFilters): Prisma.DecimalFilter | undefined {
  const range: Prisma.DecimalFilter = {};
  if (filters.minAmount) range.gte = filters.minAmount;
  if (filters.maxAmount) range.lte = filters.maxAmount;
  return Object.keys(range).length > 0 ? range : undefined;
}

function orderByForSort(sort: AdvanceSort): Prisma.IncomeOrderByWithRelationInput {
  if (sort === "date-asc") return { date: "asc" };
  if (sort === "amount-desc") return { amount: "desc" };
  if (sort === "amount-asc") return { amount: "asc" };
  return { date: "desc" };
}

function compareAdvanceRows(a: AdvanceRow, b: AdvanceRow, sort: AdvanceSort) {
  if (sort === "date-asc") return a.date.getTime() - b.date.getTime();
  if (sort === "amount-desc") return b.amountValue - a.amountValue;
  if (sort === "amount-asc") return a.amountValue - b.amountValue;
  return b.date.getTime() - a.date.getTime();
}

function filterParamsForHref(filters: AdvanceFilters, pageSize: number) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    clientId: filters.clientId,
    caseFileId: filters.caseFileId,
    direction: filters.direction,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    documentStatus: filters.documentStatus,
    sort: filters.sort,
    pageSize: pageSize === 25 ? undefined : String(pageSize)
  };
}

function createAdvancePdfHref(filters: AdvanceFilters) {
  const params = new URLSearchParams();
  const entries = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    clientId: filters.clientId,
    caseFileId: filters.caseFileId,
    direction: filters.direction,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    documentStatus: filters.documentStatus
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/api/reports/advances/pdf?${query}` : "/api/reports/advances/pdf";
}

function isAdvanceSort(value: string | undefined): value is AdvanceSort {
  return value === "date-desc" || value === "date-asc" || value === "amount-desc" || value === "amount-asc";
}
