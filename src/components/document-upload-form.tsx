"use client";

import { CloudUpload, FileCheck2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { documentTypeOptions } from "@/lib/document-labels";
import { cn } from "@/lib/utils";
import { CurrencyInput, DateInput, FormField, FormSection, Label, Select, SubmitBar, Textarea } from "@/components/premium-form";

type SelectOption = {
  label: string;
  value: string;
};

type DocumentUploadFormProps = {
  clients: SelectOption[];
  caseFiles: SelectOption[];
  incomes: SelectOption[];
  expenses: SelectOption[];
  invoiceOrReceipts: SelectOption[];
  cashLedgerEntries: SelectOption[];
  maxUploadMb: number;
  defaults?: Partial<DocumentUploadDefaults>;
};

type DocumentUploadDefaults = {
  linkedClientId: string;
  linkedCaseFileId: string;
  linkedIncomeId: string;
  linkedExpenseId: string;
  linkedInvoiceOrReceiptId: string;
  linkedCashLedgerEntryId: string;
};

const acceptedFileTypes = ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls";

export function DocumentUploadForm({
  clients,
  caseFiles,
  incomes,
  expenses,
  invoiceOrReceipts,
  cashLedgerEntries,
  maxUploadMb,
  defaults
}: DocumentUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [documentDescription, setDocumentDescription] = useState("");
  const [linkedClientId, setLinkedClientId] = useState(defaults?.linkedClientId ?? "");
  const clientSuggestion = useMemo(
    () => suggestDocumentClient(`${selectedFile?.name ?? ""} ${documentDescription}`, clients, linkedClientId),
    [clients, documentDescription, linkedClientId, selectedFile?.name]
  );

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!selectedFile) {
      setMessage("Lütfen yüklemek için bir dosya seçin.");
      return;
    }

    formData.set("file", selectedFile);
    if (!String(formData.get("title") ?? "").trim()) {
      formData.set("title", selectedFile.name.replace(/\.[^.]+$/, "").trim() || "Yüklenen belge");
    }
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string;
        duplicateDocumentId?: string;
      } | null;

      if (!response.ok) {
        const nextMessage = payload?.message || "Belge yüklenemedi. Dosya ve bilgileri kontrol edin.";
        setMessage(nextMessage);
        showToast(nextMessage);
        return;
      }

      showToast("Belge yüklendi.");
      emitAppDataMutation("document-upload");
      router.push(`/documents/${payload?.id}`);
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function selectFiles(files: FileList | null) {
    const [file] = Array.from(files ?? []);
    if (file) {
      setSelectedFile(file);
      setMessage(null);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFiles(event.dataTransfer.files);
  }

  return (
    <form onSubmit={submitUpload} className="space-y-4">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Güvenli belge yükleme</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Belge Yükle</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Dekont, makbuz, fiş, fatura, PDF, görsel ve banka ekstresi dosyalarını private storage alanına yükleyin.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Yüklenen belgeler kişisel veri, müvekkil bilgisi ve finansal bilgi içerebilir. Güvenli şekilde saklayınız.</span>
            </div>
          </div>
        </div>
      </section>

      <FormSection>
        <label
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition",
            dragActive ? "border-slate-950 bg-slate-100" : "border-slate-300 bg-white/70 hover:bg-slate-50"
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept={acceptedFileTypes}
            className="sr-only"
            onChange={(event) => selectFiles(event.currentTarget.files)}
          />
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.20)]">
            {selectedFile ? <FileCheck2 className="h-6 w-6" aria-hidden /> : <CloudUpload className="h-6 w-6" aria-hidden />}
          </span>
          <span className="mt-4 text-base font-semibold text-slate-950">
            {selectedFile ? selectedFile.name : "Dosya seçin veya buraya sürükleyin"}
          </span>
          <span className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            PDF, PNG, JPG, JPEG, CSV, XLSX desteklenir. Varsayılan limit {maxUploadMb} MB.
          </span>
          <button
            type="button"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition active:scale-95"
            onClick={() => inputRef.current?.click()}
          >
            Telefondan / Bilgisayardan Seç
          </button>
        </label>
      </FormSection>

      <FormSection>
        <div className="grid gap-3">
          <input type="hidden" name="title" value="" />
          <FormField>
            <Label htmlFor="document-type" required>
              Belge Türü
            </Label>
            <Select id="document-type" name="documentType" defaultValue="BANK_RECEIPT" options={documentTypeOptions()} />
          </FormField>
        </div>
      </FormSection>

      {clientSuggestion ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="min-w-0">
            <p className="font-semibold">Akıllı öneri: {clientSuggestion.label}</p>
            <p className="mt-0.5 text-xs text-blue-700">Belge adı veya açıklamasındaki müvekkil ifadesine göre önerildi. Yükleme, yalnız sizin onayınızla yapılır.</p>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
            onClick={() => setLinkedClientId(clientSuggestion.value)}
          >
            Müvekkili Uygula
          </button>
        </div>
      ) : null}

      <details className="rounded-3xl border border-slate-200 bg-white/80 open:bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15">
          <span>Gelişmiş Seçenekler</span><span className="text-xs font-medium text-slate-500">Metadata ve bağlantılar</span>
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField><Label htmlFor="document-date">Belge Tarihi</Label><DateInput id="document-date" name="documentDate" /></FormField>
            <FormField><Label htmlFor="document-amount">Tutar</Label><CurrencyInput id="document-amount" name="amount" currency="TRY" /></FormField>
            <FormField><Label htmlFor="document-currency">Para Birimi</Label><input id="document-currency" className="field" name="currency" defaultValue="TRY" /></FormField>
            <FormField><Label htmlFor="document-tags">Etiketler</Label><input id="document-tags" className="field" name="tags" placeholder="dekont, temmuz, banka" /></FormField>
            <FormField className="md:col-span-2 xl:col-span-3"><Label htmlFor="document-description">Açıklama</Label><Textarea id="document-description" name="description" placeholder="Belgeyle ilgili kısa not" value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} /></FormField>
          </div>
          <p className="text-sm font-semibold text-slate-800">Opsiyonel bağlantılar</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DocumentSelect name="linkedClientId" label="Müvekkil" options={clients} emptyLabel="Müvekkil yok" value={linkedClientId} onChange={setLinkedClientId} />
            <DocumentSelect name="linkedCaseFileId" label="Dosya" options={caseFiles} emptyLabel="Dosya yok" defaultValue={defaults?.linkedCaseFileId} />
            <DocumentSelect name="linkedIncomeId" label="Tahsilat" options={incomes} emptyLabel="Tahsilat yok" defaultValue={defaults?.linkedIncomeId} />
            <DocumentSelect name="linkedExpenseId" label="Gider" options={expenses} emptyLabel="Gider yok" defaultValue={defaults?.linkedExpenseId} />
            <DocumentSelect
              name="linkedInvoiceOrReceiptId"
              label="Makbuz/Fatura"
              options={invoiceOrReceipts}
              emptyLabel="Belge yok"
              defaultValue={defaults?.linkedInvoiceOrReceiptId}
            />
            <DocumentSelect
              name="linkedCashLedgerEntryId"
              label="Kasa Hareketi"
              options={cashLedgerEntries}
              emptyLabel="Kasa hareketi yok"
              defaultValue={defaults?.linkedCashLedgerEntryId}
            />
          </div>
        </div>
      </details>

      <SubmitBar submitting={loading} submitLabel="Belgeyi Güvenli Yükle" submittingLabel="Yükleniyor" error={message} />
    </form>
  );
}

