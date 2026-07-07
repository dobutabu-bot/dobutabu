import { ArchiveRestore } from "lucide-react";
import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { RestoreRecordButton } from "@/components/restore-record-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import {
  caseStatusLabels,
  clientTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  receiptStatusLabels,
  receiptTypeLabels
} from "@/lib/labels";
import { getDeletedRecords } from "@/lib/restore-service";
import { formatDate, formatMoney } from "@/lib/utils";

type DeletedRecordsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const deletedTabs = [
  { key: "clients", label: "Müvekkiller" },
  { key: "cases", label: "Dosyalar" },
  { key: "incomes", label: "Tahsilatlar" },
  { key: "expenses", label: "Giderler" },
  { key: "receipts", label: "Makbuz/Fatura" }
] as const;

type DeletedTabKey = (typeof deletedTabs)[number]["key"];

export default async function DeletedRecordsPage({ searchParams }: DeletedRecordsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const activeTab = isDeletedTab(params.tab) ? params.tab : "clients";
  const records = await getDeletedRecords(user.id);
  const tabCounts: Record<DeletedTabKey, number> = {
    clients: records.clients.length,
    cases: records.caseFiles.length,
    incomes: records.incomes.length,
    expenses: records.expenses.length,
    receipts: records.invoiceOrReceipts.length
  };

  return (
    <div className="space-y-5">
      <section className="surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <ArchiveRestore className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">Silinen Kayıtlar</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Yanlışlıkla silinen kayıtları geri alabilirsiniz. Bağlı müvekkil veya dosya silinmişse önce bağlı kaydı geri almak gerekir.
            </p>
          </div>
        </div>
      </section>

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
                    ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
          rows={records.clients}
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
          rows={records.caseFiles}
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
          rows={records.incomes}
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
          rows={records.expenses}
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
          rows={records.invoiceOrReceipts}
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
    </div>
  );
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
