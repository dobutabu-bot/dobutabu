import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { requireUser } from "@/lib/auth";
import { documentTypeOptions } from "@/lib/document-labels";
import { expenseCategoryLabels, incomeCategoryLabels, receiptTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatDirectionalMoney, formatMoney } from "@/lib/utils";

type EditDocumentPageProps = {
  params: Promise<{ id: string }>;
};

type SelectOption = {
  label: string;
  value: string;
};

export default async function EditDocumentPage({ params }: EditDocumentPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [
    document,
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    cashLedgerEntries
  ] = await Promise.all([
    prisma.document.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { tags: { include: { tag: true } } }
    }),
    prisma.client.findMany({
      where: { userId: user.id, archivedAt: null, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
      take: 150
    }),
    prisma.income.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true } } },
      take: 100
    }),
    prisma.expense.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true } } },
      take: 100
    }),
    prisma.invoiceOrReceipt.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { issueDate: "desc" },
      include: { client: { select: { name: true } } },
      take: 100
    }),
    prisma.cashLedgerEntry.findMany({
      where: { userId: user.id, deletedAt: null, cashAccount: { deletedAt: null } },
      orderBy: { date: "desc" },
      include: { cashAccount: { select: { name: true } }, client: { select: { name: true } } },
      take: 120
    })
  ]);

  if (!document) {
    notFound();
  }

  const fields = documentFields({
    clients: withEmpty("Müvekkil yok", clients.map((client) => ({ label: client.name, value: client.id }))),
    caseFiles: withEmpty(
      "Dosya yok",
      caseFiles.map((caseFile) => ({
        label: `${caseFile.client.name} - ${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`,
        value: caseFile.id
      }))
    ),
    incomes: withEmpty(
      "Tahsilat yok",
      incomes.map((income) => ({
        label: `${formatDate(income.date)} · ${income.client.name} · ${incomeCategoryLabels[income.category]} · ${formatMoney(
          income.amount,
          income.currency
        )}`,
        value: income.id
      }))
    ),
    expenses: withEmpty(
      "Gider yok",
      expenses.map((expense) => ({
        label: `${formatDate(expense.date)} · ${expense.client?.name ?? "Genel gider"} · ${expenseCategoryLabels[expense.category]} · ${formatMoney(
          expense.amount,
          expense.currency
        )}`,
        value: expense.id
      }))
    ),
    invoiceOrReceipts: withEmpty(
      "Belge yok",
      invoiceOrReceipts.map((receipt) => ({
        label: `${formatDate(receipt.issueDate)} · ${receipt.client.name} · ${receiptTypeLabels[receipt.type]} ${receipt.number}`,
        value: receipt.id
      }))
    ),
    cashLedgerEntries: withEmpty(
      "Kasa hareketi yok",
      cashLedgerEntries.map((entry) => ({
        label: `${formatDate(entry.date)} · ${entry.cashAccount.name} · ${entry.client?.name ?? "Genel"} · ${formatDirectionalMoney(
          entry.amount,
          entry.direction,
          entry.currency
        )}`,
        value: entry.id
      }))
    )
  });

  return (
    <div className="space-y-4">
      <Link href={`/documents/${document.id}`} className="secondary-action w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Belge Detayına Dön
      </Link>

      <section className="surface-dark p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Belge Merkezi</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Belgeyi Düzenle</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Dosyanın kendisi değişmeden metadata, etiket ve bağlantılı kayıt bilgilerini güncelleyin.
        </p>
      </section>

      <EntityForm
        title="Belge Bilgileri"
        endpoint={`/api/documents/${document.id}`}
        method="PATCH"
        schemaKey="documentMetadata"
        fields={fields}
        defaults={{
          title: document.title,
          description: document.description ?? "",
          documentType: document.documentType,
          documentDate: document.documentDate ? dateInputValue(document.documentDate) : "",
          amount: document.amount?.toString() ?? "",
          currency: document.currency,
          linkedClientId: document.linkedClientId ?? "",
          linkedCaseFileId: document.linkedCaseFileId ?? "",
          linkedIncomeId: document.linkedIncomeId ?? "",
          linkedExpenseId: document.linkedExpenseId ?? "",
          linkedInvoiceOrReceiptId: document.linkedInvoiceOrReceiptId ?? "",
          linkedCashLedgerEntryId: document.linkedCashLedgerEntryId ?? "",
          tags: document.tags.map((item) => item.tag.name).join(", ")
        }}
        submitLabel="Belgeyi Güncelle"
        resetOnSuccess={false}
        successMessage="Belge güncellendi."
      />
    </div>
  );
}

function documentFields(options: {
  clients: SelectOption[];
  caseFiles: SelectOption[];
  incomes: SelectOption[];
  expenses: SelectOption[];
  invoiceOrReceipts: SelectOption[];
  cashLedgerEntries: SelectOption[];
}): EntityFormField[] {
  return [
    { name: "title", label: "Belge Başlığı", placeholder: "Örn. Temmuz banka dekontu" },
    { name: "documentType", label: "Belge Türü", type: "select", options: documentTypeOptions() },
    { name: "documentDate", label: "Belge Tarihi", type: "date" },
    { name: "amount", label: "Tutar", type: "number", min: "0", step: "0.01", placeholder: "0,00" },
    { name: "currency", label: "Para Birimi", placeholder: "TRY" },
    { name: "tags", label: "Etiketler", placeholder: "dekont, temmuz, banka" },
    {
      name: "description",
      label: "Açıklama",
      type: "textarea",
      placeholder: "Belgeyle ilgili kısa not",
      className: "md:col-span-2 xl:col-span-3"
    },
    { name: "linkedClientId", label: "Müvekkil", type: "select", options: options.clients },
    { name: "linkedCaseFileId", label: "Dosya", type: "select", options: options.caseFiles },
    { name: "linkedIncomeId", label: "Tahsilat", type: "select", options: options.incomes },
    { name: "linkedExpenseId", label: "Gider", type: "select", options: options.expenses },
    { name: "linkedInvoiceOrReceiptId", label: "Makbuz/Fatura", type: "select", options: options.invoiceOrReceipts },
    { name: "linkedCashLedgerEntryId", label: "Kasa Hareketi", type: "select", options: options.cashLedgerEntries }
  ];
}

function withEmpty(label: string, options: SelectOption[]) {
  return [{ label, value: "" }, ...options];
}
