import { Activity, BarChart3, FileText, Landmark, Scale, TrendingDown } from "lucide-react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DataTable } from "@/components/data-table";
import { DetailActivityLog } from "@/components/detail-activity-log";
import { DetailBreadcrumb, DetailHero, DetailInfoRow, DetailSection, DetailTabs } from "@/components/detail-shell";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { assetTransactionTypeLabels, assetTypeLabels, assetValuationSourceLabels, toOptions } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, toNumber } from "@/lib/utils";
import type { EntityFormField } from "@/components/entity-form";

type AssetDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const [asset, cashAccounts] = await Promise.all([
    prisma.assetAccount.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: {
        linkedCashAccount: true,
        sourceDocument: {
          select: {
            id: true,
            title: true,
            originalFileName: true,
            mimeType: true,
            deletedAt: true
          }
        },
        valuations: {
          where: { deletedAt: null },
          orderBy: { valuationDate: "desc" },
          take: 20
        },
        transactions: {
          where: { deletedAt: null },
          orderBy: { date: "desc" },
          take: 20,
          include: {
            linkedCashLedgerEntry: {
              select: {
                id: true,
                description: true,
                date: true,
                deletedAt: true
              }
            }
          }
        }
      }
    }),
    prisma.cashAccount.findMany({
      where: { userId: user.id, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, currency: true }
    })
  ]);

  if (!asset) {
    notFound();
  }

  const fields = assetAccountFields(
    cashAccounts.map((account) => ({
      value: account.id,
      label: `${account.name} · ${account.type} · ${account.currency}`
    }))
  );
  const currentValue = resolveAssetValue(asset);
  const absoluteValue = Math.abs(currentValue);
  const valueTone = asset.assetType === "DEBT" || currentValue < 0 ? "rose" : currentValue > 0 ? "green" : "neutral";
  const latestValuation = asset.valuations[0];
  const sourceDocument = asset.sourceDocument?.deletedAt ? null : asset.sourceDocument;

  return (
    <div className="space-y-5">
      <DetailBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sermaye", href: "/capital" },
          { label: "Varlıklar", href: "/capital/assets" },
          { label: asset.name }
        ]}
      />

      <DetailHero
        eyebrow={assetTypeLabels[asset.assetType]}
        title={asset.name}
        description={[
          asset.symbol || asset.currency || "Sembol yok",
          asset.linkedCashAccount?.name ? `Kasa: ${asset.linkedCashAccount.name}` : null,
          asset.description
        ]
          .filter(Boolean)
          .join(" · ")}
        status={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={asset.isActive ? "green" : "amber"}>{asset.isActive ? "Aktif" : "Pasif"}</StatusBadge>
            <StatusBadge tone={asset.assetType === "DEBT" ? "rose" : "neutral"}>{assetTypeLabels[asset.assetType]}</StatusBadge>
          </div>
        }
        actions={
          <>
            <Link href="/capital/assets" className="secondary-action min-h-11 border-white/15 bg-white/10 px-4 text-white hover:bg-white/15">
              Varlıklar
            </Link>
            <RecordEditButton
              title="Varlık Düzenle"
              endpoint={`/api/capital/assets/${asset.id}`}
              schemaKey="assetAccount"
              fields={fields}
              defaults={{
                name: asset.name,
                assetType: asset.assetType,
                currency: asset.currency ?? "",
                symbol: asset.symbol ?? "",
                quantity: asset.quantity?.toString() ?? "",
                unitPrice: asset.unitPrice?.toString() ?? "",
                manualTotalValue: absoluteValue.toString(),
                valuationCurrency: asset.valuationCurrency,
                linkedCashAccountId: asset.linkedCashAccountId ?? "",
                description: asset.description ?? "",
                isActive: asset.isActive ? "true" : "false"
              }}
              successMessage="Varlık hesabı güncellendi."
            />
            <ConfirmActionButton
              endpoint={`/api/capital/assets/${asset.id}`}
              label="Sil"
              title="Varlık silinsin mi?"
              description="Bu varlık normal listeden kaldırılır. Değerleme geçmişi geri alma için korunur."
              confirmLabel="Sil"
              redirectTo="/capital/assets"
              successMessage="Varlık hesabı silindi."
            />
          </>
        }
      />

      <DetailTabs
        tabs={[
          { href: "#overview", label: "Genel Bakış" },
          { href: "#finance", label: "Finans" },
          { href: "#documents", label: "Belgeler" },
          { href: "#activity", label: "İşlem Geçmişi" }
        ]}
      />

      <section id="overview" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Güncel Değer"
          value={formatMoney(currentValue, asset.valuationCurrency)}
          detail={asset.assetType === "DEBT" ? "Net sermayeden düşülür" : "Net sermayeye dahil edilir"}
          icon={Scale}
          tone={valueTone}
        />
        <MetricCard
          title="Miktar"
          value={asset.quantity?.toString() ?? "-"}
          detail={asset.symbol || asset.currency || "Manuel değer"}
          icon={BarChart3}
        />
        <MetricCard
          title="Birim Fiyat"
          value={asset.unitPrice ? formatMoney(asset.unitPrice, asset.valuationCurrency) : "-"}
          detail="Canlı fiyat entegrasyonu yok"
          icon={TrendingDown}
          tone="amber"
        />
        <MetricCard
          title="Son Değerleme"
          value={latestValuation ? formatDate(latestValuation.valuationDate) : formatDate(asset.updatedAt)}
          detail={latestValuation ? assetValuationSourceLabels[latestValuation.source] : "Varlık kaydı"}
          icon={Activity}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <DetailSection title="Genel Bilgiler" description="Varlık kaydının temel sınıflandırması ve bağlantıları.">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailInfoRow label="Varlık Türü" value={assetTypeLabels[asset.assetType]} />
              <DetailInfoRow label="Para Birimi" value={asset.currency || "-"} />
              <DetailInfoRow label="Sembol" value={asset.symbol || "-"} />
              <DetailInfoRow label="Değerleme Para Birimi" value={asset.valuationCurrency} />
              <DetailInfoRow label="Bağlı Kasa" value={asset.linkedCashAccount?.name || "-"} />
              <DetailInfoRow label="Durum" value={asset.isActive ? "Aktif" : "Pasif"} />
              <DetailInfoRow label="Oluşturma" value={formatDate(asset.createdAt)} />
              <DetailInfoRow label="Güncelleme" value={formatDate(asset.updatedAt)} />
            </div>
          </DetailSection>

          <DetailSection id="finance" title="Finans ve Değerleme" description="Son değerlemeler ve varlık hareketleri.">
            <div className="space-y-4">
              <DataTable
                rows={asset.valuations}
                empty="Henüz değerleme kaydı yok."
                columns={[
                  { header: "Tarih", cell: (row) => formatDate(row.valuationDate) },
                  { header: "Toplam Değer", cell: (row) => formatMoney(row.totalValue, row.valuationCurrency), className: "text-right" },
                  { header: "Miktar", cell: (row) => row.quantity?.toString() ?? "-" },
                  { header: "Birim Fiyat", cell: (row) => (row.unitPrice ? formatMoney(row.unitPrice, row.valuationCurrency) : "-") },
                  { header: "Kaynak", cell: (row) => assetValuationSourceLabels[row.source] },
                  { header: "Not", cell: (row) => row.note || "-" }
                ]}
              />

              <DataTable
                rows={asset.transactions}
                empty="Henüz varlık hareketi yok."
                columns={[
                  { header: "Tarih", cell: (row) => formatDate(row.date) },
                  { header: "Tür", cell: (row) => assetTransactionTypeLabels[row.transactionType] },
                  { header: "Tutar", cell: (row) => formatMoney(row.totalAmount, row.currency), className: "text-right" },
                  { header: "Açıklama", cell: (row) => row.description || "-" },
                  {
                    header: "Kasa Hareketi",
                    cell: (row) =>
                      row.linkedCashLedgerEntry && !row.linkedCashLedgerEntry.deletedAt ? (
                        <Link href={`/cash/ledger/${row.linkedCashLedgerEntry.id}`} className="font-medium text-indigo-700 hover:underline">
                          {row.linkedCashLedgerEntry.description || formatDate(row.linkedCashLedgerEntry.date)}
                        </Link>
                      ) : (
                        "-"
                      )
                  }
                ]}
              />
            </div>
          </DetailSection>
        </div>

        <aside className="space-y-5">
          <DetailSection id="documents" title="Belgeler" description="Bu varlığa kaynak olan belge ve kayıt kanıtları.">
            {sourceDocument ? (
              <article className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kaynak Belge</p>
                    <Link href={`/documents/${sourceDocument.id}`} className="mt-1 block break-words text-sm font-semibold text-slate-950 hover:underline">
                      {sourceDocument.title}
                    </Link>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                      {sourceDocument.originalFileName} · {sourceDocument.mimeType}
                    </p>
                  </div>
                </div>
              </article>
            ) : (
              <EmptyState title="Bağlı belge yok" description="Bu varlık manuel girilmiş olabilir veya kaynak belge daha sonra ilişkilendirilebilir." />
            )}
          </DetailSection>

          <DetailSection title="İlgili Kayıtlar" description="Kasa ve değerleme bağlantıları.">
            <div className="space-y-3">
              {asset.linkedCashAccount ? (
                <Link href="/cash/accounts" className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-50">
                  <Landmark className="h-4 w-4 text-indigo-600" aria-hidden />
                  {asset.linkedCashAccount.name}
                </Link>
              ) : null}
              {asset.valuations.length === 0 && asset.transactions.length === 0 && !asset.linkedCashAccount ? (
                <EmptyState title="İlgili kayıt yok" description="Bu varlık henüz yalnızca temel hesap bilgisiyle duruyor." />
              ) : null}
            </div>
          </DetailSection>
        </aside>
      </div>

      <DetailActivityLog userId={user.id} entityType="ASSET_ACCOUNT" entityId={asset.id} />
    </div>
  );
}

