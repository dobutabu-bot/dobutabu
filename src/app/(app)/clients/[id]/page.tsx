import { BriefcaseBusiness, CircleDollarSign, Download, HandCoins, ReceiptText, Scale } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { ClientArchiveButton } from "@/components/client-archive-button";
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
import { caseStatusLabels, clientTypeLabels, expenseCategoryLabels, incomeCategoryLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDirectionalMoney, formatMoney, formatSignedMoney, toNumber } from "@/lib/utils";

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, userId: user.id },
    include: {
      cases: { where: { deletedAt: null, status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" } },
      incomes: {
        where: {
          deletedAt: null,
          OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
        },
        orderBy: { date: "desc" },
        include: { caseFile: true }
      },
      expenses: {
        where: {
          deletedAt: null,
          OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
        },
        orderBy: { date: "desc" },
        include: { caseFile: true }
      },
      documents: {
        where: {
          deletedAt: null,
          OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
        },
        orderBy: { issueDate: "desc" }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const documentLinks = await getDocumentLinkSectionData({
    userId: user.id,
    entityType: "CLIENT",
    entityId: client.id
  });
  const totalIncome = client.incomes.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalExpense = client.expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const clientExpenseTotal = client.expenses
    .filter((row) => row.isClientExpense)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const openReceivableTotal = client.documents
    .filter((row) => row.status === "ISSUED" || row.status === "UNPAID")
    .reduce((sum, row) => sum + toNumber(row.netAmount), 0);
  const netBalance = totalIncome - totalExpense;
  const clientFields = [
    { name: "name", label: "Ad / Ünvan" },
    { name: "phone", label: "Telefon", type: "tel" as const },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" },
    { name: "type", label: "Tür", type: "select" as const, options: toOptions(clientTypeLabels), section: "advanced" as const },
    { name: "tcNo", label: "T.C. No", section: "advanced" as const },
    { name: "taxNo", label: "Vergi No", section: "advanced" as const },
    { name: "email", label: "E-posta", type: "email" as const, section: "advanced" as const },
    { name: "address", label: "Adres", section: "advanced" as const }
  ];
  const caseFields = [
    { name: "clientId", label: "Müvekkil", type: "select" as const, options: [{ label: client.name, value: client.id }] },
    { name: "title", label: "Başlık" },
    { name: "fileNumber", label: "Dosya No", placeholder: "2024/330 E. veya 2024/22943 İstanbul 19. İcra Dairesi" },
    { name: "caseType", label: "Dosya Türü" },
    { name: "courtOrOffice", label: "Mahkeme / Daire", section: "advanced" as const },
    { name: "status", label: "Durum", type: "select" as const, options: toOptions(caseStatusLabels), section: "advanced" as const },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3", section: "advanced" as const }
  ];
  const latestTransactions = [
    ...client.incomes.map((row) => ({
      id: row.id,
      date: row.date,
      type: "Tahsilat",
      category: incomeCategoryLabels[row.category],
      caseFile: row.caseFile?.title ?? "-",
      amount: toNumber(row.amount),
      tone: "green" as const
    })),
    ...client.expenses.map((row) => ({
      id: row.id,
      date: row.date,
      type: row.isClientExpense ? "Yansıtılabilir masraf" : "Gider",
      category: expenseCategoryLabels[row.category],
      caseFile: row.caseFile?.title ?? "-",
      amount: -toNumber(row.amount),
      tone: "rose" as const
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <DetailBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Müvekkiller", href: "/clients" }, { label: client.name }]} />
      <DetailHero
        eyebrow="Müvekkil Detayı"
        title={client.name}
        description={`${client.phone ?? "Telefon yok"} · ${client.email ?? "E-posta yok"}`}
        status={
          <>
            <StatusBadge tone={client.archivedAt ? "neutral" : "green"}>{client.archivedAt ? "Arşiv" : "Aktif"}</StatusBadge>
            <StatusBadge>{clientTypeLabels[client.type]}</StatusBadge>
          </>
        }
        actions={
          <>
          <a href={`/api/reports/client/${client.id}/pdf`} className="secondary-action min-h-11 px-3">
            <Download className="h-4 w-4" aria-hidden />
            PDF indir
          </a>
          {client.archivedAt ? null : (
            <>
            <RecordEditButton
              title="Müvekkil Düzenle"
              endpoint={`/api/clients/${client.id}`}
              schemaKey="client"
              fields={clientFields}
              successMessage="Müvekkil güncellendi."
              defaults={{
                name: client.name,
                type: client.type,
                tcNo: client.tcNo ?? "",
                taxNo: client.taxNo ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                notes: client.notes ?? ""
              }}
            />
            <ClientArchiveButton clientId={client.id} redirectTo="/clients" />
            </>
          )}
          </>
        }
      />
      <DetailTabs />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Toplam Tahsilat" value={formatDirectionalMoney(totalIncome, "IN")} icon={HandCoins} tone="green" />
        <MetricCard title="Toplam Gider" value={formatDirectionalMoney(totalExpense, "OUT")} icon={ReceiptText} tone="rose" />
        <MetricCard title="Yansıtılabilir Masraf" value={formatMoney(clientExpenseTotal)} icon={BriefcaseBusiness} tone="amber" />
        <MetricCard title="Açık Alacak" value={formatDirectionalMoney(openReceivableTotal, "IN")} icon={Scale} tone={openReceivableTotal > 0 ? "green" : "neutral"} />
        <MetricCard title="Net Bakiye" value={formatSignedMoney(netBalance)} icon={CircleDollarSign} tone={netBalance >= 0 ? "green" : "rose"} />
      </div>

      <section id="overview" className="surface scroll-mt-24 p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-950">Genel Bilgiler</h3>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Ad / Ünvan" value={client.name} />
          <InfoRow label="Tür" value={clientTypeLabels[client.type]} />
          <InfoRow label="T.C. No" value={client.tcNo} />
          <InfoRow label="Vergi No" value={client.taxNo} />
          <InfoRow label="Telefon" value={client.phone} />
          <InfoRow label="E-posta" value={client.email} />
          <InfoRow label="Adres" value={client.address} />
          <InfoRow label="Kayıt Tarihi" value={formatDate(client.createdAt)} />
        </dl>
      </section>

      <section id="finance" className="scroll-mt-24 space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Bağlı Dosyalar</h3>
        <DataTable
          rows={client.cases}
          empty="Bu müvekkile bağlı dosya yok"
          columns={[
            {
              header: "Başlık",
              cell: (row) => (
                <Link href={`/cases/${row.id}`} className="font-medium text-slate-950 hover:text-slate-700">
                  {row.title}
                </Link>
              )
            },
            { header: "Dosya No", cell: (row) => row.fileNumber ?? "-" },
            { header: "Mahkeme / Daire", cell: (row) => row.courtOrOffice ?? "-" },
            { header: "Tür", cell: (row) => row.caseType ?? "-" },
            {
              header: "Durum",
              cell: (row) => (
                <StatusBadge tone={row.status === "ACTIVE" ? "green" : row.status === "CLOSED" ? "neutral" : "amber"}>
                  {caseStatusLabels[row.status]}
                </StatusBadge>
              )
            },
            { header: "Kayıt", cell: (row) => formatDate(row.createdAt) },
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
                  <ConfirmActionButton
                    endpoint={`/api/cases/${row.id}`}
                    label="Sil/Arşivle"
                    title="Dosya silinsin/arşivlensin mi?"
                    description={`${row.title} normal listelerden ve finans raporlarından çıkarılacak. Bağlı tahsilat, gider ve makbuz kayıtları silinmez.`}
                    confirmLabel="Sil/Arşivle"
                    successMessage="Dosya silindi."
                  />
                </div>
              )
            }
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Son İşlemler</h3>
        <DataTable
          rows={latestTransactions}
          empty="Henüz işlem yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.date) },
            { header: "Tür", cell: (row) => row.type },
            { header: "Kategori", cell: (row) => row.category },
            { header: "Dosya", cell: (row) => row.caseFile },
            {
              header: "Tutar",
              cell: (row) => (
                <span className={`font-medium tabular-finance ${row.tone === "green" ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatSignedMoney(row.amount)}
                </span>
              )
            }
          ]}
        />
      </section>

      <div id="documents" className="scroll-mt-24">
        <DocumentLinksSection
          entityType="CLIENT"
          entityId={client.id}
          documents={documentLinks.documents}
          options={documentLinks.options}
          uploadHref={documentLinks.uploadHref}
        />
      </div>
      <DetailActivityLog userId={user.id} entityType="CLIENT" entityId={client.id} />

      <section className="surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">Notlar</h3>
        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{client.notes || "Not girilmemiş."}</p>
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
