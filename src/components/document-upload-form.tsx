"use client";

import { CloudUpload, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { documentTypeOptions } from "@/lib/document-labels";
import { cn } from "@/lib/utils";

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

      <section className="surface p-4">
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
      </section>

      <section className="surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="label">Belge Başlığı</span>
            <input className="field" name="title" placeholder="Örn. Temmuz banka dekontu" />
          </label>
          <label className="space-y-1">
            <span className="label">Dosya Türü</span>
            <select className="field" name="documentType" defaultValue="BANK_RECEIPT">
              {documentTypeOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Belge Tarihi</span>
            <input className="field" type="date" name="documentDate" />
          </label>
          <label className="space-y-1">
            <span className="label">Tutar</span>
            <input className="field" type="number" name="amount" min="0" step="0.01" placeholder="0,00" />
          </label>
          <label className="space-y-1">
            <span className="label">Para Birimi</span>
            <input className="field" name="currency" defaultValue="TRY" />
          </label>
          <label className="space-y-1">
            <span className="label">Etiketler</span>
            <input className="field" name="tags" placeholder="dekont, temmuz, banka" />
          </label>
          <label className="space-y-1 md:col-span-2 xl:col-span-3">
            <span className="label">Açıklama</span>
            <textarea className="field min-h-24 resize-none" name="description" placeholder="Belgeyle ilgili kısa not" />
          </label>
        </div>
      </section>

      <section className="surface p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Opsiyonel Bağlantılar</h2>
          <p className="mt-1 text-sm text-slate-500">Belgeyi ilgili müvekkil, dosya veya finans kaydına bağlayabilirsiniz.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DocumentSelect name="linkedClientId" label="Müvekkil" options={clients} emptyLabel="Müvekkil yok" defaultValue={defaults?.linkedClientId} />
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
      </section>

      {message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
          {message}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 lg:static">
        <button
          type="submit"
          disabled={loading}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-slate-950 px-6 text-base font-semibold text-white shadow-[0_20px_48px_rgba(15,23,42,0.24)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CloudUpload className="h-5 w-5" aria-hidden />}
          {loading ? "Yükleniyor" : "Belgeyi Güvenli Yükle"}
        </button>
      </div>
    </form>
  );
}

function DocumentSelect({
  name,
  label,
  options,
  emptyLabel,
  defaultValue = ""
}: {
  name: string;
  label: string;
  options: SelectOption[];
  emptyLabel: string;
  defaultValue?: string;
}) {
  const selectOptions =
    defaultValue && !options.some((option) => option.value === defaultValue)
      ? [{ label: "Seçili kayıt", value: defaultValue }, ...options]
      : options;

  return (
    <label className="space-y-1">
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={defaultValue}>
        <option value="">{emptyLabel}</option>
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