function resolveAssetValue(asset: {
  assetType: string;
  quantity: unknown;
  unitPrice: unknown;
  manualTotalValue: unknown;
  valuations: Array<{ totalValue: unknown }>;
}) {
  const latest = asset.valuations[0];
  const rawValue =
    latest?.totalValue != null
      ? toNumber(latest.totalValue)
      : asset.manualTotalValue != null
        ? toNumber(asset.manualTotalValue)
        : toNumber(asset.quantity) * toNumber(asset.unitPrice);

  return asset.assetType === "DEBT" ? -Math.abs(rawValue) : rawValue;
}

function assetAccountFields(cashAccountOptions: Array<{ label: string; value: string }>): EntityFormField[] {
  return [
    { name: "name", label: "Varlık adı", placeholder: "Ana kasa, USD hesabı, Gram altın, BTC, kredi kartı borcu" },
    { name: "assetType", label: "Tür", type: "select", options: toOptions(assetTypeLabels) },
    { name: "currency", label: "Para birimi", placeholder: "TRY, USD, EUR" },
    { name: "symbol", label: "Sembol", placeholder: "USD, XAU, BTC, AAPL, THYAO" },
    { name: "quantity", label: "Miktar", type: "number", min: "0", step: "0.00000001" },
    { name: "unitPrice", label: "Birim fiyat", type: "number", min: "0", step: "0.01" },
    { name: "manualTotalValue", label: "Toplam değer", type: "number", min: "0", step: "0.01" },
    { name: "valuationCurrency", label: "Değerleme para birimi", placeholder: "TRY" },
    {
      name: "linkedCashAccountId",
      label: "Kasa hesabına bağla",
      type: "select",
      options: [{ label: "Bağlama", value: "" }, ...cashAccountOptions]
    },
    {
      name: "isActive",
      label: "Aktif mi?",
      type: "select",
      options: [
        { label: "Evet", value: "true" },
        { label: "Hayır", value: "false" }
      ]
    },
    { name: "description", label: "Açıklama", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
  ];
}
