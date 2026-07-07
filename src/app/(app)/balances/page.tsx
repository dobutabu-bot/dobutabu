import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { balanceStatusLabels, balanceTypeLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/utils";

type BalanceRow = {
  date: Date;
  client: string;
  caseFile: string;
  type: keyof typeof balanceTypeLabels;
  status: keyof typeof balanceStatusLabels;
  description: string;
  amount: unknown;
};

export default async function BalancesPage() {
  const user = await requireUser();
  const [clients, cases, receivables, debtExpenses, openReceivables, openDebts] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.invoiceOrReceipt.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: { in: ["ISSUED", "UNPAID", "PAID"] }
      },
      orderBy: { issueDate: "desc" },
      include: { client: true, caseFile: true },
      take: 100
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isClientExpense: false,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true },
      take: 100
    }),
    prisma.invoiceOrReceipt.aggregate({
      _sum: { netAmount: true },
      where: {
        userId: user.id,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: { in: ["ISSUED", "UNPAID"] }
      }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId: user.id,
        deletedAt: null,
        isClientExpense: false,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      }
    })
  ]);

  const rows: BalanceRow[] = [
    ...receivables.map((row) => ({
      date: row.issueDate,
      client: row.client.name,
      caseFile: row.caseFile?.title ?? "-",
      type: "RECEIVABLE" as const,
      status: row.status === "PAID" ? ("PAID" as const) : ("OPEN" as const),
      description: row.notes ?? row.number,
      amount: row.netAmount
    })),
    ...debtExpenses.map((row) => ({
      date: row.date,
      client: row.client?.name ?? "-",
      caseFile: row.caseFile?.title ?? "-",
      type: "DEBT" as const,
      status: "OPEN" as const,
      description: row.description ?? "Gider",
      amount: row.amount
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          title="Açık Alacak"
          value={formatMoney(openReceivables._sum.netAmount)}
          icon={ArrowUpRight}
          tone="green"
        />
        <MetricCard
          title="Takip Edilen Borç"
          value={formatMoney(openDebts._sum.amount)}
          icon={ArrowDownRight}
          tone="rose"
        />
      </div>

      <EntityForm
        title="Alacak / Borç Ekle"
        endpoint="/api/balances"
        schemaKey="balance"
        defaults={{
          clientId: "",
          caseFileId: "",
          type: "RECEIVABLE",
          description: "",
          amount: "",
          dueDate: "",
          status: "OPEN",
          notes: ""
        }}
        fields={[
          { name: "clientId", label: "Müvekkil", type: "select", options: clientOptions },
          { name: "caseFileId", label: "Dosya", type: "select", options: caseOptions },
          { name: "type", label: "Tür", type: "select", options: toOptions(balanceTypeLabels) },
          { name: "status", label: "Durum", type: "select", options: toOptions(balanceStatusLabels) },
          { name: "description", label: "Açıklama" },
          { name: "amount", label: "Tutar", type: "number", min: "0", step: "0.01" },
          { name: "dueDate", label: "Vade", type: "date" },
          { name: "notes", label: "Not", type: "textarea", className: "md:col-span-2" }
        ]}
      />

      <DataTable
        rows={rows}
        empty="Henüz alacak/borç kaydı yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.date) },
          { header: "Müvekkil", cell: (row) => row.client },
          { header: "Dosya", cell: (row) => row.caseFile },
          {
            header: "Tür",
            cell: (row) => (
              <StatusBadge tone={row.type === "RECEIVABLE" ? "green" : "rose"}>
                {balanceTypeLabels[row.type]}
              </StatusBadge>
            )
          },
          {
            header: "Durum",
            cell: (row) => (
              <StatusBadge tone={row.status === "OPEN" ? "amber" : row.status === "PAID" ? "green" : "neutral"}>
                {balanceStatusLabels[row.status]}
              </StatusBadge>
            )
          },
          { header: "Açıklama", cell: (row) => row.description },
          { header: "Tutar", cell: (row) => formatMoney(row.amount), className: "font-medium text-slate-950" }
        ]}
      />
    </div>
  );
}
