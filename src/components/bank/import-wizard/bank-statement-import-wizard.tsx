"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { cn } from "@/lib/utils";

type SelectOption = {
  label: string;
  value: string;
};

type ColumnKey = "date" | "description" | "debit" | "credit" | "balance" | "currency";

type WizardPreview = {
  sourceType: "CSV" | "XLSX" | "PDF";
  sourceConfidence: "HIGH" | "LOW";
  fileName: string;
  fileSize: number;
  fileHash: string;
  columns: string[];
  previewRows: Record<string, string>[];
  detectedColumns: Partial<Record<ColumnKey, string>>;
  mapping: Partial<Record<ColumnKey, string>>;
  mappingSource: "DETECTED" | "SAVED" | "MANUAL";
  mappingPreferenceId?: string;
  mappingSuggestionMessage?: string;
  parseSummary: {
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    duplicateRows: number;
    startDate: string | null;
    endDate: string | null;
    openingBalance: string | null;
    closingBalance: string | null;
  };
  analysis: {
    incomeRows: number;
    expenseRows: number;
    neutralRows: number;
    suggestedRows: Array<{
      rowNumber: number;
      date: string;
      description: string;
      amount: string;
      direction: "IN" | "OUT" | "NEUTRAL";
      categorySuggestion: string;
      clientSuggestion: string;
      caseFileSuggestion: string;
      matchSuggestion: string;
      status: "SUCCESS" | "ERROR" | "DUPLICATE";
      errorMessage: string | null;
    }>;
  };
  duplicateImport?: {
    id: string;
    bankName: string;
    createdAt: string;
  };
  warning?: string;
};

type BankStatementImportWizardProps = {
  cashAccounts: SelectOption[];
  defaultCurrency: string;
  maxUploadMb: number;
};

type DraftState = {
  bankName: string;
  cashAccountId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dateFormat: string;
  decimalSeparator: string;
  thousandSeparator: string;
  mapping: Partial<Record<ColumnKey, string>>;
  fileName: string | null;
};

const draftStorageKey = "buro-finans-bank-import-draft-v1";

const steps = [
  { id: "file", label: "Dosya" },
  { id: "account", label: "Banka / Kasa" },
  { id: "preview", label: "Önizleme" },
  { id: "mapping", label: "Kolon Eşleme" },
  { id: "summary", label: "Parse Özeti" },
  { id: "save", label: "Kaydet" }
] as const;

const columnLabels: Record<ColumnKey, string> = {
  date: "Tarih",
  description: "Açıklama",
  debit: "Borç / Çıkış",
  credit: "Alacak / Giriş",
  balance: "Bakiye",
  currency: "Para Birimi"
};

