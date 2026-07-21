import { CalendarClock, Download, Eye, Filter, MoveRight, RotateCcw, Scale, WalletCards } from "lucide-react";
import Link from "@/components/app-link";

import { AmountText } from "@/components/amount-text";
import { RecordActionMenu } from "@/components/action-menu";
import { AppleLikeButton } from "@/components/apple-like-button";
import { CashMovementRow } from "@/components/cash-movement-row";
import { DataTable } from "@/components/data-table";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { appendCashLedgerFilters, cashLedgerFiltersFromRecord, type CashLedgerFilters } from "@/lib/cash/cash-ledger-query";
import { countLedgerEntries, getLedgerEntries, type SerializableLedgerEntry } from "@/lib/cash/cash-ledger-service";
import { cashLedgerDirectionLabels, cashLedgerEntryTypeLabels, reminderPriorityLabels, toOptions } from "@/lib/labels";
import { createPageHref, parsePagination, totalPages } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { addDays, dateInputValue, formatDate, startOfDay, toNumber } from "@/lib/utils";

type CashLedgerPageProps = {
  searchParams: Promise<Partial<Record<keyof CashLedgerFilters, string>> & { page?: string }>;
};

export default async function CashLedgerPage({ searchParams }: CashLedgerPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = cashLedgerFiltersFromRecord(params);
  const pagination = parsePagination({ page: params.page }, { pageSize: 25 });
  const today = startOfDay(new Date());
  const [cashAccounts, clients, cases, entries, totalCount, upcomingExpenseReminders] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }]
    }),
    prisma.client.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { name: "asc" }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, client: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    getLedgerEntries({ userId: user.id, ...filters, skip: pagination.skip, take: pagination.take }),
    countLedgerEntries({ userId: user.id, ...filters }),
    prisma.taskReminder.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        status: "OPEN",
        reminderType: "EXPENSE",
        dueDate: { lte: addDays(today, 15) },
        AND: [
          { OR: [{ relatedClientId: null }, { relatedClient: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 8,
      include: {
        relatedClient: { select: { name: true } },
        relatedCaseFile: { select: { title: true } },
        cashAccount: { select: { name: true } }
      }
    })
  ]);
  const pageCount = totalPages(totalCount, pagination.pageSize);
  const activeCashAccounts = cashAccounts.filter((account) => account.isActive);
  const accountFilterOptions = [
    { label: "Tüm kasa hesapları", value: "" },
    ...cashAccounts.map((account) => ({
      label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}${account.isActive ? "" : " (Pasif)"}`,
      value: account.id
    }))
  ];
  const activeAccountOptions = [
    { label: "Seçiniz", value: "" },
    ...activeCashAccounts.map((account) => ({
      label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}`,
      value: account.id
    }))
  ];
  const clientOptions = [
    { label: "Müvekkil yok", value: "" },
    ...clients.map((client) => ({ label: client.name, value: client.id }))
  ];
  const filterClientOptions = [{ label: "Tüm müvekkiller", value: "" }, ...clients.map((client) => ({ label: client.name, value: client.id }))];
  const caseOptions = [
    { label: "Dosya yok", value: "" },
    ...cases.map((caseFile) => ({
      label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
      value: caseFile.id
    }))
  ];
  const filterCaseOptions = [{ label: "Tüm dosyalar", value: "" }, ...caseOptions.slice(1)];
  const adjustmentFields = cashAdjustmentFields(activeAccountOptions, clientOptions, caseOptions);
  const transferFields = cashTransferFields(activeAccountOptions);
  const exportParams = new URLSearchParams({ resource: "cashLedger", format: "csv" });
  const pdfParams = new URLSearchParams();
  appendCashLedgerFilters(exportParams, filters);
  appendCashLedgerFilters(pdfParams, filters);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="V2 Dijital Kasa"
        title="Kasa Hareketleri"
        description="Tahsilat, gider, transfer ve manuel düzeltme hareketlerini kasa bazında izleyin."
        actions={
          <>
          <AppleLikeButton href="/cash/accounts" icon={WalletCards} tone="light">
            Hesaplar
          </AppleLikeButton>
          <AppleLikeButton href="/cash/ledger" icon={MoveRight}>
            Hareketler
          </AppleLikeButton>
          <AppleLikeButton href="/cash/reconciliation" icon={Scale} tone="light">
            Bakiye kontrolü
          </AppleLikeButton>
          </>
        }
      />

      <section className="surface-dark p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Ödeme alarmı</p>
            <h3 className="mt-1 text-base font-semibold text-white">Yaklaşan Kasa Ödemeleri</h3>
            <p className="mt-1 text-sm text-slate-300">
              Açık gider hatırlatmaları, ödeme tarihi ve seçili kasa hesabıyla burada görünür.
            </p>
          </div>
          <AppleLikeButton href="/reminders" icon={CalendarClock} tone="dark">
            Hatırlatmaları Aç
          </AppleLikeButton>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingExpenseReminders.length === 0 ? (
            <div className="digital-row-soft p-4 text-sm text-slate-300 md:col-span-2 xl:col-span-4">
              Yaklaşan kasa ödemesi yok.
            </div>
          ) : (
            upcomingExpenseReminders.map((reminder) => {
              const state = cashReminderState(reminder.dueDate, reminder.priority, today);
              const context = [reminder.relatedClient?.name, reminder.relatedCaseFile?.title].filter(Boolean).join(" · ");

              return (
                <article key={reminder.id} className="digital-glass p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{reminder.title}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{context || "Genel gider hatırlatması"}</p>
                    </div>
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Vade</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatDate(reminder.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{reminder.cashAccount?.name ?? "Varsayılan kasa"}</p>
                      <AmountText value={-toNumber(reminder.amount)} currency={reminder.currency} size="sm" variant="strong" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Öncelik: {reminderPriorityLabels[reminder.priority]}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityForm
          title="Kasa Düzeltme"
          endpoint="/api/cash/ledger/adjustments"
          schemaKey="cashAdjustment"
          defaults={{
            cashAccountId: "",
            direction: "IN",
            amount: "",
            currency: "TRY",
            date: dateInputValue(),
            description: "",
            referenceNo: "",
            clientId: "",
            caseFileId: ""
          }}
          fields={adjustmentFields}
          submitLabel="Düzeltme ekle"
          successMessage="Kasa düzeltmesi kaydedildi."
        />
        <EntityForm
          title="Kasa Transferi"
          endpoint="/api/cash/ledger/transfers"
          schemaKey="cashTransfer"
          defaults={{
            fromAccountId: "",
            toAccountId: "",
            amount: "",
            currency: "TRY",
            date: dateInputValue(),
            description: ""
          }}
          fields={transferFields}
          submitLabel="Transfer yap"
          successMessage="Kasa transferi kaydedildi."
        />
      </div>

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]" action="/cash/ledger">
          <label className="space-y-1">
            <span className="label">Başlangıç Tarihi</span>
            <input className="field" type="date" name="startDate" defaultValue={filters.startDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Bitiş Tarihi</span>
            <input className="field" type="date" name="endDate" defaultValue={filters.endDate} />
          </label>
          <label className="space-y-1">
            <span className="label">Kasa Hesabı</span>
            <select className="field" name="cashAccountId" defaultValue={filters.cashAccountId}>
              {accountFilterOptions.map((option) => (
                <option key={option.value || "all-accounts"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Hareket Tipi</span>
            <select className="field" name="entryType" defaultValue={filters.entryType}>
              {toOptions(cashLedgerEntryTypeLabels, { label: "Tüm hareketler", value: "" }).map((option) => (
                <option key={option.value || "all-types"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button type="submit" className="primary-action h-11 flex-1 xl:flex-none">
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link href="/cash/ledger" className="secondary-action h-11 flex-1 xl:flex-none">
              <RotateCcw className="h-4 w-4" aria-hidden />
              Temizle
            </Link>
          </div>
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
            <span className="label">Giriş / Çıkış</span>
            <select className="field" name="direction" defaultValue={filters.direction}>
              {toOptions(cashLedgerDirectionLabels, { label: "Tümü", value: "" }).map((option) => (
                <option key={option.value || "all-directions"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col items-stretch gap-2 md:col-span-2 xl:col-span-2 xl:flex-row xl:items-end">
            <a href={`/api/export?${exportParams.toString()}`} className="secondary-action h-11 w-full justify-center xl:w-auto">
              <Download className="h-4 w-4" aria-hidden />
              CSV indir
            </a>
            <PdfDownloadButton
              href={`/api/reports/cash/pdf?${pdfParams.toString()}`}
              label="PDF indir"
              className="w-full justify-center xl:w-auto"
            />
          </div>
        </form>
      </section>

      <CashLedgerMobileCards entries={entries} />

      <div className="cash-ledger-desktop-table">
        <DataTable
          rows={entries}
          empty="Kasa hareketi bulunamadı"
          columns={[
            { header: "Tarih", cell: (row) => row.date },
            { header: "Açıklama", cell: (row) => row.description || cashLedgerEntryTypeLabels[row.entryType] },
            { header: "Müvekkil", cell: (row) => row.clientName || "-" },
            { header: "Dosya", cell: (row) => row.caseFileTitle || "-" },
            {
              header: "Giriş",
              cell: (row) => renderLedgerAmountCell(row, "IN")
            },
            {
              header: "Çıkış",
              cell: (row) => renderLedgerAmountCell(row, "OUT")
            },
            { header: "Kasa", cell: (row) => row.cashAccountName },
            { header: "Tip", cell: (row) => cashLedgerEntryTypeLabels[row.entryType] },
            { header: "Yön", cell: (row) => <StatusBadge tone={row.direction === "IN" ? "green" : "rose"}>{cashLedgerDirectionLabels[row.direction]}</StatusBadge> },
            {
              header: "İşlem",
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/cash/ledger/${row.id}`} className="secondary-action min-h-11 px-3">
                    <Eye className="h-4 w-4" aria-hidden />
                    Detay
                  </Link>
                  <Link href={`/documents/new?linkedCashLedgerEntryId=${row.id}`} className="secondary-action min-h-11 px-3">
                    Belge bağla
                  </Link>
                </div>
              )
            }
          ]}
        />
      </div>

      <Pagination
        page={Math.min(pagination.page, pageCount)}
        totalPages={pageCount}
        totalItems={totalCount}
        pageSize={pagination.pageSize}
        hrefForPage={(page) =>
          createPageHref(
            "/cash/ledger",
            {
              startDate: filters.startDate,
              endDate: filters.endDate,
              cashAccountId: filters.cashAccountId,
              clientId: filters.clientId,
              caseFileId: filters.caseFileId,
              entryType: filters.entryType,
              direction: filters.direction
            },
            page
          )
        }
      />
    </div>
  );
}

function cashAdjustmentFields(
  accountOptions: Array<{ label: string; value: string }>,
  clientOptions: Array<{ label: string; value: string }>,
  caseOptions: Array<{ label: string; value: string }>
): EntityFormField[] {
  return [
    { name: "cashAccountId", label: "Kasa hesabı", type: "select", options: accountOptions },
    {
      name: "direction",
      label: "Düzeltme yönü",
      type: "select",
      options: [
        { label: "Pozitif düzeltme / giriş", value: "IN" },
        { label: "Negatif düzeltme / çıkış", value: "OUT" }
      ]
    },
    { name: "amount", label: "Tutar", type: "number", min: "0", step: "0.01" },
    { name: "currency", label: "Para birimi" },
    { name: "date", label: "Tarih", type: "date" },
    { name: "referenceNo", label: "Referans no" },
    { name: "clientId", label: "Müvekkil", type: "select", options: clientOptions },
    { name: "caseFileId", label: "Dosya", type: "select", options: caseOptions },
    { name: "description", label: "Açıklama", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
  ];
}

function cashTransferFields(accountOptions: Array<{ label: string; value: string }>): EntityFormField[] {
  return [
    { name: "fromAccountId", label: "Çıkış kasası", type: "select", options: accountOptions },
    { name: "toAccountId", label: "Giriş kasası", type: "select", options: accountOptions },
    { name: "amount", label: "Tutar", type: "number", min: "0", step: "0.01" },
    { name: "currency", label: "Para birimi" },
    { name: "date", label: "Tarih", type: "date" },
    { name: "description", label: "Açıklama", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
  ];
}

function renderLedgerAmountCell(row: SerializableLedgerEntry, direction: SerializableLedgerEntry["direction"]) {
  if (row.direction !== direction) {
    return "-";
  }

  if (row.entryType === "TRANSFER") {
    return (
      <span className="tabular-finance text-sm font-semibold text-blue-700">
        {direction === "IN" ? "+" : "-"}
        {row.amountLabel}
      </span>
    );
  }

  return (
    <AmountText
      value={direction === "IN" ? row.amount : -row.amount}
      currency={row.currency}
      size="sm"
      variant="strong"
    />
  );
}

function cashReminderState(
  dueDate: Date,
  priority: keyof typeof reminderPriorityLabels,
  today: Date
) {
  if (dueDate < today) {
    return { label: "Gecikti", tone: "rose" as const };
  }

  if (dueDate < addDays(today, 1)) {
    return { label: "Bugün Ödenecek", tone: "amber" as const };
  }

  if (priority === "CRITICAL") {
    return { label: "Kritik", tone: "rose" as const };
  }

  if (dueDate <= addDays(today, 3)) {
    return { label: "Yaklaşan Gider", tone: "amber" as const };
  }

  return { label: "Planlı", tone: "neutral" as const };
}

function CashLedgerMobileCards({ entries }: { entries: SerializableLedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="cash-ledger-mobile-cards surface">
        <EmptyState title="Kasa hareketi bulunamadı" />
      </div>
    );
  }

  return (
    <section className="cash-ledger-mobile-cards space-y-3">
      {entries.map((entry) => (
        <article key={entry.id} className="relative min-w-0">
          <Link href={`/cash/ledger/${entry.id}`} className="block pr-12">
            <CashMovementRow
              title={entry.description || cashLedgerEntryTypeLabels[entry.entryType]}
              date={entry.date}
              amount={entry.amount}
              currency={entry.currency}
              direction={entry.direction}
              entryType={entry.entryType}
              accountName={entry.cashAccountName}
              entryTypeLabel={cashLedgerEntryTypeLabels[entry.entryType]}
              directionLabel={cashLedgerDirectionLabels[entry.direction]}
              clientName={entry.clientName}
              caseFileTitle={entry.caseFileTitle}
            />
          </Link>
          <div className="absolute right-2 top-2">
            <RecordActionMenu label={`${entry.description || cashLedgerEntryTypeLabels[entry.entryType]} işlemleri`}>
              <Link href={`/cash/ledger/${entry.id}`} className="secondary-action">Detay</Link>
              <Link href={`/documents/new?linkedCashLedgerEntryId=${entry.id}`} className="secondary-action">Belge bağla</Link>
            </RecordActionMenu>
          </div>
        </article>
      ))}
    </section>
  );
}
