import { Prisma } from "@prisma/client";
import { Building2, Download, Eye, Filter, ReceiptText, RotateCcw, Scale } from "lucide-react";
import Link from "@/components/app-link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { RecordCreateButton } from "@/components/record-create-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { requireUser } from "@/lib/auth";
import { appendExpenseFilters, expenseWhereFromFilters, type ExpenseFilters } from "@/lib/expense-query";
import { expenseCategoryLabels, paymentMethodLabels, toOptions } from "@/lib/labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney, formatMoney } from "@/lib/utils";

type ExpensesPageProps = {
  searchParams: Promise<ExpenseFilters & { page?: string }>;
};

const scopeLabels = {
  GENERAL: "Genel gider",
  CASE: "Dosya gideri",
  CLIENT: "Müvekkil gideri"
};
const reimbursableLabels = {
  YES: "Yansıtılabilir",
  NO: "Yansıtılamaz"
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: ExpenseFilters = {
    clientId: params.clientId?.trim() ?? "",
    caseFileId: params.caseFileId?.trim() ?? "",
    category: params.category && params.category in expenseCategoryLabels ? params.category : "",
    scope: params.scope && params.scope in scopeLabels ? params.scope : "",
    reimbursable: params.reimbursable && params.reimbursable in reimbursableLabels ? params.reimbursable : ""
  };
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const where: Prisma.ExpenseWhereInput = { ...expenseWhereFromFilters(filters), userId: user.id };

  const [activeClients, activeCases, activeCashAccounts, filterClients, filterCases, expenses, totalCount, totalExpenseAggregate, reimbursableAggregate, generalAggregate, lastExpense] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    }),
    prisma.client.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: { client: true, caseFile: true, cashAccount: true }
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...where, isClientExpense: true }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...where, clientId: null, caseFileId: null }, _sum: { amount: true } }),
    prisma.expense.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { paymentMethod: true }
    })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);

  const clientOptions = [
    { label: "Genel gider", value: "" },
    ...activeClients.map((client) => ({ label: client.name, value: client.id }))
  ];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...activeCases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}`,
      value: caseFile.id,
      parentValue: caseFile.clientId,
      searchTerms: [caseFile.fileNumber ?? "", caseFile.title]
    }))
  ];
  const cashAccountOptions = [
    { label: "Seçim yapılmazsa Ana Kasa", value: "" },
    ...activeCashAccounts.map((account) => ({
      label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}`,
      value: account.id
    }))
  ];
  const editClientOptions = [
    { label: "Genel gider", value: "" },
    ...filterClients.map((client) => ({
      label: client.archivedAt ? `${client.name} (Arşiv)` : client.name,
      value: client.id
    }))
  ];
  const editCaseOptions = [
    { label: "Dosya yok", value: "" },
    ...filterCases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
      value: caseFile.id
    }))
  ];
  const expenseFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions, section: "advanced" as const },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions, section: "advanced" as const },
    {
      name: "cashAccountId",
      label: "Bu işlem hangi kasaya işlensin?",
      type: "select" as const,
      options: cashAccountOptions,
      hint: "Seçim yapılmazsa varsayılan Ana Kasa kullanılır.",
      section: "advanced" as const
    },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(expenseCategoryLabels) },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    {
      name: "isClientExpense",
      label: "Müvekkile Yansıtılabilir mi?",
      type: "select" as const,
      options: [
        { label: "Hayır", value: "false" },
        { label: "Evet", value: "true" }
      ],
      section: "advanced" as const
    },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2" }
  ];
  const expenseEditFields = expenseFields.map((field) => {
    if (field.name === "clientId") return { ...field, options: editClientOptions };
    if (field.name === "caseFileId") return { ...field, options: editCaseOptions };
    return field;
  });
  const filterClientOptions = [
    { label: "Tüm müvekkiller", value: "" },
    ...filterClients.map((client) => ({
      label: client.archivedAt ? `${client.name} (Arşiv)` : client.name,
      value: client.id
    }))
  ];
  const filterCaseOptions = [
    { label: "Tüm dosyalar", value: "" },
    ...filterCases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
      value: caseFile.id
    }))
  ];
  const totalExpense = formatMoney(totalExpenseAggregate._sum.amount ?? 0);
  const reimbursableExpense = formatMoney(reimbursableAggregate._sum.amount ?? 0);
  const generalExpense = formatMoney(generalAggregate._sum.amount ?? 0);
  const exportParams = new URLSearchParams({ resource: "expenses", format: "csv" });
  appendExpenseFilters(exportParams, filters);
  const exportHref = `/api/export?${exportParams.toString()}`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finans"
        title="Giderler"
        description="Ofis, dosya ve müvekkile yansıtılabilir gider kayıtlarını yönetin."
        actions={
          <RecordCreateButton
            label="Gider Ekle"
            title="Gider Ekle"
            endpoint="/api/expenses"
            schemaKey="expense"
            autoOpenParam="create"
            defaults={{
              clientId: "",
              caseFileId: "",
              cashAccountId: activeCashAccounts.find((account) => account.isDefault)?.id ?? activeCashAccounts[0]?.id ?? "",
              amount: "",
              currency: "TRY",
              date: dateInputValue(),
              paymentMethod: lastExpense?.paymentMethod ?? "BANK_TRANSFER",
              category: "OFFICE",
              isClientExpense: "false",
              description: ""
            }}
            fields={expenseFields}
            successMessage="Gider oluşturuldu."
          />
        }
      />

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]" action="/expenses">
          <label className="space-y-1">
            <span className="label">Müvekkile Göre Filtrele</span>
            <select className="field" name="clientId" defaultValue={filters.clientId}>
              {filterClientOptions.map((option) => (
                <option key={option.value || "all-clients"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Kategori</span>
            <select className="field" name="category" defaultValue={filters.category}>
              {toOptions(expenseCategoryLabels, { label: "Tüm kategoriler", value: "" }).map((option) => (
                <option key={option.value || "all-categories"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Gider Ayrımı</span>
            <select className="field" name="scope" defaultValue={filters.scope}>
              {toOptions(scopeLabels, { label: "Tüm giderler", value: "" }).map((option) => (
                <option key={option.value || "all-scopes"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
              href="/expenses"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 xl:flex-none"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Temizle
            </Link>
          </div>
          <label className="space-y-1 md:col-span-2">
            <span className="label">Dosyaya Göre Filtrele</span>
            <select className="field" name="caseFileId" defaultValue={filters.caseFileId}>
              {filterCaseOptions.map((option) => (
                <option key={option.value || "all-cases"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Yansıtma Durumu</span>
            <select className="field" name="reimbursable" defaultValue={filters.reimbursable}>
              {toOptions(reimbursableLabels, { label: "Tümü", value: "" }).map((option) => (
                <option key={option.value || "all-reimbursable"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <MetricCard title="Toplam Gider" value={totalExpense} detail={`${totalCount} kayıt · ${pagination.pageSize} kayıt / sayfa`} icon={ReceiptText} tone="rose" />
        <MetricCard title="Yansıtılabilir Gider" value={reimbursableExpense} icon={Scale} tone="amber" />
        <MetricCard title="Genel Gider" value={generalExpense} icon={Building2} />
        <Link
          href={exportHref}
          className="surface flex min-h-[96px] items-center justify-center gap-2 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          CSV indir
        </Link>
      </section>

      <DataTable
        rows={expenses}
        empty="Henüz gider yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.date) },
          { header: "Kategori", cell: (row) => expenseCategoryLabels[row.category] },
          { header: "Açıklama", cell: (row) => row.description ?? "-" },
          {
            header: "Tutar",
            cell: (row) => formatDirectionalMoney(row.amount, "OUT", row.currency),
            className: "font-medium tabular-finance text-rose-700"
          },
          { header: "Müvekkil / Dosya", cell: (row) => [row.client?.name, row.caseFile?.title].filter(Boolean).join(" · ") || "Genel gider" },
          {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/expenses/${row.id}`} className="secondary-action min-h-11 px-3">
                  <Eye className="h-4 w-4" aria-hidden />
                  Detay
                </Link>
                <Link href={`/documents/new?linkedExpenseId=${row.id}`} className="secondary-action min-h-11 px-3">
                  Belge bağla
                </Link>
                <RecordEditButton
                  title="Gider Düzenle"
                  endpoint={`/api/expenses/${row.id}`}
                  schemaKey="expense"
                  fields={expenseEditFields}
                  successMessage="Gider güncellendi."
                  defaults={{
                    clientId: row.clientId ?? "",
                    caseFileId: row.caseFileId ?? "",
                    cashAccountId: row.cashAccountId ?? "",
                    amount: row.amount.toString(),
                    currency: row.currency,
                    date: dateInputValue(row.date),
                    paymentMethod: row.paymentMethod,
                    category: row.category,
                    isClientExpense: row.isClientExpense ? "true" : "false",
                    description: row.description ?? ""
                  }}
                />
                <ConfirmActionButton
                  endpoint={`/api/expenses/${row.id}`}
                  label="Sil"
                  title="Gider silinsin mi?"
                  description="Bu gideri silmek istediğinizden emin misiniz? Silinen gider dashboard ve rapor hesaplarından düşecektir."
                  confirmLabel="Sil"
                  successMessage="Gider silindi."
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
        hrefForPage={(page) =>
          createPageHref(
            "/expenses",
            {
              clientId: filters.clientId,
              caseFileId: filters.caseFileId,
              category: filters.category,
              scope: filters.scope,
              reimbursable: filters.reimbursable
            },
            page
          )
        }
      />
    </div>
  );
}
