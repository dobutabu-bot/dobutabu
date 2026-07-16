import {
  BriefcaseBusiness,
  CircleDollarSign,
  Download,
  Eye,
  FileText,
  HandCoins,
  ReceiptText,
  Scale,
  UserRound
} from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { DetailActivityLog } from "@/components/detail-activity-log";
import { DetailBreadcrumb, DetailHero, DetailTabs } from "@/components/detail-shell";
import { DocumentLinksSection } from "@/components/document-links-section";
import { MetricCard } from "@/components/metric-card";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getDocumentLinkSectionData } from "@/lib/document-links";
import {
  caseStatusLabels,
  clientTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  paymentMethodLabels,
  receiptStatusLabels,
  receiptTypeLabels,
  toOptions
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney, formatMoney, formatSignedMoney, toNumber } from "@/lib/utils";

type CaseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [caseFile, activeClients, activeCashAccounts] = await Promise.all([
    prisma.caseFile.findFirst({
      where: { id, userId: user.id, deletedAt: null, client: { deletedAt: null } },
      include: {
        client: true,
        incomes: { where: { deletedAt: null }, orderBy: { date: "desc" }, include: { cashAccount: true } },
        expenses: { where: { deletedAt: null }, orderBy: { date: "desc" }, include: { cashAccount: true } },
        documents: { where: { deletedAt: null }, orderBy: { issueDate: "desc" } }
      }
    }),
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    })
  ]);

  if (!caseFile) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "CASE_FILE",
    entityId: caseFile.id
  });
  const totalIncome = caseFile.incomes.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalExpense = caseFile.expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const clientExpenseTotal = caseFile.expenses
    .filter((row) => row.isClientExpense)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const documentNetTotal = caseFile.documents.reduce((sum, row) => sum + toNumber(row.netAmount), 0);
  const openReceivableTotal = caseFile.documents
    .filter((row) => row.status === "ISSUED" || row.status === "UNPAID")
    .reduce((sum, row) => sum + toNumber(row.netAmount), 0);
  const netBalance = totalIncome - totalExpense;
  const clientRows = activeClients.some((client) => client.id === caseFile.clientId)
    ? activeClients
    : [caseFile.client, ...activeClients];
  const clientOptions = clientRows.map((client) => ({
    label: client.archivedAt ? `${client.name} (Arşiv)` : client.name,
    value: client.id
  }));
  const caseFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: clientOptions },
    { name: "title", label: "Başlık" },
    {
      name: "fileNumber",
      label: "Dosya No",
      placeholder: "2026/183 K. veya 2024/22943 İstanbul 19. İcra Dairesi"
    },
    { name: "caseType", label: "Dosya Türü" },
    { name: "courtOrOffice", label: "Mahkeme / Daire", section: "advanced" as const },
    { name: "status", label: "Durum", type: "select" as const, options: toOptions(caseStatusLabels), section: "advanced" as const },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3", section: "advanced" as const }
  ];
  const scopedClientOptions = [{ label: caseFile.client.name, value: caseFile.clientId }];
  const scopedCaseOptions = [{ label: `${caseFile.client.name} - ${caseFile.title}`, value: caseFile.id }];
  const cashAccountOptions = [
    { label: "Seçim yapılmazsa Ana Kasa", value: "" },
    ...activeCashAccounts.map((account) => ({
      label: `${account.name}${account.isDefault ? " (Varsayılan)" : ""}`,
      value: account.id
    }))
  ];
  const collectionFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: scopedClientOptions },
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: scopedCaseOptions, section: "advanced" as const },
    {
      name: "cashAccountId",
      label: "Bu işlem hangi kasaya işlensin?",
      type: "select" as const,
      options: cashAccountOptions,
      hint: "Seçim yapılmazsa varsayılan Ana Kasa kullanılır.",
      section: "advanced" as const
    },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
    { name: "paymentMethod", label: "Yöntem", type: "select" as const, options: toOptions(paymentMethodLabels), section: "advanced" as const },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(incomeCategoryLabels), section: "advanced" as const },
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
  const expenseFields = [
    { name: "amount", label: "Tutar", type: "number" as const, min: "0", step: "0.01" },
    { name: "category", label: "Kategori", type: "select" as const, options: toOptions(expenseCategoryLabels) },
    { name: "date", label: "Tarih", type: "date" as const },
    { name: "description", label: "Açıklama", type: "textarea" as const, className: "md:col-span-2" },
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: scopedClientOptions, section: "advanced" as const },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: scopedCaseOptions, section: "advanced" as const },
    {
      name: "cashAccountId",
      label: "Bu işlem hangi kasaya işlensin?",
      type: "select" as const,
      options: cashAccountOptions,
      hint: "Seçim yapılmazsa varsayılan Ana Kasa kullanılır.",
      section: "advanced" as const
    },
    { name: "currency", label: "Para Birimi", section: "advanced" as const },
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
    }
  ];
  const receiptFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: scopedClientOptions },
    { name: "caseFileId", label: "Dosya", type: "select" as const, options: scopedCaseOptions },
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

  return (
    <div className="space-y-5">
      <DetailBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Dosyalar", href: "/cases" }, { label: caseFile.title }]} />
      <DetailHero
        eyebrow="Dosya Detayı"
        title={caseFile.title}
        description={caseFile.fileNumber || "Dosya numarası girilmemiş"}
        status={<StatusBadge tone={caseStatusTone(caseFile.status)}>{caseStatusLabels[caseFile.status]}</StatusBadge>}
        actions={
          <>
          <a href={`/api/reports/case/${caseFile.id}/pdf`} className="secondary-action min-h-11 px-3">
            <Download className="h-4 w-4" aria-hidden />
            PDF indir
          </a>
          <RecordEditButton
            title="Dosya Düzenle"
            endpoint={`/api/cases/${caseFile.id}`}
            schemaKey="caseFile"
            fields={caseFields}
            successMessage="Dosya güncellendi."
            successMessageRules={[{ field: "status", value: "ARCHIVED", message: "Dosya arşivlendi." }]}
            defaults={{
              clientId: caseFile.clientId,
              title: caseFile.title,
              fileNumber: caseFile.fileNumber ?? "",
              courtOrOffice: caseFile.courtOrOffice ?? "",
              caseType: caseFile.caseType ?? "",
              status: caseFile.status,
              notes: caseFile.notes ?? ""
            }}
          />
          {caseFile.status === "ARCHIVED" ? null : (
            <ConfirmActionButton
              endpoint={`/api/cases/${caseFile.id}`}
              label="Sil/Arşivle"
              title="Dosya silinsin/arşivlensin mi?"
              description={`${caseFile.title} normal listelerden ve finans raporlarından çıkarılacak. Bağlı tahsilat, gider ve makbuz kayıtları silinmez.`}
              confirmLabel="Sil/Arşivle"
              successMessage="Dosya silindi."
              redirectTo="/cases"
            />
          )}
          </>
        }
      />
      <DetailTabs />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Dosya Tahsilatı" value={formatDirectionalMoney(totalIncome, "IN")} icon={HandCoins} tone="green" />
        <MetricCard title="Dosya Gideri" value={formatDirectionalMoney(totalExpense, "OUT")} icon={ReceiptText} tone="rose" />
        <MetricCard title="Yansıtılabilir Masraf" value={formatMoney(clientExpenseTotal)} icon={BriefcaseBusiness} tone="amber" />
        <MetricCard title="Açık Belge Alacağı" value={formatDirectionalMoney(openReceivableTotal, "IN")} icon={Scale} tone={openReceivableTotal > 0 ? "green" : "neutral"} />
        <MetricCard title="Net Durum" value={formatSignedMoney(netBalance)} icon={CircleDollarSign} tone={netBalance >= 0 ? "green" : "rose"} />
      </div>

      <div id="overview" className="grid scroll-mt-24 gap-5 xl:grid-cols-2">
        <section className="surface p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-4 w-4 text-slate-500" aria-hidden />
            Dosya Bilgileri
          </h3>
          <dl className="grid gap-3 text-sm">
            <InfoRow label="Başlık" value={caseFile.title} />
            <InfoRow label="Dosya No" value={caseFile.fileNumber} />
            <InfoRow label="Mahkeme / Daire" value={caseFile.courtOrOffice} />
            <InfoRow label="Dosya Türü" value={caseFile.caseType} />
            <InfoRow label="Durum" value={<StatusBadge tone={caseStatusTone(caseFile.status)}>{caseStatusLabels[caseFile.status]}</StatusBadge>} />
            <InfoRow label="Kayıt Tarihi" value={formatDate(caseFile.createdAt)} />
          </dl>
        </section>

        <section className="surface p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <UserRound className="h-4 w-4 text-slate-500" aria-hidden />
            Müvekkil Bilgisi
          </h3>
          <dl className="grid gap-3 text-sm">
            <InfoRow
              label="Ad / Ünvan"
              value={
                <Link href={`/clients/${caseFile.clientId}`} className="font-medium text-slate-950 hover:text-slate-700">
                  {caseFile.client.name}
                </Link>
              }
            />
            <InfoRow label="Tür" value={clientTypeLabels[caseFile.client.type]} />
            <InfoRow label="Telefon" value={caseFile.client.phone} />
            <InfoRow label="E-posta" value={caseFile.client.email} />
            <InfoRow label="Durum" value={caseFile.client.archivedAt ? "Arşiv" : "Aktif"} />
          </dl>
        </section>
      </div>

      <section id="finance" className="scroll-mt-24 space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Bu Dosyaya Ait Tahsilatlar</h3>
        <DataTable
          rows={caseFile.incomes}
          empty="Bu dosyaya ait tahsilat yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.date) },
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
                <Link href={`/collections/${row.id}`} className="secondary-action min-h-11 px-3">
                  <Eye className="h-4 w-4" aria-hidden />
                  Detay
                </Link>
                <RecordEditButton
                  title="Tahsilat Düzenle"
                    endpoint={`/api/collections/${row.id}`}
                    schemaKey="collection"
                    fields={collectionFields}
                    successMessage="Tahsilat güncellendi."
                    defaults={{
                      clientId: caseFile.clientId,
                      caseFileId: caseFile.id,
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Bu Dosyaya Ait Giderler</h3>
        <DataTable
          rows={caseFile.expenses}
          empty="Bu dosyaya ait gider yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.date) },
            { header: "Kategori", cell: (row) => expenseCategoryLabels[row.category] },
            { header: "Açıklama", cell: (row) => row.description ?? "-" },
            {
              header: "Tutar",
              cell: (row) => formatDirectionalMoney(row.amount, "OUT", row.currency),
              className: "font-medium tabular-finance text-rose-700"
            },
            { header: "Yöntem", cell: (row) => paymentMethodLabels[row.paymentMethod] },
            { header: "Kasa", cell: (row) => row.cashAccount?.name ?? "Ana Kasa" },
            { header: "Müvekkil Masrafı", cell: (row) => (row.isClientExpense ? "Evet" : "Hayır") },
            {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/expenses/${row.id}`} className="secondary-action min-h-11 px-3">
                  <Eye className="h-4 w-4" aria-hidden />
                  Detay
                </Link>
                <RecordEditButton
                  title="Gider Düzenle"
                    endpoint={`/api/expenses/${row.id}`}
                    schemaKey="expense"
                    fields={expenseFields}
                    successMessage="Gider güncellendi."
                    defaults={{
                      clientId: row.clientId ?? caseFile.clientId,
                      caseFileId: row.caseFileId ?? caseFile.id,
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Bu Dosyaya Ait Makbuz / Fatura Kayıtları</h3>
        <DataTable
          rows={caseFile.documents}
          empty="Bu dosyaya ait makbuz/fatura kaydı yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.issueDate) },
            { header: "No", cell: (row) => row.number },
            { header: "Tür", cell: (row) => receiptTypeLabels[row.type] },
            {
              header: "Durum",
              cell: (row) => <StatusBadge tone={receiptStatusTone(row.status)}>{receiptStatusLabels[row.status]}</StatusBadge>
            },
            { header: "Brüt", cell: (row) => formatMoney(row.grossAmount) },
            { header: "KDV", cell: (row) => (row.vatAmount == null ? "-" : formatMoney(row.vatAmount)) },
            { header: "Stopaj", cell: (row) => (row.withholdingAmount == null ? "-" : formatMoney(row.withholdingAmount)) },
            { header: "Net", cell: (row) => formatMoney(row.netAmount), className: "font-medium text-slate-950" },
            {
              header: "İşlem",
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <RecordEditButton
                    title="Makbuz / Fatura Düzenle"
                    endpoint={`/api/receipts/${row.id}`}
                    schemaKey="receipt"
                    fields={receiptFields}
                    successMessage="Belge kaydı güncellendi."
                    defaults={{
                      clientId: caseFile.clientId,
                      caseFileId: caseFile.id,
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
      </section>

      <section className="surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Dosya Net Finans Özeti</h3>
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Tahsilat - Gider" value={formatMoney(netBalance)} />
          <SummaryItem label="Belge Net Toplamı" value={formatMoney(documentNetTotal)} />
          <SummaryItem label="Açık Belge Alacağı" value={formatMoney(openReceivableTotal)} />
          <SummaryItem label="Yansıtılabilir Masraf" value={formatMoney(clientExpenseTotal)} />
        </div>
      </section>

      <div id="documents" className="scroll-mt-24">
        <DocumentLinksSection
          entityType="CASE_FILE"
          entityId={caseFile.id}
          documents={documentLinks.documents}
          options={documentLinks.options}
          uploadHref={documentLinks.uploadHref}
        />
      </div>
      <DetailActivityLog userId={user.id} entityType="CASE_FILE" entityId={caseFile.id} />

      <section className="surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Notlar</h3>
        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{caseFile.notes || "Not girilmemiş."}</p>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function caseStatusTone(status: keyof typeof caseStatusLabels) {
  if (status === "ACTIVE") return "green";
  if (status === "CLOSED") return "neutral";
  return "amber";
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
