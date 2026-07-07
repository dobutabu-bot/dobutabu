"use client";

import { ArrowRight, CheckCircle2, CloudUpload, FileSpreadsheet, Loader2, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { AmountText } from "@/components/amount-text";
import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { assetTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type CapitalImportType =
  | "BANK_STATEMENT"
  | "FX_STATEMENT"
  | "GOLD_STATEMENT"
  | "STOCK_PORTFOLIO"
  | "CRYPTO_PORTFOLIO"
  | "OTHER_FINANCIAL_DOCUMENT"
  | "MANUAL_ENTRY";

type AssetType = keyof typeof assetTypeLabels;
type ColumnKey = "name" | "symbol" | "quantity" | "unitPrice" | "totalValue" | "currency";

type CapitalImportSuggestion = {
  tempId: string;
  rowNumber: number | null;
  assetType: AssetType;
  name: string;
  symbol: string | null;
  currency: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalValue: number;
  totalValueLabel: string;
  valuationCurrency: string;
  confidence: number;
  confidenceLabel: string;
  confidenceLevel: "HIGH" | "LOW";
  note: string;
  rawData: Record<string, string>;
};

type SuggestionState = CapitalImportSuggestion & {
  decision: "ACCEPTED" | "REJECTED";
};

type CapitalImportPreview = {
  importType: CapitalImportType;
  sourceType: "CSV" | "XLSX" | "PDF" | "MANUAL";
  fileName: string | null;
  fileSize: number | null;
  columns: string[];
  previewRows: Record<string, string>[];
  detectedColumns: Partial<Record<ColumnKey, string>>;
  mapping: Partial<Record<ColumnKey, string>>;
  totalRows: number;
  suggestions: CapitalImportSuggestion[];
  highConfidenceSuggestions: CapitalImportSuggestion[];
  lowConfidenceSuggestions: CapitalImportSuggestion[];
  warning: string | null;
};

type CapitalImportWizardProps = {
  maxUploadMb: number;
};

const steps = ["Dosya yükle", "Dosya türü seç", "Önizleme", "Kolon eşleme", "Sistem önerileri", "Kullanıcı onayı", "Varlık oluştur"] as const;

const importTypeOptions: Array<{ value: CapitalImportType; label: string; detail: string }> = [
  { value: "BANK_STATEMENT", label: "Banka ekstresi", detail: "Nakit/banka bakiyesi ve borç/eksi hareketleri" },
  { value: "FX_STATEMENT", label: "Döviz hesap dökümü", detail: "USD, EUR, GBP gibi döviz varlıkları" },
  { value: "GOLD_STATEMENT", label: "Altın hesap dökümü", detail: "Gram, XAU veya altın bakiyesi" },
  { value: "STOCK_PORTFOLIO", label: "Borsa portföy dökümü", detail: "Hisse ve fon sembolleri" },
  { value: "CRYPTO_PORTFOLIO", label: "Crypto portföy dökümü", detail: "BTC, ETH, USDT gibi dijital varlıklar" },
  { value: "OTHER_FINANCIAL_DOCUMENT", label: "Diğer mali belge", detail: "Serbest mali belge veya portföy listesi" },
  { value: "MANUAL_ENTRY", label: "Manuel giriş", detail: "Dosyasız tek varlık önerisi" }
];

const columnLabels: Record<ColumnKey, string> = {
  name: "Varlık adı",
  symbol: "Sembol",
  quantity: "Miktar",
  unitPrice: "Birim fiyat",
  totalValue: "Toplam değer",
  currency: "Para birimi"
};

export function CapitalImportWizard({ maxUploadMb }: CapitalImportWizardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<CapitalImportType>("BANK_STATEMENT");
  const [valuationCurrency, setValuationCurrency] = useState("TRY");
  const [mapping, setMapping] = useState<Partial<Record<ColumnKey, string>>>({});
  const [manual, setManual] = useState({
    name: "",
    assetType: "BANK" as AssetType,
    symbol: "",
    currency: "",
    quantity: "",
    unitPrice: "",
    totalValue: ""
  });
  const [preview, setPreview] = useState<CapitalImportPreview | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const columnOptions = useMemo(() => preview?.columns ?? [], [preview]);
  const acceptedCount = suggestions.filter((suggestion) => suggestion.decision === "ACCEPTED").length;

  async function runPreview(nextStep = 2) {
    if (importType !== "MANUAL_ENTRY" && !file) {
      setMessage("Lütfen CSV, XLSX veya PDF mali bilgi dosyası seçin.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/capital/import/preview", {
        method: "POST",
        body: buildFormData()
      });
      const payload = (await response.json().catch(() => null)) as { preview?: CapitalImportPreview; message?: string } | null;

      if (!response.ok || !payload?.preview) {
        const nextMessage = payload?.message ?? "Önizleme oluşturulamadı.";
        setMessage(nextMessage);
        showToast(nextMessage);
        return;
      }

      setPreview(payload.preview);
      setMapping((current) => ({ ...payload.preview?.detectedColumns, ...current }));
      setSuggestions(
        payload.preview.suggestions.map((suggestion) => ({
          ...suggestion,
          decision: suggestion.confidenceLevel === "HIGH" ? "ACCEPTED" : "REJECTED"
        }))
      );
      setStep(nextStep);
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview) {
      setMessage("Kaydetmeden önce önizleme oluşturun.");
      return;
    }

    if (acceptedCount === 0) {
      setMessage("AssetAccount oluşturmak için en az bir öneriyi kabul edin.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = buildFormData();
      formData.set("suggestions", JSON.stringify(suggestions));
      const response = await fetch("/api/capital/import/confirm", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as { id?: string; createdAssetCount?: number; message?: string } | null;

      if (!response.ok || !payload?.id) {
        const nextMessage = payload?.message ?? "Mali bilgi importu kaydedilemedi.";
        setMessage(nextMessage);
        showToast(nextMessage);
        return;
      }

      showToast(`${payload.createdAssetCount ?? acceptedCount} varlık sermaye merkezine eklendi.`);
      emitAppDataMutation("capital-import");
      router.push("/capital");
      router.refresh();
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function buildFormData() {
    const formData = new FormData();
    if (file && importType !== "MANUAL_ENTRY") formData.set("file", file);
    formData.set("importType", importType);
    formData.set("valuationCurrency", valuationCurrency.toUpperCase());
    formData.set("mapName", mapping.name ?? "");
    formData.set("mapSymbol", mapping.symbol ?? "");
    formData.set("mapQuantity", mapping.quantity ?? "");
    formData.set("mapUnitPrice", mapping.unitPrice ?? "");
    formData.set("mapTotalValue", mapping.totalValue ?? "");
    formData.set("mapCurrency", mapping.currency ?? "");
    formData.set("manualName", manual.name);
    formData.set("manualAssetType", manual.assetType);
    formData.set("manualSymbol", manual.symbol);
    formData.set("manualCurrency", manual.currency);
    formData.set("manualQuantity", manual.quantity);
    formData.set("manualUnitPrice", manual.unitPrice);
    formData.set("manualTotalValue", manual.totalValue);
    return formData;
  }

  function chooseFile(files: FileList | null) {
    const [nextFile] = Array.from(files ?? []);
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(null);
    setSuggestions([]);
    setMapping({});
    setStep(0);
    setMessage(null);
  }

  function updateSuggestion(index: number, patch: Partial<SuggestionState>) {
    setSuggestions((current) => current.map((suggestion, currentIndex) => (currentIndex === index ? { ...suggestion, ...patch } : suggestion)));
  }

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">V3 Akıllı Sermaye Importu</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Mali Bilgi Yükle</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Banka ekstresi, portföy dökümü veya manuel mali bilgiden sermaye merkezi için öneriler oluşturun. Varlık hesabı yalnızca sizin onayınızla açılır.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Bu ekran yatırım tavsiyesi vermez. Canlı fiyat çekilmez; değerler dosyadaki veya manuel girilen rakamlara göre oluşur.</span>
            </div>
          </div>
        </div>
      </section>

      <ol className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        {steps.map((label, index) => (
          <li
            key={label}
            className={cn(
              "rounded-2xl border px-3 py-2 text-xs font-semibold",
              index === step
                ? "border-slate-950 bg-slate-950 text-white"
                : index < step
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500"
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {message ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      <section className="surface p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="label">Dosya türü</span>
            <select
              className="field"
              value={importType}
              onChange={(event) => {
                setImportType(event.target.value as CapitalImportType);
                setPreview(null);
                setSuggestions([]);
                setStep(1);
              }}
            >
              {importTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-slate-500">{importTypeOptions.find((option) => option.value === importType)?.detail}</span>
          </label>
          <label className="space-y-1">
            <span className="label">Değerleme para birimi</span>
            <input className="field" value={valuationCurrency} onChange={(event) => setValuationCurrency(event.target.value.toUpperCase())} maxLength={3} />
          </label>

          {importType === "MANUAL_ENTRY" ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Manuel girişte dosya yüklenmez. Girilen değerlerden tek varlık önerisi oluşturulur.
            </div>
          ) : (
            <div>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.pdf" className="sr-only" onChange={(event) => chooseFile(event.currentTarget.files)} />
              <button
                type="button"
                className="flex min-h-24 w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/80 p-4 text-left transition hover:bg-slate-50 active:scale-[0.99]"
                onClick={() => inputRef.current?.click()}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  {file ? <FileSpreadsheet className="h-5 w-5" aria-hidden /> : <CloudUpload className="h-5 w-5" aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">{file ? file.name : "CSV, XLSX veya PDF seç"}</span>
                  <span className="mt-1 block text-xs text-slate-500">Varsayılan limit {maxUploadMb} MB. Dosya private storage alanında tutulur.</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {importType === "MANUAL_ENTRY" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 xl:col-span-2">
              <span className="label">Varlık adı</span>
              <input className="field" value={manual.name} onChange={(event) => setManual((current) => ({ ...current, name: event.target.value }))} placeholder="Örn. USD hesabı, gram altın, kredi kartı borcu" />
            </label>
            <label className="space-y-1">
              <span className="label">Tür</span>
              <select className="field" value={manual.assetType} onChange={(event) => setManual((current) => ({ ...current, assetType: event.target.value as AssetType }))}>
                {Object.entries(assetTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Sembol</span>
              <input className="field" value={manual.symbol} onChange={(event) => setManual((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} placeholder="USD, XAU, BTC" />
            </label>
            <label className="space-y-1">
              <span className="label">Miktar</span>
              <input className="field" type="number" step="0.00000001" value={manual.quantity} onChange={(event) => setManual((current) => ({ ...current, quantity: event.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="label">Birim fiyat</span>
              <input className="field" type="number" step="0.01" value={manual.unitPrice} onChange={(event) => setManual((current) => ({ ...current, unitPrice: event.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="label">Toplam değer</span>
              <input className="field" type="number" step="0.01" value={manual.totalValue} onChange={(event) => setManual((current) => ({ ...current, totalValue: event.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="label">Varlık para birimi</span>
              <input className="field" value={manual.currency} onChange={(event) => setManual((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="TRY, USD, EUR" maxLength={3} />
            </label>
          </div>
        ) : null}
      </section>

      {preview ? (
        <>
          <section className="surface p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Önizleme</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {preview.fileName ?? "Manuel giriş"} · {preview.sourceType} · {preview.totalRows} satır · İlk 20 kayıt
                </p>
              </div>
              {preview.warning ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{preview.warning}</span> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    {preview.columns.map((column) => (
                      <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, index) => (
                    <tr key={`${index}-${Object.values(row).join("-")}`} className="border-b border-slate-100">
                      {preview.columns.map((column) => (
                        <td key={column} className="max-w-56 truncate px-3 py-2 text-slate-700">
                          {row[column] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {preview.sourceType !== "MANUAL" ? (
            <section className="surface p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-950">Kolon Eşleme</h2>
                <p className="mt-1 text-xs text-slate-500">Otomatik tespit hatalıysa varlık alanlarını manuel eşleyin ve önerileri yeniden üretin.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
                  <label key={key} className="space-y-1">
                    <span className="label">{columnLabels[key]}</span>
                    <select className="field" value={mapping[key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}>
                      <option value="">Eşleme yok</option>
                      {columnOptions.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button type="button" className="secondary-action mt-4 min-h-10" onClick={() => runPreview(3)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
                Eşlemeyle Tekrar Öneri Üret
              </button>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-3">
            <SummaryCard label="Tespit edilen öneri" value={String(suggestions.length)} />
            <SummaryCard label="Yüksek güven" value={String(preview.highConfidenceSuggestions.length)} tone="green" />
            <SummaryCard label="Düşük güven" value={String(preview.lowConfidenceSuggestions.length)} tone="amber" />
          </section>

          <SuggestionSection
            title="Yüksek Güvenli Öneriler"
            description="Sistem bu önerilerde varlık türü ve tutar sinyalini daha net yakaladı. Yine de son karar sizindir."
            suggestions={suggestions}
            filter="HIGH"
            onUpdate={updateSuggestion}
          />
          <SuggestionSection
            title="Düşük Güvenli Öneriler"
            description="Bu öneriler ayrı tutulur. Kabul etmeden önce tür, tutar ve sembol alanlarını düzenleyin."
            suggestions={suggestions}
            filter="LOW"
            onUpdate={updateSuggestion}
          />
        </>
      ) : null}

      <section className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="secondary-action min-h-12 justify-center" onClick={() => router.push("/capital")}>
          Vazgeç
        </button>
        <button type="button" className="primary-action min-h-12 justify-center" onClick={() => (preview ? setStep(Math.min(step + 1, steps.length - 2)) : runPreview(2))} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {preview ? "Sonraki Adım" : "Sistem Önerisi Oluştur"}
        </button>
        <button type="button" className="primary-action min-h-12 justify-center bg-emerald-700 hover:bg-emerald-800" onClick={confirmImport} disabled={!preview || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
          Kabul Edilenleri Oluştur ({acceptedCount})
        </button>
      </section>
    </div>
  );
}

function SuggestionSection({
  title,
  description,
  suggestions,
  filter,
  onUpdate
}: {
  title: string;
  description: string;
  suggestions: SuggestionState[];
  filter: "HIGH" | "LOW";
  onUpdate: (index: number, patch: Partial<SuggestionState>) => void;
}) {
  const filtered = suggestions.map((suggestion, index) => ({ suggestion, index })).filter(({ suggestion }) => suggestion.confidenceLevel === filter);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <section className="surface p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map(({ suggestion, index }) => (
          <article key={`${suggestion.tempId}-${index}`} className={cn("rounded-3xl border p-4", suggestion.decision === "ACCEPTED" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", suggestion.confidenceLevel === "HIGH" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                    Güven {suggestion.confidenceLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{assetTypeLabels[suggestion.assetType]}</span>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-950">{suggestion.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{suggestion.note}</p>
              </div>
              <div className="text-left sm:text-right">
                <AmountText value={suggestion.totalValue} currency={suggestion.valuationCurrency} size="lg" variant="strong" />
                <p className="mt-1 text-xs text-slate-500">{suggestion.symbol || suggestion.currency || "Sembol yok"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 xl:col-span-2">
                <span className="label">Varlık adı</span>
                <input className="field" value={suggestion.name} onChange={(event) => onUpdate(index, { name: event.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="label">Tür</span>
                <select className="field" value={suggestion.assetType} onChange={(event) => onUpdate(index, { assetType: event.target.value as AssetType })}>
                  {Object.entries(assetTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Sembol</span>
                <input className="field" value={suggestion.symbol ?? ""} onChange={(event) => onUpdate(index, { symbol: event.target.value.toUpperCase() })} />
              </label>
              <label className="space-y-1">
                <span className="label">Miktar</span>
                <input className="field" type="number" step="0.00000001" value={suggestion.quantity ?? ""} onChange={(event) => onUpdate(index, { quantity: event.target.value === "" ? null : Number(event.target.value) })} />
              </label>
              <label className="space-y-1">
                <span className="label">Birim fiyat</span>
                <input className="field" type="number" step="0.01" value={suggestion.unitPrice ?? ""} onChange={(event) => onUpdate(index, { unitPrice: event.target.value === "" ? null : Number(event.target.value) })} />
              </label>
              <label className="space-y-1">
                <span className="label">Toplam değer</span>
                <input className="field" type="number" step="0.01" value={suggestion.totalValue} onChange={(event) => onUpdate(index, { totalValue: Number(event.target.value) })} />
              </label>
              <label className="space-y-1">
                <span className="label">Değerleme para birimi</span>
                <input className="field" value={suggestion.valuationCurrency} onChange={(event) => onUpdate(index, { valuationCurrency: event.target.value.toUpperCase() })} maxLength={3} />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={cn("secondary-action min-h-10 justify-center", suggestion.decision === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-700")}
                onClick={() => onUpdate(index, { decision: "REJECTED" })}
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Reddet
              </button>
              <button
                type="button"
                className={cn("primary-action min-h-10 justify-center", suggestion.decision === "ACCEPTED" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-950")}
                onClick={() => onUpdate(index, { decision: "ACCEPTED" })}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Kabul et
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "amber" }) {
  return (
    <article className="surface p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={cn("mt-2 break-words text-lg font-semibold tabular-nums", tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-950")}>{value}</p>
    </article>
  );
}
