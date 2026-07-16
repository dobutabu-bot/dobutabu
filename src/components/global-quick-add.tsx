"use client";

import { BellRing, FileText, HandCoins, PiggyBank, Plus, ReceiptText, UploadCloud, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Drawer } from "@/components/drawer";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { documentTypeOptions } from "@/lib/document-labels";
import { expenseCategoryLabels, incomeCategoryLabels, paymentMethodLabels, reminderPriorityLabels, reminderTypeLabels, toOptions } from "@/lib/labels";
import type { SchemaKey } from "@/lib/validations";
import { cn } from "@/lib/utils";

type QuickOptions = {
  clients: { id: string; name: string }[];
  caseFiles: { id: string; clientId: string; title: string; fileNumber: string | null; client: { name: string } }[];
  cashAccounts: { id: string; name: string; isDefault: boolean }[];
  lastPaymentMethods?: { collection: string; expense: string };
};

type QuickKind = "collection" | "expense" | "client" | "case" | "reminder" | "document" | "advance";

const actions = [
  { kind: "collection", label: "Tahsilat", icon: HandCoins, tone: "bg-emerald-700" },
  { kind: "expense", label: "Gider", icon: ReceiptText, tone: "bg-rose-700" },
  { kind: "client", label: "Müvekkil", icon: UserCircle, tone: "bg-slate-950" },
  { kind: "case", label: "Dosya", icon: FileText, tone: "bg-blue-700" },
  { kind: "reminder", label: "Hatırlatma", icon: BellRing, tone: "bg-amber-600" },
  { kind: "document", label: "Belge", icon: UploadCloud, tone: "bg-blue-700" },
  { kind: "advance", label: "Avans", icon: PiggyBank, tone: "bg-slate-700" }
] satisfies { kind: QuickKind; label: string; icon: typeof Plus; tone: string }[];

export function GlobalQuickAdd({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<QuickKind | null>(null);
  const [options, setOptions] = useState<QuickOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    if (!open || options) return;
    let active = true;
    fetch("/api/quick-add/options")
      .then(async (response) => {
        if (!response.ok) throw new Error("Seçenekler alınamadı");
        return response.json() as Promise<QuickOptions>;
      })
      .then((payload) => active && setOptions(payload))
      .catch(() => active && setLoadError("Hızlı işlem seçenekleri yüklenemedi."));
    return () => { active = false; };
  }, [open, options]);

  function close() {
    setKind(null);
    onOpenChange(false);
  }

  function choose(next: QuickKind) {
    setToday(localDateInputValue());
    setKind(next);
  }

  function finishDocumentUpload() {
    router.refresh();
    close();
  }

  const config = kind && kind !== "document" && options ? createConfig(kind, options, today) : null;

  return (
    <>
      <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 lg:bottom-6 lg:right-7">
        <button type="button" className="flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(15,23,42,0.30)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 active:translate-y-0 active:scale-95" aria-label="Yeni kayıt ekle" aria-expanded={open} data-testid="global-new-button" onClick={() => onOpenChange(true)}>
          <Plus className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Yeni</span>
        </button>
      </div>
      <Drawer open={open} title={kind ? `${actions.find((item) => item.kind === kind)?.label} Ekle` : "Yeni Kayıt"} description="Az bilgiyle başlayın; gelişmiş alanları yalnız gerektiğinde açın." onOpenChange={(next) => next ? onOpenChange(true) : close()}>
        {!kind ? (
          <div className="grid grid-cols-2 gap-3" data-testid="quick-add-menu">
            {actions.map((action) => { const Icon = action.icon; return <button key={action.kind} type="button" className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20" onClick={() => choose(action.kind)}><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", action.tone)}><Icon className="h-5 w-5" aria-hidden /></span>{action.label}</button>; })}
          </div>
        ) : kind === "document" ? <QuickDocumentUpload onSuccess={finishDocumentUpload} onCancel={() => setKind(null)} /> : loadError ? <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{loadError}</p> : !config ? <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-label="Form yükleniyor" /> : (
          <EntityForm title={`${config.title} Ekle`} endpoint={config.endpoint} schemaKey={config.schemaKey} fields={config.fields} defaults={config.defaults} submitLabel="Kaydet" successMessage={`${config.title} oluşturuldu.`} onSuccess={close} onCancel={() => setKind(null)} />
        )}
      </Drawer>
    </>
  );
}

