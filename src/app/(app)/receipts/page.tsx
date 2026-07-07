import { Prisma } from "@prisma/client";
import { AlertTriangle, Download, Eye, FileSpreadsheet, Filter, ReceiptText, Scale } from "lucide-react";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { MetricCard } from "@/components/metric-card";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { appendReceiptFilters, receiptWhereFromFilters, type ReceiptFilters } from "@/lib/receipt-query";
import { receiptStatusLabels, receiptTypeLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatMoney } from "@/lib/utils";

type ReceiptsPageProps = {
  searchParams: Promise<ReceiptFilters>;
};

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: ReceiptFilters = {
    startDate: params.startDate?.trim() ?? "",
    endDate: params.endDate?.trim() ?? "",
    clientId: params.clientId?.trim() ?? "",
    status: params.status && params.status in receiptStatusLabels ? params.status : "",
    unpaidOnly: params.unpaidOnly === "1" ? "1" : ""
  };
  const where: Prisma.InvoiceOrReceiptWhereInput = { ...receiptWhereFromFilters(filters), userId: user.id };

  const [activeClients, activeCases, filterClients, filterCases, receipts] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.client.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.invoiceOrReceipt.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: { client: true, caseFile: true, relatedIncome: true }
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
  const receiptFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: caseOptions },
    { name: "type", label: "Belge Türü", type: "select" as const, options: toOptions(receiptTypeLabels) },
    { name: "number", label: "Belge Numarası" },
    { name: "issueDate", label: "Düzenleme Tarihi", type: "date" as const },
    { name: "status", label: "Durum", type: "select" as const, options: toOptions(receiptStatusLabels) },
    { name: "grossAmount", label: "Brüt Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "vatAmount", label: "KDV Tutarı", type: "number" as const, min: "0", step: "0.01" },
    { name: "withholdingAmount", label: "Stopaj / Tevkifat", type: "number" as const, min: "0", step: "0.01" },
    { name: "netAmount", label: "Net Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" }
  ];
  const receiptEditFields = receiptFields.map((field) => {
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
  const totalNet = sumByCurrency(receipts.map((row) => ({ amount: row.netAmount, currency: "TRY" })));
  const unpaidNet = sumByCurrency(
    receipts.filter((row) => row.status === "UNPAID").map((row) => ({ amount: row.netAmount, currency: "TRY" }))
  );
  const csvParams = new URLSearchParams({ resource: "receipts", format: "csv" });
  appendReceiptFilters(csvParams, filters);
  const xlsParams = new URLSearchParams({ resource: "receipts", format: "xls" });
  appendReceiptFilters(xlsParams, filters);

  return (
    <div className="space-y-5">
      <section className="surface flex gap-3 border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>Bu ekran yalnızca takip amaçlıdır. Resmi e-SMM/e-Fatura işlemleri ayrıca yetkili sistemden yapılmalıdır.</p>
      </section>

      <EntityForm
        title="Makbuz / Fatura Ekle"
        endpoint="/api/receipts"
        schemaKey="receipt"
        defaults={{
          clientId: "",
          caseFileId: "",
          number: "",
          type: "E_SMM",
          status: "DRAFT",
          issueDate: dateInputValue(),
          grossAmount: "",
          vatAmount: "",
          withholdingAmount: "",
          netAmount: "",
          notes: ""
        }}
        fields={receiptFields}
      />

      <section className="surface p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]" action="/receipts">
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
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 xl:flex-none"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filtrele
            </button>
            <Link
              href="/receipts"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 xl:flex-none"
            >
              Temizle
            </Link>
          </div>
          <label className="space-y-1">
            <span className="label">Durum</span>
            <select className="field" name="status" defaultValue={filters.status}>
              {toOptions(receiptStatusLabels, { label: "Tüm durumlar", value: "" }).map((option) => (
                <option key={option.value || "all-statuses"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="unpaidOnly"
              value="1"
              defaultChecked={filters.unpaidOnly === "1"}
              className="h-4 w-4 rounded border-slate-300 text-slate-950"
            />
            Ödenmeyen belgeleri göster
          </label>
        </form>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <MetricCard title="Belge Sayısı" value={String(receipts.length)} icon={ReceiptText} />
        <MetricCard title="Toplam Net" value={totalNet} icon={Scale} tone="green" />
        <MetricCard title="Ödenmeyen Net" value={unpaidNet} icon={AlertTriangle} tone="amber" />
        <Link
          href={`/api/export?${csvParams.toString()}`}
          className="surface flex min-h-[96px] items-center justify-center gap-2 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          CSV indir
        </Link>
        <Link
          href={`/api/export?${xlsParams.toString()}`}
          className="surface flex min-h-[96px] items-center justify-center gap-2 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel indir
        </Link>
      </section>

      <DataTable
        rows={receipts}
        empty="Henüz makbuz/fatura kaydı yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.issueDate) },
          { header: "Müvekkil", cell: (row) => row.client.name },
          { header: "Dosya", cell: (row) => row.caseFile?.title ?? "-" },
          { header: "Belge No", cell: (row) => row.number },
          { header: "Tür", cell: (row) => receiptTypeLabels[row.type] },
          {
            header: "Durum",
            cell: (row) => <StatusBadge tone={receiptStatusTone(row.status)}>{receiptStatusLabels[row.status]}</StatusBadge>
          },
          { header: "Brüt", cell: (row) => formatMoney(row.grossAmount) },
          { header: "KDV", cell: (row) => (row.vatAmount == null ? "-" : formatMoney(row.vatAmount)) },
          { header: "Stopaj", cell: (row) => (row.withholdingAmount == null ? "-" : formatMoney(row.withholdingAmount)) },
          { header: "Net", cell: (row) => formatMoney(row.netAmount), className: "font-medium text-slate-950" },
          { header: "Tahsilat Bağı", cell: (row) => (row.relatedIncomeId ? "Bağlı" : "Hazır") },
          {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/receipts/${row.id}`} className="secondary-action min-h-10 px-3">
                  <Eye className="h-4 w-4" aria-hidden />
                  Detay
                </Link>
                <RecordEditButton
                  title="Makbuz / Fatura Düzenle"
                  endpoint={`/api/receipts/${row.id}`}
                  schemaKey="receipt"
                  fields={receiptEditFields}
                  successMessage="Belge kaydı güncellendi."
                  defaults={{
                    clientId: row.clientId,
                    caseFileId: row.caseFileId ?? "",
                    number: row.number,
                    type: row.type,
                    status: row.status,
                    issueDate: dateInputValue(row.issueDate),
                    grossAmount: row.grossAmount.toString(),
                    vatAmount: row.vatAmount?.toString() ?? "",
                    withholdingAmount: row.withholdingAmount?.toString() ?? "",
                    netAmount: row.netAmount.toString(),
                    notes: row.notes ?? ""
                  }}
                />
                <ConfirmActionButton
                  endpoint={`/api/receipts/${row.id}`}
                  label={receiptActionLabel(row.status)}
                  title={receiptActionTitle(row.status)}
                  description="Bu belge kaydını silmek veya iptal etmek istediğinizden emin misiniz?"
                  confirmLabel={receiptActionLabel(row.status)}
                  successMessage={receiptActionSuccessMessage(row.status)}
                />
              </div>
            )
          }
        ]}
      />
    </div>
  );
}

type MoneyRow = {
  amount: Prisma.Decimal;
  currency: "TRY";
};

function sumByCurrency(rows: MoneyRow[]) {
  const totals = rows.reduce((map, row) => {
    const current = map.get(row.currency) ?? new Prisma.Decimal(0);
    map.set(row.currency, current.plus(row.amount));
    return map;
  }, new Map<string, Prisma.Decimal>());

  return (
    Array.from(totals.entries())
      .map(([currency, amount]) => formatMoney(amount, currency))
      .join(" · ") || formatMoney(0)
  );
}

function receiptStatusTone(status: keyof typeof receiptStatusLabels) {
  if (status === "PAID") return "green";
  if (status === "CANCELLED") return "neutral";
  if (status === "UNPAID") return "rose";
  return "amber";
}

function receiptCanBeDeleted(status: keyof typeof receiptStatusLabels) {
  return status === "DRAFT" || status === "CANCELLED";
}

function receiptActionLabel(status: keyof typeof receiptStatusLabels) {
  return receiptCanBeDeleted(status) ? "Sil" : "İptal";
}

function receiptActionTitle(status: keyof typeof receiptStatusLabels) {
  return receiptCanBeDeleted(status) ? "Belge kaydı silinsin mi?" : "Belge kaydı iptal edilsin mi?";
}

function receiptActionSuccessMessage(status: keyof typeof receiptStatusLabels) {
  return receiptCanBeDeleted(status) ? "Belge kaydı silindi." : "Belge kaydı iptal edildi.";
}
