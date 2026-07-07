import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { advanceDirectionLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { dateInputValue, formatDate, formatMoney } from "@/lib/utils";

type AdvanceRow = {
  date: Date;
  client: string;
  caseFile: string;
  description: string;
  direction: keyof typeof advanceDirectionLabels;
  amount: unknown;
};

export default async function AdvancesPage() {
  const user = await requireUser();
  const [clients, cases, receivedAdvances, spentAdvances] = await Promise.all([
    prisma.client.findMany({ where: { userId: user.id, archivedAt: null, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.caseFile.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "ARCHIVED" }, client: { archivedAt: null, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    }),
    prisma.income.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        category: "ADVANCE",
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
      },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true },
      take: 100
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isClientExpense: true,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true },
      take: 100
    })
  ]);

  const rows: AdvanceRow[] = [
    ...receivedAdvances.map((row) => ({
      date: row.date,
      client: row.client.name,
      caseFile: row.caseFile?.title ?? "-",
      description: row.description ?? "-",
      direction: "RECEIVED" as const,
      amount: row.amount
    })),
    ...spentAdvances.map((row) => ({
      date: row.date,
      client: row.client?.name ?? "-",
      caseFile: row.caseFile?.title ?? "-",
      description: row.description ?? "-",
      direction: "SPENT" as const,
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
      <EntityForm
        title="Masraf Avansı Ekle"
        endpoint="/api/advances"
        schemaKey="advance"
        defaults={{
          clientId: "",
          caseFileId: "",
          description: "",
          amount: "",
          direction: "RECEIVED",
          occurredAt: dateInputValue(),
          notes: ""
        }}
        fields={[
          { name: "clientId", label: "Müvekkil", type: "select", options: clientOptions },
          { name: "caseFileId", label: "Dosya", type: "select", options: caseOptions },
          { name: "description", label: "Açıklama" },
          { name: "amount", label: "Tutar", type: "number", min: "0", step: "0.01" },
          {
            name: "direction",
            label: "Yön",
            type: "select",
            options: [
              { label: advanceDirectionLabels.RECEIVED, value: "RECEIVED" },
              { label: advanceDirectionLabels.SPENT, value: "SPENT" }
            ]
          },
          { name: "occurredAt", label: "Tarih", type: "date" },
          { name: "notes", label: "Not", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
        ]}
      />

      <DataTable
        rows={rows}
        empty="Henüz masraf avansı yok"
        columns={[
          { header: "Tarih", cell: (row) => formatDate(row.date) },
          { header: "Müvekkil", cell: (row) => row.client },
          { header: "Dosya", cell: (row) => row.caseFile },
          { header: "Açıklama", cell: (row) => row.description },
          {
            header: "Yön",
            cell: (row) => (
              <StatusBadge tone={row.direction === "RECEIVED" ? "green" : "amber"}>
                {advanceDirectionLabels[row.direction]}
              </StatusBadge>
            )
          },
          { header: "Tutar", cell: (row) => formatMoney(row.amount), className: "font-medium text-slate-950" }
        ]}
      />
    </div>
  );
}