function DocumentSelect({
  name,
  label,
  options,
  emptyLabel,
  defaultValue = "",
  value,
  onChange
}: {
  name: string;
  label: string;
  options: SelectOption[];
  emptyLabel: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const selectedValue = value ?? defaultValue;
  const selectOptions =
    selectedValue && !options.some((option) => option.value === selectedValue)
      ? [{ label: "Seçili kayıt", value: selectedValue }, ...options]
      : options;

  return (
    <FormField>
      <Label htmlFor={name}>{label}</Label>
      <Select
        id={name}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        options={[{ label: emptyLabel, value: "" }, ...selectOptions]}
      />
    </FormField>
  );
}

const ignoredClientTokens = new Set(["test", "musteri", "muvekkil", "sirket", "sirketi", "anonim", "limited", "ltd"]);

function suggestDocumentClient(text: string, clients: SelectOption[], selectedClientId: string) {
  const normalizedText = normalizeDocumentSuggestion(text);
  if (!normalizedText) return null;

  return clients.find((client) => {
    if (!client.value || client.value === selectedClientId) return false;
    const normalizedLabel = normalizeDocumentSuggestion(client.label);
    if (normalizedLabel.length >= 4 && normalizedText.includes(normalizedLabel)) return true;
    return normalizedLabel
      .split(" ")
      .filter((token) => token.length >= 4 && !ignoredClientTokens.has(token))
      .some((token) => normalizedText.includes(token));
  }) ?? null;
}

function normalizeDocumentSuggestion(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