function createConfig(kind: Exclude<QuickKind, "document">, data: QuickOptions, today: string): { title: string; endpoint: string; schemaKey: SchemaKey; fields: EntityFormField[]; defaults: Record<string, string> } | null {
  const clients = [{ label: "Seçiniz", value: "" }, ...data.clients.map((item) => ({ label: item.name, value: item.id }))];
  const cases = [{ label: "Dosya yok", value: "" }, ...data.caseFiles.map((item) => ({ label: `${item.client.name} · ${item.title}`, value: item.id, parentValue: item.clientId, searchTerms: [item.fileNumber ?? "", item.title] }))];
  const cash = [{ label: "Varsayılan kasa", value: "" }, ...data.cashAccounts.map((item) => ({ label: `${item.name}${item.isDefault ? " (Varsayılan)" : ""}`, value: item.id }))];
  const advanced = "advanced" as const;
  if (kind === "collection") return { title: "Tahsilat", endpoint: "/api/collections", schemaKey: "collection", defaults: { clientId: "", caseFileId: "", cashAccountId: data.cashAccounts.find((item) => item.isDefault)?.id ?? "", amount: "", currency: "TRY", date: today, paymentMethod: data.lastPaymentMethods?.collection || "BANK_TRANSFER", category: "LEGAL_FEE", description: "", receiptIssued: "false", receiptNumber: "" }, fields: [
    { name: "clientId", label: "Müvekkil", type: "select", options: clients }, { name: "amount", label: "Tutar", type: "currency", min: "0", step: "0.01" }, { name: "date", label: "Tarih", type: "date" }, { name: "description", label: "Açıklama", type: "textarea" },
    { name: "caseFileId", label: "Dosya", type: "select", options: cases, section: advanced }, { name: "cashAccountId", label: "Kasa", type: "select", options: cash, section: advanced }, { name: "paymentMethod", label: "Ödeme yöntemi", type: "select", options: toOptions(paymentMethodLabels), section: advanced }, { name: "category", label: "Kategori", type: "select", options: toOptions(incomeCategoryLabels), section: advanced }, { name: "currency", label: "Para birimi", section: advanced }, { name: "receiptIssued", label: "Makbuz kesildi mi?", type: "select", options: [{ label: "Hayır", value: "false" }, { label: "Evet", value: "true" }], section: advanced }, { name: "receiptNumber", label: "Makbuz no", section: advanced }
  ] };
  if (kind === "expense") return { title: "Gider", endpoint: "/api/expenses", schemaKey: "expense", defaults: { clientId: "", caseFileId: "", cashAccountId: data.cashAccounts.find((item) => item.isDefault)?.id ?? "", amount: "", currency: "TRY", date: today, paymentMethod: data.lastPaymentMethods?.expense || "BANK_TRANSFER", category: "OFFICE", isClientExpense: "false", description: "" }, fields: [
    { name: "amount", label: "Tutar", type: "currency", min: "0", step: "0.01" }, { name: "category", label: "Kategori", type: "select", options: toOptions(expenseCategoryLabels) }, { name: "date", label: "Tarih", type: "date" }, { name: "description", label: "Açıklama", type: "textarea" },
    { name: "clientId", label: "Müvekkil", type: "select", options: clients, section: advanced }, { name: "caseFileId", label: "Dosya", type: "select", options: cases, section: advanced }, { name: "cashAccountId", label: "Kasa", type: "select", options: cash, section: advanced }, { name: "paymentMethod", label: "Ödeme yöntemi", type: "select", options: toOptions(paymentMethodLabels), section: advanced }, { name: "currency", label: "Para birimi", section: advanced }, { name: "isClientExpense", label: "Müvekkile yansıtılabilir", type: "select", options: [{ label: "Hayır", value: "false" }, { label: "Evet", value: "true" }], section: advanced }
  ] };
  if (kind === "client") return { title: "Müvekkil", endpoint: "/api/clients", schemaKey: "client", defaults: { name: "", phone: "", notes: "", type: "INDIVIDUAL", tcNo: "", taxNo: "", email: "", address: "" }, fields: [{ name: "name", label: "Ad / Ünvan" }, { name: "phone", label: "Telefon", type: "tel", required: false }, { name: "notes", label: "Not", type: "textarea" }, { name: "type", label: "Tür", type: "select", options: [{ label: "Gerçek kişi", value: "INDIVIDUAL" }, { label: "Şirket", value: "COMPANY" }], section: advanced }, ...["tcNo", "taxNo", "email", "address"].map((name) => ({ name, label: ({ tcNo: "T.C. No", taxNo: "Vergi No", email: "E-posta", address: "Adres" } as Record<string,string>)[name], section: advanced }))] };
  if (kind === "case") return { title: "Dosya", endpoint: "/api/cases", schemaKey: "caseFile", defaults: { clientId: "", title: "", fileNumber: "", caseType: "", courtOrOffice: "", status: "ACTIVE", notes: "" }, fields: [{ name: "clientId", label: "Müvekkil", type: "select", options: clients }, { name: "title", label: "Dosya başlığı" }, { name: "fileNumber", label: "Dosya numarası" }, { name: "caseType", label: "Dosya türü" }, { name: "courtOrOffice", label: "Mahkeme / Daire", section: advanced }, { name: "status", label: "Durum", type: "select", options: [{ label: "Aktif", value: "ACTIVE" }, { label: "Kapalı", value: "CLOSED" }, { label: "Arşiv", value: "ARCHIVED" }], section: advanced }, { name: "notes", label: "Not", type: "textarea", section: advanced }] };
  if (kind === "reminder") return { title: "Hatırlatma", endpoint: "/api/reminders", schemaKey: "reminder", defaults: { title: "", dueDate: today, reminderType: "GENERAL", amount: "", currency: "TRY", relatedClientId: "", relatedCaseFileId: "", cashAccountId: data.cashAccounts.find((item) => item.isDefault)?.id ?? "", status: "OPEN", priority: "NORMAL", notifyBeforeDays: "3", notificationEnabled: "true", description: "" }, fields: [{ name: "title", label: "Başlık" }, { name: "dueDate", label: "Vade tarihi", type: "date" }, { name: "reminderType", label: "Tür", type: "select", options: toOptions(reminderTypeLabels) }, { name: "amount", label: "Tutar", type: "currency", section: advanced }, { name: "relatedClientId", label: "Müvekkil", type: "select", options: clients, section: advanced }, { name: "relatedCaseFileId", label: "Dosya", type: "select", options: cases, section: advanced }, { name: "priority", label: "Öncelik", type: "select", options: toOptions(reminderPriorityLabels), section: advanced }, { name: "notifyBeforeDays", label: "Uyarı", type: "select", options: [{ label: "1 gün önce", value: "1" }, { label: "3 gün önce", value: "3" }, { label: "7 gün önce", value: "7" }, { label: "15 gün önce", value: "15" }], section: advanced }, { name: "cashAccountId", label: "Kasa", type: "select", options: cash, section: advanced }, { name: "currency", label: "Para birimi", section: advanced }, { name: "status", label: "Durum", type: "select", options: [{ label: "Açık", value: "OPEN" }, { label: "Tamamlandı", value: "DONE" }, { label: "İptal", value: "CANCELLED" }], section: advanced }, { name: "notificationEnabled", label: "Bildirim", type: "select", options: [{ label: "Açık", value: "true" }, { label: "Kapalı", value: "false" }], section: advanced }, { name: "description", label: "Açıklama", type: "textarea", section: advanced }] };
  if (kind === "advance") return { title: "Avans", endpoint: "/api/advances", schemaKey: "advance", defaults: { clientId: "", amount: "", direction: "RECEIVED", description: "", caseFileId: "", occurredAt: today, notes: "" }, fields: [{ name: "clientId", label: "Müvekkil", type: "select", options: clients }, { name: "amount", label: "Tutar", type: "currency" }, { name: "direction", label: "Yön", type: "select", options: [{ label: "Alındı", value: "RECEIVED" }, { label: "Harcandı", value: "SPENT" }] }, { name: "description", label: "Açıklama" }, { name: "caseFileId", label: "Dosya", type: "select", options: cases, section: advanced }, { name: "occurredAt", label: "Tarih", type: "date", section: advanced }, { name: "notes", label: "Not", type: "textarea", section: advanced }] };
  return null;
}

function localDateInputValue() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function QuickDocumentUpload({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return; setLoading(true);
    const data = new FormData(event.currentTarget); const file = data.get("file");
    if (file instanceof File && !data.get("title")) data.set("title", file.name.replace(/\.[^.]+$/, ""));
    const response = await fetch("/api/documents/upload", { method: "POST", body: data });
    setLoading(false); if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; showToast(body?.message ?? "Belge yüklenemedi."); return; }
    showToast("Belge yüklendi."); emitAppDataMutation("document-upload"); onSuccess();
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold text-slate-800">Dosya<input className="field mt-2 min-h-12 py-2" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls" required /></label><label className="block text-sm font-semibold text-slate-800">Belge türü<select className="field mt-2" name="documentType" defaultValue="BANK_RECEIPT">{documentTypeOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><input type="hidden" name="title" value="" /><div className="grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} disabled={loading} className="secondary-action min-h-12 w-full justify-center disabled:opacity-60">Geri</button><button type="submit" disabled={loading} className="primary-action min-h-12 w-full justify-center disabled:opacity-60">{loading ? "Yükleniyor..." : "Belgeyi Yükle"}</button></div></form>;
}
