import { Prisma } from "@prisma/client";
import { Download, Eye, Filter, HandCoins } from "lucide-react";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { RecordCreateButton } from "@/components/record-create-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { requireUser } from "@/lib/auth";
import { appendCollectionFilters, collectionWhereFromFilters, type CollectionFilters } from "@/lib/collection-query";
import { incomeCategoryLabels, paymentMethodLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney, formatMoney } from "@/lib/utils";

type CollectionsPageProps = {
  searchParams: Promise<CollectionFilters>;
};

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: CollectionFilters = {
    startDate: params.startDate?.trim() ?? "",
    endDate: params.endDate?.trim() ?? "",
    clientId: params.clientId?.trim() ?? "",
    caseFileId: params.caseFileId?.trim() ?? "",
    category:
      params.category && params.category in incomeCategoryLabels
        ? params.category
        : ""
  };
  const where: Prisma.IncomeWhereInput = { ...collectionWhereFromFilters(filters), userId: user.id };

  const [activeClients, activeCases, activeCashAccounts, filterClients, filterCases, collections] = await Promise.all([
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
    prisma.income.findMany({
      where,
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true, cashAccount: true }
    })
  ]);

  const clientOptions = [
    { label: "Seçiniz", value: "" },
    ...activeClients.map((client) => ({ label: client.name, value: client.id }))
  ];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...activeCases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}`,
      value: caseFile.id
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
    { label: "Seçiniz", value: "" },
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
  const collectionFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions },
    {
      name: "cashAccountId",
      label: "Bu işlem hangi kasaya işlensin?",
      type: "select" as const,
      options: cashAccountOptions,
      hint: "Seçim yapılmazsa varsayılan Ana Kasa kullanılır."
    },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "currency", label: "Para Birimi" },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels) },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(incomeCategoryLabels) },
    {
      name: "receiptIssued",
      label: "Makbuz Kesildi mi?",
      type: "select" as const,
      options: [
        { label: "Hayır", value: "false" },
        { label: "Evet", value: "true" }
      ]
    },
    { name: "receiptNumber", label: "Makbuz Numarası" },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" }
  ];
  const collectionEditFields = collectionFields.map((field) => {
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
  const totalsByCurrency = collections.reduce((totals, row) => {
    const current = totals.get(row.currency) ?? new Prisma.Decimal(0);
    totals.set(row.currency, current.plus(row.amount));
    return totals;
  }, new Map<string, Prisma.Decimal>());
  const totalText =
    Array.from(totalsByCurrency.entries())
      .map(([currency, amount]) => formatMoney(amount, currency))
      .join(" · ") || formatMoney(0);
  const exportParams = new URLSearchParams({ resource: "collections", format: "csv" });
  appendCollectionFilters(exportParams, filters);
  const exportHref = `/api/export?${exportParams.toString()}`;

  return (
    <div className="space-y-5">
      <section className="surface-dark flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">Mobil tahsilat girişi</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Tahsilatlar</h1>
          <p className="mt-2 text-sm text-slate-300">Müvekkil, dosya ve kasa hesabına bağlı gelir kayıtları.</p>
        </div>
        <RecordCreateButton
          label="Tahsilat Ekle"
          title="Tahsilat Ekle"
          endpoint="/api/collections"
          schemaKey="collection"
          autoOpenParam="create"
          defaults={{
            clientId: "",
            caseFileId: "",
            cashAccountId: "",
            amount: "",
            currency: "TRY",
            date: dateInputValue(),
            paymentMethod: "BANK_TRANSFER",
            category: "LEGAL_FEE",
            description: "",
            receiptIssued: "false",
            receiptNumber: ""
          }}
          fields={collectionFields}
          successMessage="Tahsilat oluşturuldu."
        />
      </section>

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" action="/collections">
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
            <span className="label">Kategori</span>
            <select className="field" name="category" defaultValue={filters.category}>
              {toOptions(incomeCategoryLabels, { label: "Tüm kategoriler", value: "" }).map((option) => (
                <option key={option.value || "all-categories"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 xl:flex-none"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link
              href="/collections"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 xl:flex-none"
            >
              Temizle
            </Link>
          </div>
          <label className="space-y-1 md:col-span-2 xl:col-span-4">
            <span className="label">Dosya</span>
            <select className="field" name="caseFileId" defaultValue={filters.caseFileId}>
              {filterCaseOptions.map((option) => (
                <option key={option.value || "all-cases"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <MetricCard
          title="Filtrelenen Toplam Tahsilat"
          value={totalText}
          detail={`${collections.length} kayıt`}
          icon={HandCoins}
          tone="green"
        />
        <Link
          href={exportHref}
          className="surface flex min-h-[96px] items-center justify-center gap-2 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          CSV indir
        </Link>
      </section>

      <DataTable
        rows={collections}
        empty="Henüz tahsilat yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.date) },
          { header: "Müvekkil", cell: (row) => row.client.name },
          { header: "Dosya", cell: (row) => row.caseFile?.title ?? "-" },
          { header: "Kategori", cell: (row) => incomeCategoryLabels[row.category] },
          { header: "Açıklama", cell: (row) => row.description ?? "-" },
          {
            header: "Tutar",
            cell: (row) => formatDirectionalMoney(row.amount, "IN", row.currency),
            className: "font-medium tabular-finance text-emerald-700"
          },
          { header: "Yöntem", cell: (row) => paymentMethodLabels[row.paymentMethod] },
          { header: "Kasa", cell: (row) => row.cashAccount?.name ?? "Ana Kasa" },
          { header: "Belge", cell: (row) => row.receiptNumber ?? (row.receiptIssued ? "Kesildi" : "-") },
          {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/collections/${row.id}`} className="secondary-action min-h-10 px-3">
                  <Eye className="h-4 w-4" aria-hidden />
                  Detay
                </Link>
                <RecordEditButton
                  title="Tahsilat Düzenle"
                  endpoint={`/api/collections/${row.id}`}
                  schemaKey="collection"
                  fields={collectionEditFields}
                  successMessage="Tahsilat güncellendi."
                  defaults={{
                    clientId: row.clientId,
                    caseFileId: row.caseFileId ?? "",
                    cashAccountId: row.cashAccountId ?? "",
                    amount: row.amount.toString(),
                    currency: row.currency,
                    date: dateInputValue(row.date),
                    paymentMethod: row.paymentMethod,
                    category: row.category,
                    description: row.description ?? "",
                    receiptIssued: row.receiptIssued ? "true" : "false",
                    receiptNumber: row.receiptNumber ?? ""
                  }}
                />
                <ConfirmActionButton
                  endpoint={`/api/collections/${row.id}`}
                  label="Sil"
                  title="Tahsilat silinsin mi?"
                  description="Bu tahsilatı silmek istediğinizden emin misiniz? Silinen tahsilat dashboard ve rapor hesaplarından düşecektir."
                  confirmLabel="Sil"
                  successMessage="Tahsilat silindi."
                />
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
