import Link from "@/components/app-link";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { RestoreRecordButton } from "@/components/restore-record-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { documentTypeLabels } from "@/lib/document-labels";
import {
  assetTypeLabels,
  caseStatusLabels,
  cashAccountTypeLabels,
  clientTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  reminderPriorityLabels,
  reminderStatusLabels,
  reminderTypeLabels,
  receiptStatusLabels,
  receiptTypeLabels
} from "@/lib/labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { getDeletedRecords } from "@/lib/restore-service";
import { formatDate, formatMoney } from "@/lib/utils";

type DeletedRecordsPageProps = {
  searchParams: Promise<{ tab?: string; page?: string }>;
};

const deletedTabs = [
  { key: "clients", label: "Müvekkiller" },
  { key: "cases", label: "Dosyalar" },
  { key: "incomes", label: "Tahsilatlar" },
  { key: "expenses", label: "Giderler" },
  { key: "receipts", label: "Makbuz/Fatura" },
  { key: "documents", label: "Belgeler" },
  { key: "bank-imports", label: "Banka Ekstreleri" },
  { key: "cash-accounts", label: "Kasa Hesapları" },
  { key: "reminders", label: "Hatırlatmalar" },
  { key: "assets", label: "Sermaye" }
] as const;

type DeletedTabKey = (typeof deletedTabs)[number]["key"];

