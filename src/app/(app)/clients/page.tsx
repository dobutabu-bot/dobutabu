import type { Prisma } from "@prisma/client";
import { Archive, Search } from "lucide-react";
import Link from "next/link";

import { ClientArchiveButton } from "@/components/client-archive-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { clientTypeLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type ClientsPageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";
  const where: Prisma.ClientWhereInput = {
    userId: user.id,
    deletedAt: null,
    archivedAt: showArchived ? { not: null } : null,
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { tcNo: { contains: query } },
            { taxNo: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query } }
          ]
        }
      : {})
  };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: { where: { deletedAt: null, status: { not: "ARCHIVED" } } } } } }
  });
  const clientFields = [
    { name: "name", label: "Ad / Ünvan" },
    { name: "type", label: "Tür", type: "select" as const, options: toOptions(clientTypeLabels) },
    { name: "tcNo", label: "T.C. No" },
    { name: "taxNo", label: "Vergi No" },
    { name: "email", label: "E-posta", type: "email" as const },
    { name: "phone", label: "Telefon", type: "tel" as const },
    { name: "address", label: "Adres" },
    { name: "notes", label: "Not", type: "textarea" as const, className: "md:col-span-2 xl:col-span-3" }
  ];

  return (
    <div className="space-y-5">
      <EntityForm
        title="Müvekkil Ekle"
        endpoint="/api/clients"
        schemaKey="client"
        defaults={{
          name: "",
          type: "INDIVIDUAL",
          tcNo: "",
          taxNo: "",
          email: "",
          phone: "",
          address: "",
          notes: ""
        }}
        fields={clientFields}
      />

      <section className="surface p-4">
        <form className="flex flex-col gap-3 sm:flex-row" action="/clients">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="label">Müvekkil Ara</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="field pl-9"
                name="q"
                defaultValue={query}
                placeholder="Ad, T.C., vergi no, telefon veya e-posta"
              />
            </div>
          </label>
          {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Ara
            </button>
            <Link
              href={showArchived ? "/clients" : "/clients?archived=1"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Archive className="h-4 w-4" aria-hidden />
              {showArchived ? "Aktifler" : "Arşiv"}
            </Link>
          </div>
        </form>
      </section>

      <DataTable
        rows={clients}
        empty={showArchived ? "Arşivde müvekkil yok" : "Henüz müvekkil yok"}
        columns={[
          {
            header: "Ad / Ünvan",
            cell: (row) => (
              <Link href={`/clients/${row.id}`} className="font-medium text-slate-950 hover:text-slate-700">
                {row.name}
              </Link>
            )
          },
          { header: "Tür", cell: (row) => clientTypeLabels[row.type] },
          { header: "T.C./Vergi", cell: (row) => row.tcNo ?? row.taxNo ?? "-" },
          { header: "Telefon", cell: (row) => row.phone ?? "-" },
          { header: "E-posta", cell: (row) => row.email ?? "-" },
          { header: "Dosya", cell: (row) => row._count.cases },
          {
            header: "Durum",
            cell: (row) => (
              <StatusBadge tone={row.archivedAt ? "neutral" : "green"}>
                {row.archivedAt ? "Arşiv" : "Aktif"}
              </StatusBadge>
            )
          },
          { header: "Kayıt", cell: (row) => formatDate(row.createdAt) },
          {
            header: "İşlem",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/clients/${row.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  Detay
                </Link>
                <RecordEditButton
                  title="Müvekkil Düzenle"
                  endpoint={`/api/clients/${row.id}`}
                  schemaKey="client"
                  fields={clientFields}
                  successMessage="Müvekkil güncellendi."
                  defaults={{
                    name: row.name,
                    type: row.type,
                    tcNo: row.tcNo ?? "",
                    taxNo: row.taxNo ?? "",
                    email: row.email ?? "",
                    phone: row.phone ?? "",
                    address: row.address ?? "",
                    notes: row.notes ?? ""
                  }}
                />
                {row.archivedAt ? null : <ClientArchiveButton clientId={row.id} />}
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
