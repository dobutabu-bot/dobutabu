import {
  Bitcoin,
  BriefcaseBusiness,
  ChartCandlestick,
  CircleDollarSign,
  Download,
  Gem,
  Landmark,
  PiggyBank,
  Scale,
  TrendingDown,
  UploadCloud,
  WalletCards
} from "lucide-react";
import Link from "next/link";

import { AmountText } from "@/components/amount-text";
import { CapitalSnapshotButton } from "@/components/capital-snapshot-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { EmptyState } from "@/components/empty-state";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { CategoryPieChart, FinanceChartPanel, HorizontalBarChart } from "@/components/finance-charts";
import { MetricCard } from "@/components/metric-card";
import { PremiumCard } from "@/components/premium-card";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import { RecordCreateButton } from "@/components/record-create-button";
import { RecordEditButton } from "@/components/record-edit-button";
import { StatusBadge } from "@/components/status-badge";
import type { getCapitalCenterData } from "@/lib/capital/capital-data";
import { assetTypeLabels, toOptions } from "@/lib/labels";
import { cn, dateInputValue, formatMoney } from "@/lib/utils";

type CapitalCenterData = Awaited<ReturnType<typeof getCapitalCenterData>>;

export function CapitalCenterScreen({ data }: { data: CapitalCenterData }) {
  const assetFields = assetAccountFields(data.cashAccountOptions);

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">V3 Sermaye Merkezi</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Sermaye / Varlık Merkezi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Nakit, banka, döviz, altın, borsa, crypto, alacak ve borçlarınızı tek ekranda izleyin. Canlı fiyat ve yatırım tavsiyesi yoktur; değerler manuel kayıt amaçlıdır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RecordCreateButton
              label="Varlık Ekle"
              title="Varlık Ekle"
              endpoint="/api/capital/assets"
              schemaKey="assetAccount"
              fields={assetFields}
              defaults={assetDefaults()}
              submitLabel="Varlık ekle"
              successMessage="Varlık hesabı oluşturuldu."
              autoOpenParam="create"
            />
            <CapitalSnapshotButton currency={data.currency} />
            <Link href="/capital/import" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              <UploadCloud className="h-4 w-4" aria-hidden />
              Mali Bilgi Yükle
            </Link>
            <Link href="/capital/history" className="secondary-action min-h-11 border-white/15 bg-white/10 text-white hover:bg-white/15">
              Geçmiş
            </Link>
          </div>
        </div>
        <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          Bu ekran yatırım tavsiyesi değildir. Yalnızca kişisel/mesleki varlık takibi ve kayıt amacıyla kullanılır.
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        <MetricCard title="Toplam Varlık" value={data.summary.totalAssetsLabel} detail="Borçlar hariç pozitif varlıklar" icon={CircleDollarSign} tone="green" />
        <MetricCard title="Toplam Borç" value={data.summary.totalDebtsLabel} detail="Net sermayeden düşülür" icon={TrendingDown} tone="rose" />
        <MetricCard title="Net Sermaye" value={data.summary.netWorthLabel} detail="Toplam varlık - toplam borç" icon={Scale} tone={data.summary.netWorth >= 0 ? "green" : "rose"} />
        <MetricCard title="Nakit/Banka" value={data.summary.cashBankTotalLabel} detail="Likidite oranı" icon={WalletCards} tone="green" />
        <MetricCard title="Döviz" value={data.summary.fxTotalLabel} detail="Manuel değerleme" icon={Landmark} />
        <MetricCard title="Altın" value={data.summary.goldTotalLabel} detail="XAU/gram vb." icon={Gem} tone="amber" />
        <MetricCard title="Borsa/Fon" value={data.summary.stockTotalLabel} detail="Canlı fiyat yok" icon={ChartCandlestick} />
        <MetricCard title="Crypto" value={data.summary.cryptoTotalLabel} detail="Manuel kayıt" icon={Bitcoin} />
        <MetricCard title="Diğer Varlıklar" value={data.summary.otherTotalLabel} detail="Araç, taşınmaz, alacak vb." icon={BriefcaseBusiness} />
        <MetricCard title="Nakit Oranı" value={`%${data.summary.cashRatio.toLocaleString("tr-TR")}`} detail={`Volatil oran: %${data.summary.volatileRatio.toLocaleString("tr-TR")}`} icon={PiggyBank} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <FinanceChartPanel title="Varlık Dağılımı" description="Varlık türlerine göre toplam değer dağılımı." badge="DONUT">
          <CategoryPieChart data={data.assetTypeDistribution} showLegend size="md" />
        </FinanceChartPanel>
        <FinanceChartPanel title="Para Birimi Dağılımı" description="Değerleme para birimine göre toplam değer." badge="PARA">
          <CategoryPieChart data={data.currencyDistribution} showLegend size="md" />
        </FinanceChartPanel>
        <FinanceChartPanel title="Riskli / Volatil Oran" description="Döviz, altın, borsa, fon ve crypto ağırlığı." badge="RİSK">
          <HorizontalBarChart data={data.ratioDistribution} dataKeyName="Tutar" tone="balance" size="sm" />
        </FinanceChartPanel>
        <FinanceChartPanel title="Nakit Oranı" description="Nakit ve banka varlıklarının toplam varlıklara oranı." badge="LİKİDİTE">
          <HorizontalBarChart data={data.cashRatioDistribution} dataKeyName="Tutar" tone="income" size="sm" />
        </FinanceChartPanel>
      </section>

      {data.cashAccountSuggestions.length > 0 ? (
        <section className="surface p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-950">Dijital Kasadan Varlık Önerileri</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Aşağıdaki kasa hesapları sermaye merkezine otomatik eklenmez. İsterseniz onaylayıp varlık hesabı olarak bağlayabilirsiniz.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {data.cashAccountSuggestions.map((suggestion) => (
              <article key={suggestion.cashAccountId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">{suggestion.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Kasa bakiyesi: <PrivacyAmount>{suggestion.balanceLabel}</PrivacyAmount>
                    </p>
                  </div>
                  <StatusBadge tone={suggestion.suggestedAssetType === "DEBT" ? "rose" : "neutral"}>{suggestion.suggestedAssetTypeLabel}</StatusBadge>
                </div>
                <div className="mt-4 flex justify-end">
                  <RecordCreateButton
                    label="Varlığa bağla"
                    title="Kasa Hesabını Sermayeye Bağla"
                    endpoint="/api/capital/assets"
                    schemaKey="assetAccount"
                    fields={assetFields}
                    defaults={assetDefaults({
                      name: suggestion.name,
                      assetType: suggestion.suggestedAssetType,
                      currency: suggestion.currency,
                      symbol: suggestion.currency,
                      manualTotalValue: String(Math.abs(suggestion.balance)),
                      valuationCurrency: suggestion.currency,
                      linkedCashAccountId: suggestion.cashAccountId,
                      description: "Dijital kasa hesabından önerildi. Kullanıcı onayıyla eklendi."
                    })}
                    submitLabel="Onayla ve bağla"
                    successMessage="Kasa hesabı sermaye merkezine bağlandı."
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <EntityForm
        title="Varlık Ekle"
        endpoint="/api/capital/assets"
        schemaKey="assetAccount"
        defaults={assetDefaults()}
        fields={assetFields}
        submitLabel="Varlık ekle"
        successMessage="Varlık hesabı oluşturuldu."
      />

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Varlık Kartları</h2>
          <p className="mt-1 text-sm text-slate-500">Değerleri manuel güncelleyebilir, kasa hesabına bağlı varlıkları dijital kasa bakiyesiyle izleyebilirsiniz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/api/export?resource=capitalAssets&format=csv" className="secondary-action min-h-10">
            <Download className="h-4 w-4" aria-hidden />
            Varlık CSV
          </Link>
          <Link href="/api/export?resource=assetValuations&format=csv" className="secondary-action min-h-10">
            <Download className="h-4 w-4" aria-hidden />
            Değerleme CSV
          </Link>
          <Link href="/api/reports/capital/pdf" className="secondary-action min-h-10">
            <Download className="h-4 w-4" aria-hidden />
            PDF
          </Link>
        </div>
      </section>

      {data.assets.length === 0 ? (
        <section className="surface p-4">
          <EmptyState title="Henüz varlık kaydı yok" description="Nakit, banka, döviz, altın, borsa, crypto veya borç kaydı ekleyerek sermaye merkezini kullanmaya başlayın." />
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} assetFields={assetFields} />
          ))}
        </section>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  assetFields
}: {
  asset: CapitalCenterData["assets"][number];
  assetFields: EntityFormField[];
}) {
  const valueTone = asset.assetType === "DEBT" || asset.currentValue < 0 ? "rose" : asset.currentValue > 0 ? "green" : "neutral";
  const valuationFields = assetValuationFields(asset.valuationCurrency);

  return (
    <PremiumCard as="article" className={cn("p-4", asset.assetType === "DEBT" && "border-rose-200 bg-rose-50/60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-950">{asset.name}</h3>
            <StatusBadge tone={asset.assetType === "DEBT" ? "rose" : "neutral"}>{asset.assetTypeLabel}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {asset.symbol || asset.currency || "Sembol yok"}
            {asset.linkedCashAccountName ? ` · ${asset.linkedCashAccountName}` : ""}
          </p>
        </div>
        <StatusBadge tone={asset.isActive ? "green" : "amber"}>{asset.isActive ? "Aktif" : "Pasif"}</StatusBadge>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Toplam değer</p>
        <div className="mt-1">
          <AmountText value={asset.currentValue} currency={asset.valuationCurrency} showSign={asset.assetType === "DEBT"} size="xl" variant="strong" />
        </div>
        <p className="mt-1 text-xs text-slate-500">Son güncelleme: {asset.lastUpdateLabel}</p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <InfoTile label="Miktar" value={asset.quantity?.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) ?? "-"} />
        <InfoTile label="Birim fiyat" value={asset.unitPrice != null ? formatMoney(asset.unitPrice, asset.valuationCurrency) : "-"} />
        <InfoTile label="Değerleme" value={asset.valuationCurrency} />
        <InfoTile label="Durum" value={valueTone === "rose" ? "Negatif" : valueTone === "green" ? "Pozitif" : "Nötr"} />
      </dl>

      {asset.description ? <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{asset.description}</p> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <RecordCreateButton
          label="Güncelle"
          title="Değer Güncelle"
          endpoint={`/api/capital/assets/${asset.id}/valuations`}
          schemaKey="assetValuation"
          fields={valuationFields}
          defaults={{
            valuationDate: dateInputValue(),
            quantity: asset.quantity?.toString() ?? "",
            unitPrice: asset.unitPrice?.toString() ?? "",
            totalValue: asset.absoluteValue.toString(),
            valuationCurrency: asset.valuationCurrency,
            note: ""
          }}
          submitLabel="Değeri güncelle"
          successMessage="Varlık değeri güncellendi."
        />
        <RecordEditButton
          title="Varlık Düzenle"
          endpoint={`/api/capital/assets/${asset.id}`}
          schemaKey="assetAccount"
          fields={assetFields}
          defaults={{
            name: asset.name,
            assetType: asset.assetType,
            currency: asset.currency,
            symbol: asset.symbol,
            quantity: asset.quantity?.toString() ?? "",
            unitPrice: asset.unitPrice?.toString() ?? "",
            manualTotalValue: asset.absoluteValue.toString(),
            valuationCurrency: asset.valuationCurrency,
            linkedCashAccountId: asset.linkedCashAccountId ?? "",
            description: asset.description,
            isActive: asset.isActive ? "true" : "false"
          }}
          successMessage="Varlık hesabı güncellendi."
        />
        <ConfirmActionButton
          endpoint={`/api/capital/assets/${asset.id}`}
          label="Sil"
          title="Varlık silinsin mi?"
          description="Bu varlık normal listeden kaldırılır. Geçmiş değerleme kayıtları korunur."
          confirmLabel="Sil"
          successMessage="Varlık hesabı silindi."
        />
      </div>
    </PremiumCard>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <PrivacyAmount as="dd" className="mt-1 truncate text-sm font-semibold text-slate-800 tabular-nums">
        {value}
      </PrivacyAmount>
    </div>
  );
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

function assetValuationFields(currency: string): EntityFormField[] {
  return [
    { name: "valuationDate", label: "Tarih", type: "date" },
    { name: "quantity", label: "Yeni miktar", type: "number", min: "0", step: "0.00000001" },
    { name: "unitPrice", label: "Yeni birim fiyat", type: "number", min: "0", step: "0.01" },
    { name: "totalValue", label: "Yeni toplam değer", type: "number", min: "0", step: "0.01" },
    { name: "valuationCurrency", label: "Değerleme para birimi", placeholder: currency },
    { name: "note", label: "Not", type: "textarea", className: "md:col-span-2 xl:col-span-3" }
  ];
}

function assetDefaults(overrides: Partial<Record<string, string>> = {}) {
  return {
    name: "",
    assetType: "BANK",
    currency: "TRY",
    symbol: "",
    quantity: "",
    unitPrice: "",
    manualTotalValue: "",
    valuationCurrency: "TRY",
    linkedCashAccountId: "",
    description: "",
    isActive: "true",
    ...overrides
  };
}