export default async function DeletedRecordsPage({ searchParams }: DeletedRecordsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const activeTab = isDeletedTab(params.tab) ? params.tab : "clients";
  const pagination = parsePagination(params, { pageSize: 25 });
  const records = await getDeletedRecords(user.id);
  const tabCounts: Record<DeletedTabKey, number> = {
    clients: records.clients.length,
    cases: records.caseFiles.length,
    incomes: records.incomes.length,
    expenses: records.expenses.length,
    receipts: records.invoiceOrReceipts.length,
    documents: records.documents.length,
    "bank-imports": records.bankStatementImports.length,
    "cash-accounts": records.cashAccounts.length,
    reminders: records.taskReminders.length,
    assets: records.assetAccounts.length
  };
  const activeTotal = tabCounts[activeTab];
  const pageCount = totalPages(activeTotal, pagination.pageSize);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Geri alma altyapısı"
        title="Silinen Kayıtlar"
        description="Yanlışlıkla silinen kayıtları geri alabilirsiniz. Bağlı müvekkil veya dosya silinmişse önce bağlı kaydı geri almak gerekir."
      />

      <nav className="surface scroll-x-stable p-2" aria-label="Silinen kayıt sekmeleri">
        <div className="flex min-w-max gap-2">
          {deletedTabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={`/settings/deleted-records?tab=${tab.key}`}
                className={
                  active
                    ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {tab.label}
                <span className={active ? "text-xs text-slate-300" : "text-xs text-slate-500"}>{tabCounts[tab.key]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {activeTab === "clients" ? (
        <DataTable
          rows={paginateRows(records.clients, pagination)}
          empty="Silinen müvekkil yok"
          columns={[
            { header: "Müvekkil", cell: (row) => row.name, className: "font-medium text-slate-950" },
            { header: "Tür", cell: (row) => clientTypeLabels[row.type] },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/clients/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "cases" ? (
        <DataTable
          rows={paginateRows(records.caseFiles, pagination)}
          empty="Silinen dosya yok"
          columns={[
            { header: "Dosya", cell: (row) => row.title, className: "font-medium text-slate-950" },
            { header: "Dosya No", cell: (row) => row.fileNumber ?? "-" },
            {
              header: "Müvekkil",
              cell: (row) => (
                <ParentState name={row.client.name} deleted={Boolean(row.client.deletedAt)} archived={Boolean(row.client.archivedAt)} />
              )
            },
            { header: "Durum", cell: (row) => caseStatusLabels[row.status] },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/cases/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "incomes" ? (
        <DataTable
          rows={paginateRows(records.incomes, pagination)}
          empty="Silinen tahsilat yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.date) },
            {
              header: "Müvekkil",
              cell: (row) => <ParentState name={row.client.name} deleted={Boolean(row.client.deletedAt)} archived={Boolean(row.client.archivedAt)} />
            },
            { header: "Dosya", cell: (row) => <CaseParentState caseFile={row.caseFile} /> },
            { header: "Kategori", cell: (row) => incomeCategoryLabels[row.category] },
            { header: "Tutar", cell: (row) => formatMoney(row.amount, row.currency), className: "font-medium text-slate-950" },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/incomes/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "expenses" ? (
        <DataTable
          rows={paginateRows(records.expenses, pagination)}
          empty="Silinen gider yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.date) },
            {
              header: "Müvekkil",
              cell: (row) =>
                row.client ? <ParentState name={row.client.name} deleted={Boolean(row.client.deletedAt)} archived={Boolean(row.client.archivedAt)} /> : "-"
            },
            { header: "Dosya", cell: (row) => <CaseParentState caseFile={row.caseFile} /> },
            { header: "Kategori", cell: (row) => expenseCategoryLabels[row.category] },
            { header: "Yansıtma", cell: (row) => (row.isClientExpense ? "Yansıtılabilir" : "Hayır") },
            { header: "Tutar", cell: (row) => formatMoney(row.amount, row.currency), className: "font-medium text-slate-950" },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/expenses/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "receipts" ? (
        <DataTable
          rows={paginateRows(records.invoiceOrReceipts, pagination)}
          empty="Silinen makbuz/fatura kaydı yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.issueDate) },
            { header: "Belge No", cell: (row) => row.number, className: "font-medium text-slate-950" },
            {
              header: "Müvekkil",
              cell: (row) => <ParentState name={row.client.name} deleted={Boolean(row.client.deletedAt)} archived={Boolean(row.client.archivedAt)} />
            },
            { header: "Dosya", cell: (row) => <CaseParentState caseFile={row.caseFile} /> },
            { header: "Tür", cell: (row) => receiptTypeLabels[row.type] },
            { header: "Durum", cell: (row) => receiptStatusLabels[row.status] },
            { header: "Net", cell: (row) => formatMoney(row.netAmount), className: "font-medium text-slate-950" },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/receipts/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "documents" ? (
        <DataTable
          rows={paginateRows(records.documents, pagination)}
          empty="Silinen belge yok"
          columns={[
            { header: "Belge", cell: (row) => row.title, className: "font-medium text-slate-950" },
            { header: "Tür", cell: (row) => documentTypeLabels[row.documentType] },
            { header: "Dosya", cell: (row) => row.originalFileName },
            {
              header: "Bağlı Kayıt",
              cell: (row) =>
                row.linkedClient ? (
                  <ParentState name={row.linkedClient.name} deleted={Boolean(row.linkedClient.deletedAt)} archived={Boolean(row.linkedClient.archivedAt)} />
                ) : row.linkedCaseFile ? (
                  <CaseParentState caseFile={row.linkedCaseFile} />
                ) : (
                  "-"
                )
            },
            { header: "Boyut", cell: (row) => formatFileSize(row.fileSize) },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/documents/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "bank-imports" ? (
        <DataTable
          rows={paginateRows(records.bankStatementImports, pagination)}
          empty="Silinen banka ekstresi importu yok"
          columns={[
            { header: "Banka", cell: (row) => row.bankName, className: "font-medium text-slate-950" },
            { header: "Dosya", cell: (row) => row.originalFileName },
            { header: "Kaynak", cell: (row) => row.sourceType },
            { header: "Satır", cell: (row) => `${row.successfulRows}/${row.totalRows}` },
            { header: "Kasa", cell: (row) => row.cashAccount?.name ?? "-" },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/bank-imports/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "cash-accounts" ? (
        <DataTable
          rows={paginateRows(records.cashAccounts, pagination)}
          empty="Silinen kasa hesabı yok"
          columns={[
            { header: "Hesap", cell: (row) => row.name, className: "font-medium text-slate-950" },
            { header: "Tür", cell: (row) => cashAccountTypeLabels[row.type] },
            { header: "Para Birimi", cell: (row) => row.currency },
            { header: "Varsayılan", cell: (row) => (row.isDefault ? "Evet" : "Hayır") },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/cash-accounts/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "reminders" ? (
        <DataTable
          rows={paginateRows(records.taskReminders, pagination)}
          empty="Silinen hatırlatma yok"
          columns={[
            { header: "Başlık", cell: (row) => row.title, className: "font-medium text-slate-950" },
            { header: "Tür", cell: (row) => reminderTypeLabels[row.reminderType] },
            { header: "Durum", cell: (row) => reminderStatusLabels[row.status] },
            { header: "Öncelik", cell: (row) => reminderPriorityLabels[row.priority] },
            { header: "Vade", cell: (row) => formatDate(row.dueDate) },
            { header: "Tutar", cell: (row) => (row.amount ? formatMoney(row.amount, row.currency) : "-") },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/reminders/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      {activeTab === "assets" ? (
        <DataTable
          rows={paginateRows(records.assetAccounts, pagination)}
          empty="Silinen sermaye varlığı yok"
          columns={[
            { header: "Varlık", cell: (row) => row.name, className: "font-medium text-slate-950" },
            { header: "Tür", cell: (row) => assetTypeLabels[row.assetType] },
            { header: "Sembol", cell: (row) => row.symbol || row.currency || "-" },
            { header: "Değer", cell: (row) => (row.manualTotalValue ? formatMoney(row.manualTotalValue, row.valuationCurrency) : "-") },
            { header: "Bağlı Kasa", cell: (row) => row.linkedCashAccount?.name ?? "-" },
            { header: "Silinme Tarihi", cell: (row) => formatDate(row.deletedAt) },
            {
              header: "İşlem",
              cell: (row) => <RestoreRecordButton endpoint={`/api/deleted-records/assets/${row.id}/restore`} />
            }
          ]}
        />
      ) : null}

      <Pagination
        page={pagination.page}
        totalPages={pageCount}
        totalItems={activeTotal}
        pageSize={pagination.pageSize}
        hrefForPage={(page) => createPageHref("/settings/deleted-records", { tab: activeTab }, page)}
      />
    </div>
  );
}

function paginateRows<T>(rows: T[], pagination: { skip: number; pageSize: number }) {
  return rows.slice(pagination.skip, pagination.skip + pagination.pageSize);
}

function ParentState({ name, deleted, archived }: { name: string; deleted: boolean; archived: boolean }) {
  return (
    <div className="flex min-w-[160px] flex-wrap items-center gap-2">
      <span>{name}</span>
      {deleted ? <StatusBadge tone="rose">Silinmiş</StatusBadge> : archived ? <StatusBadge tone="amber">Arşiv</StatusBadge> : null}
    </div>
  );
}

function CaseParentState({
  caseFile
}: {
  caseFile: { title: string; status: string; archivedAt: Date | null; deletedAt: Date | null } | null;
}) {
  if (!caseFile) {
    return "-";
  }

  return (
    <ParentState
      name={caseFile.title}
      deleted={Boolean(caseFile.deletedAt)}
      archived={Boolean(caseFile.archivedAt) || caseFile.status === "ARCHIVED"}
    />
  );
}

function isDeletedTab(value: string | undefined): value is DeletedTabKey {
  return deletedTabs.some((tab) => tab.key === value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