export function BankStatementImportWizard({ cashAccounts, defaultCurrency, maxUploadMb }: BankStatementImportWizardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState("");
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.value ?? "");
  const [currency, setCurrency] = useState(defaultCurrency || "TRY");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dateFormat, setDateFormat] = useState("auto");
  const [decimalSeparator, setDecimalSeparator] = useState(",");
  const [thousandSeparator, setThousandSeparator] = useState(".");
  const [mapping, setMapping] = useState<Partial<Record<ColumnKey, string>>>({});
  const [preview, setPreview] = useState<WizardPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const columnOptions = useMemo(() => preview?.columns ?? [], [preview]);
  const canSave = Boolean(preview && !preview.duplicateImport && preview.parseSummary.totalRows > 0);

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(draftStorageKey);
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as DraftState;
      setBankName(draft.bankName ?? "");
      setCashAccountId(draft.cashAccountId ?? cashAccounts[0]?.value ?? "");
      setCurrency(draft.currency ?? defaultCurrency ?? "TRY");
      setPeriodStart(draft.periodStart ?? "");
      setPeriodEnd(draft.periodEnd ?? "");
      setDateFormat(draft.dateFormat ?? "auto");
      setDecimalSeparator(draft.decimalSeparator === "." ? "." : ",");
      setThousandSeparator([".", ",", "space", "none"].includes(draft.thousandSeparator) ? draft.thousandSeparator : ".");
      setMapping(draft.mapping ?? {});
      setDraftRestored(Boolean(draft.fileName || draft.bankName));
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [cashAccounts, defaultCurrency]);

  useEffect(() => {
    const draft: DraftState = {
      bankName,
      cashAccountId,
      currency,
      periodStart,
      periodEnd,
      dateFormat,
      decimalSeparator,
      thousandSeparator,
      mapping,
      fileName: file?.name ?? null
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [bankName, cashAccountId, currency, dateFormat, decimalSeparator, file, mapping, periodEnd, periodStart, thousandSeparator]);

  async function runPreview(nextStep = 2) {
    if (!file) {
      setMessage("Lütfen CSV, XLSX veya PDF ekstre dosyası seçin.");
      return;
    }

    if (!bankName.trim()) {
      setMessage("Banka adı gerekli.");
      setStep(1);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/bank-statements/preview", {
        method: "POST",
        body: buildFormData()
      });
      const payload = (await response.json().catch(() => null)) as { preview?: WizardPreview; message?: string } | null;

      if (!response.ok || !payload?.preview) {
        const nextMessage = payload?.message ?? "Önizleme oluşturulamadı.";
        setMessage(nextMessage);
        showToast(nextMessage);
        return;
      }

      setPreview(payload.preview);
      setMapping((current) => ({ ...payload.preview?.mapping, ...current }));
      setStep(nextStep);
      if (payload.preview.duplicateImport) {
        showToast("Bu dosya daha önce içe aktarılmış olabilir. Kaydetmeden önce kontrol edin.");
      }
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function saveImport() {
    if (!file || !preview) {
      setMessage("Kaydetmeden önce önizleme oluşturun.");
      return;
    }

    if (preview.duplicateImport) {
      setMessage("Duplicate görünen ekstre kaydedilemez. Mevcut importu kontrol edin veya farklı dosya yükleyin.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/bank-statements/import", {
        method: "POST",
        body: buildFormData()
      });
      const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!response.ok || !payload?.id) {
        const nextMessage = payload?.message ?? "Ekstre kaydedilemedi.";
        setMessage(nextMessage);
        showToast(nextMessage);
        return;
      }

      clearDraft();
      showToast("Banka ekstresi staging tablosuna kaydedildi.");
      emitAppDataMutation("bank-statement-import");
      router.push(`/bank-statements/${payload.id}`);
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function buildFormData() {
    const formData = new FormData();
    if (file) formData.set("file", file);
    formData.set("bankName", bankName);
    formData.set("cashAccountId", cashAccountId);
    formData.set("currency", currency);
    formData.set("periodStart", periodStart);
    formData.set("periodEnd", periodEnd);
    formData.set("dateFormat", dateFormat);
    formData.set("decimalSeparator", decimalSeparator);
    formData.set("thousandSeparator", thousandSeparator);
    formData.set("mapDate", mapping.date ?? "");
    formData.set("mapDescription", mapping.description ?? "");
    formData.set("mapDebit", mapping.debit ?? "");
    formData.set("mapCredit", mapping.credit ?? "");
    formData.set("mapBalance", mapping.balance ?? "");
    formData.set("mapCurrency", mapping.currency ?? "");
    return formData;
  }

  function chooseFile(files: FileList | null) {
    const [nextFile] = Array.from(files ?? []);
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(null);
    setMapping({});
    setStep(1);
    setMessage(null);
  }

  function clearDraft() {
    window.localStorage.removeItem(draftStorageKey);
    setDraftRestored(false);
  }

  function cancelWizard() {
    clearDraft();
    router.push("/bank-statements");
  }

  function goNext() {
    if (step === 0) {
      if (!file) {
        setMessage("Lütfen önce ekstre dosyası seçin.");
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      void runPreview(2);
      return;
    }

    if (step === 3) {
      void runPreview(4);
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">V3 Staging Import</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Banka Ekstresi Yükleme Sihirbazı</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              CSV ve Excel dosyaları birinci sınıf desteklenir. PDF ekstreleri düşük güvenli fallback olarak ayrıştırılır. Bu işlem finans kaydı oluşturmaz; önce
              BankStatementImport ve BankStatementRow staging tablolarına yazar.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>PDF banka ekstreleri bankadan bankaya değişebilir. En doğru sonuç için mümkünse CSV veya Excel formatı kullanınız.</span>
            </div>
          </div>
        </div>
      </section>

      <ol className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "rounded-2xl border px-3 py-2 text-xs font-semibold",
              index === step
                ? "border-slate-950 bg-slate-950 text-white"
                : index < step
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500"
            )}
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      {draftRestored ? (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          Önceki import taslağı geri yüklendi. Güvenlik nedeniyle dosyayı yeniden seçmeniz gerekir.
        </section>
      ) : null}

      {message ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      {step === 0 ? (
        <section className="surface p-4">
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.pdf" className="sr-only" onChange={(event) => chooseFile(event.currentTarget.files)} />
          <button
            type="button"
            className="flex min-h-44 w-full items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/80 p-5 text-left transition hover:bg-slate-50 active:scale-[0.99]"
            onClick={() => inputRef.current?.click()}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              {file ? <FileSpreadsheet className="h-6 w-6" aria-hidden /> : <CloudUpload className="h-6 w-6" aria-hidden />}
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-950">{file ? file.name : "CSV, XLSX veya PDF ekstre seç"}</span>
              <span className="mt-1 block text-sm text-slate-500">Varsayılan limit {maxUploadMb} MB. Dosya private storage alanına yalnızca kaydet adımında yazılır.</span>
            </span>
          </button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="surface p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 xl:col-span-2">
              <span className="label">Banka Adı</span>
              <input className="field" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Örn. İş Bankası" />
            </label>
            <label className="space-y-1">
              <span className="label">İlgili Kasa/Banka Hesabı</span>
              <select className="field" value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)}>
                <option value="">Hesap seçilmedi</option>
                {cashAccounts.map((account) => (
                  <option key={account.value} value={account.value}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Para Birimi</span>
              <input className="field" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
            </label>
            <label className="space-y-1">
              <span className="label">Tarih Başlangıç</span>
              <input className="field" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Tarih Bitiş</span>
              <input className="field" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>
          </div>
        </section>
      ) : null}

      {step === 2 && preview ? <PreviewStep preview={preview} /> : null}

      {step === 3 && preview ? (
        <MappingStep
          columnOptions={columnOptions}
          dateFormat={dateFormat}
          decimalSeparator={decimalSeparator}
          mapping={mapping}
          setDateFormat={setDateFormat}
          setDecimalSeparator={setDecimalSeparator}
          setMapping={setMapping}
          setThousandSeparator={setThousandSeparator}
          thousandSeparator={thousandSeparator}
        />
      ) : null}

      {step === 4 && preview ? <SummaryStep preview={preview} /> : null}

      {step === 5 && preview ? (
        <section className="surface p-4">
          <h2 className="text-sm font-semibold text-slate-950">Staging Kaydı Oluştur</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Bu adım yalnızca banka ekstresi import kaydını ve banka satırlarını oluşturur. Tahsilat, gider veya kasa hareketi kullanıcı onayı olmadan oluşmaz.
          </p>
          {preview.duplicateImport ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Bu dosya daha önce {preview.duplicateImport.bankName} adıyla içe aktarılmış olabilir. Duplicate import kaydedilemez.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Kontrol tamam. Ekstre staging tablolarına kaydedilmeye hazır.
            </div>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button type="button" className="secondary-action min-h-12 justify-center text-rose-700" onClick={cancelWizard}>
          <X className="h-4 w-4" aria-hidden />
          Vazgeç
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="secondary-action min-h-12 justify-center" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || loading}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Geri
          </button>
          {step === 5 ? (
            <button type="button" className="primary-action min-h-12 justify-center bg-emerald-700 hover:bg-emerald-800" onClick={saveImport} disabled={!canSave || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              Kaydet
            </button>
          ) : (
            <button type="button" className="primary-action min-h-12 justify-center" onClick={goNext} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : step === 3 ? <RefreshCcw className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
              {step === 1 ? "Önizleme Oluştur" : step === 3 ? "Eşlemeyle Parse Et" : "Sonraki Adım"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewStep({ preview }: { preview: WizardPreview }) {
  return (
    <section className="surface p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Önizleme ve Tespit</h2>
          <p className="mt-1 text-xs text-slate-500">
            {preview.fileName} · {preview.sourceType} · Güven: {preview.sourceConfidence === "HIGH" ? "Yüksek" : "Düşük"} · İlk 20 satır
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {preview.warning ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{preview.warning}</span> : null}
          {preview.mappingSuggestionMessage ? (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">{preview.mappingSuggestionMessage}</span>
          ) : null}
          {preview.duplicateImport ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800">Duplicate import olabilir</span> : null}
        </div>
      </div>
      <PreviewTable preview={preview} />
    </section>
  );
}

function MappingStep({
  columnOptions,
  dateFormat,
  decimalSeparator,
  mapping,
  setDateFormat,
  setDecimalSeparator,
  setMapping,
  setThousandSeparator,
  thousandSeparator
}: {
  columnOptions: string[];
  dateFormat: string;
  decimalSeparator: string;
  mapping: Partial<Record<ColumnKey, string>>;
  setDateFormat: (value: string) => void;
  setDecimalSeparator: (value: string) => void;
  setMapping: React.Dispatch<React.SetStateAction<Partial<Record<ColumnKey, string>>>>;
  setThousandSeparator: (value: string) => void;
  thousandSeparator: string;
}) {
  return (
    <section className="surface p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">Kolon Eşleme</h2>
        <p className="mt-1 text-xs text-slate-500">Otomatik tespit hatalıysa alanları manuel eşleyin. Sonraki adımda parse özeti yeniden hesaplanır.</p>
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
        <label className="space-y-1">
          <span className="label">Tarih Formatı</span>
          <select className="field" value={dateFormat} onChange={(event) => setDateFormat(event.target.value)}>
            <option value="auto">Otomatik</option>
            <option value="DD.MM.YYYY">GG.AA.YYYY</option>
            <option value="YYYY-MM-DD">YYYY-AA-GG</option>
            <option value="MM/DD/YYYY">AA/GG/YYYY</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">Decimal Ayırıcı</span>
          <select className="field" value={decimalSeparator} onChange={(event) => setDecimalSeparator(event.target.value)}>
            <option value=",">Virgül</option>
            <option value=".">Nokta</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">Binlik Ayırıcı</span>
          <select className="field" value={thousandSeparator} onChange={(event) => setThousandSeparator(event.target.value)}>
            <option value=".">Nokta</option>
            <option value=",">Virgül</option>
            <option value="space">Boşluk</option>
            <option value="none">Yok</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function SummaryStep({ preview }: { preview: WizardPreview }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Toplam Satır" value={String(preview.parseSummary.totalRows)} />
        <SummaryCard label="Başarılı" value={String(preview.parseSummary.successfulRows)} tone="green" />
        <SummaryCard label="Hatalı" value={String(preview.parseSummary.failedRows)} tone="rose" />
        <SummaryCard label="Duplicate" value={String(preview.parseSummary.duplicateRows)} tone="amber" />
        <SummaryCard label="Tarih Aralığı" value={`${preview.parseSummary.startDate ?? "-"} / ${preview.parseSummary.endDate ?? "-"}`} />
        <SummaryCard label="Açılış Bakiyesi" value={preview.parseSummary.openingBalance ?? "-"} />
        <SummaryCard label="Kapanış Bakiyesi" value={preview.parseSummary.closingBalance ?? "-"} />
        <SummaryCard label="Gelir/Gider" value={`${preview.analysis.incomeRows} / ${preview.analysis.expenseRows}`} />
      </section>
      <AnalysisTable preview={preview} />
    </div>
  );
}

function PreviewTable({ preview }: { preview: WizardPreview }) {
  return (
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
  );
}

function AnalysisTable({ preview }: { preview: WizardPreview }) {
  return (
    <section className="surface p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">Analiz ve Öneriler</h2>
        <p className="mt-1 text-xs text-slate-500">İlk 20 satır için kategori, müvekkil/dosya ve kasa hareketi eşleşme önerileri.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              {["#", "Tarih", "Açıklama", "Yön", "Tutar", "Kategori", "Müvekkil", "Dosya", "Eşleşme", "Durum"].map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.analysis.suggestedRows.map((row) => (
              <tr key={row.rowNumber} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.rowNumber}</td>
                <td className="px-3 py-2">{row.date}</td>
                <td className="max-w-80 truncate px-3 py-2">{row.description}</td>
                <td className={cn("px-3 py-2 font-semibold", row.direction === "IN" ? "text-emerald-700" : row.direction === "OUT" ? "text-rose-700" : "text-slate-500")}>
                  {row.direction === "IN" ? "+ Giriş" : row.direction === "OUT" ? "- Çıkış" : "Nötr"}
                </td>
                <td className="px-3 py-2 font-medium">{row.amount}</td>
                <td className="px-3 py-2">{row.categorySuggestion}</td>
                <td className="px-3 py-2">{row.clientSuggestion}</td>
                <td className="px-3 py-2">{row.caseFileSuggestion}</td>
                <td className="px-3 py-2">{row.matchSuggestion}</td>
                <td className="px-3 py-2">{row.status === "SUCCESS" ? "Başarılı" : row.status === "DUPLICATE" ? "Duplicate" : row.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "rose" | "amber" }) {
  return (
    <article className="surface p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 break-words text-lg font-semibold tabular-nums",
          tone === "green" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-slate-950"
        )}
      >
        {value}
      </p>
    </article>
  );
}
