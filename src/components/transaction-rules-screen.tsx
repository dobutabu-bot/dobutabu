"use client";

import { FlaskConical, Loader2, Pencil, Plus, Power, ShieldCheck, SlidersHorizontal, Trash2, Wand2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/toast";
import { emitAppDataMutation } from "@/lib/client-sync";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string;
};

type Rule = {
  id: string;
  name: string;
  keyword: string;
  matchType: string;
  direction: string;
  category: string;
  targetGroup: string;
  amountMin: number | null;
  amountMax: number | null;
  priority: number;
  confidence: number;
  clientId: string | null;
  caseFileId: string | null;
  cashAccountId: string | null;
  isActive: boolean;
  clientName: string | null;
  caseFileTitle: string | null;
  cashAccountName: string | null;
};

type RuleFormState = {
  name: string;
  matchType: string;
  keyword: string;
  direction: string;
  targetGroup: string;
  category: string;
  amountMin: string;
  amountMax: string;
  priority: string;
  confidence: string;
  clientId: string;
  caseFileId: string;
  cashAccountId: string;
  isActive: string;
};

type TestResult = {
  matched: boolean;
  suggestion: {
    category: string;
    group: string;
    confidenceLabel: string;
    reason: string;
    ruleName: string | null;
    clientId: string | null;
    caseFileId: string | null;
    cashAccountId: string | null;
    isHighConfidence: boolean;
  };
  rule: Rule | null;
};

type TransactionRulesScreenProps = {
  initialRules: Rule[];
  clients: Option[];
  caseFiles: Option[];
  cashAccounts: Option[];
};

const matchTypeOptions = [
  { value: "DESCRIPTION_CONTAINS", label: "Açıklama içinde kelime geçiyorsa" },
  { value: "COUNTERPARTY_MATCHES", label: "Karşı taraf adı eşleşiyorsa" },
  { value: "IBAN_MATCHES", label: "IBAN / hesap no eşleşiyorsa" },
  { value: "AMOUNT_RANGE", label: "Tutar aralığı eşleşiyorsa" },
  { value: "REGEX", label: "Regex eşleşiyorsa" }
];

const directionOptions = [
  { value: "ANY", label: "Her yön" },
  { value: "IN", label: "Giriş" },
  { value: "OUT", label: "Çıkış" },
  { value: "NEUTRAL", label: "Nötr" }
];

const groupOptions = [
  { value: "", label: "Yöne göre otomatik" },
  { value: "INCOME", label: "Gelir" },
  { value: "EXPENSE", label: "Gider" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "NEUTRAL", label: "Nötr" }
];

const examples: Array<{ label: string; data: Partial<RuleFormState> }> = [
  { label: "KİRA -> Ofis/Kira", data: { name: "Kira ödemesi", keyword: "KİRA", category: "Ofis/Kira", direction: "OUT", targetGroup: "EXPENSE", priority: "20", confidence: "0.9" } },
  { label: "SGK -> SGK", data: { name: "SGK ödemesi", keyword: "SGK", category: "SGK", direction: "OUT", targetGroup: "EXPENSE", priority: "30", confidence: "0.9" } },
  { label: "VERGİ -> Vergi", data: { name: "Vergi ödemesi", keyword: "VERGİ", category: "Vergi", direction: "OUT", targetGroup: "EXPENSE", priority: "35", confidence: "0.9" } },
  { label: "UYAP/HARÇ -> Harç", data: { name: "UYAP harç ödemesi", keyword: "UYAP|HARÇ", matchType: "REGEX", category: "Harç", direction: "OUT", targetGroup: "EXPENSE", priority: "40", confidence: "0.88" } }
];

export function TransactionRulesScreen({ initialRules, clients, caseFiles, cashAccounts }: TransactionRulesScreenProps) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [form, setForm] = useState<RuleFormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testInput, setTestInput] = useState({ description: "KİRA ÖDEMESİ OFİS", direction: "OUT", amount: "12500", iban: "", counterparty: "" });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "tr")), [rules]);

  async function refreshRules() {
    const response = await fetch("/api/settings/transaction-rules");
    const payload = (await response.json().catch(() => null)) as { rules?: Rule[] } | null;
    if (response.ok && payload?.rules) setRules(payload.rules);
  }

  async function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(editingId ? `/api/settings/transaction-rules/${editingId}` : "/api/settings/transaction-rules", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setMessage(payload?.message ?? "Kural kaydedilemedi.");
        return;
      }

      showToast(editingId ? "Kural güncellendi." : "Kural oluşturuldu.");
      emitAppDataMutation("transaction-rule");
      await refreshRules();
      setForm(defaultForm());
      setEditingId(null);
      router.refresh();
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(rule: Rule) {
    const next = toForm(rule);
    next.isActive = rule.isActive ? "false" : "true";
    setLoading(true);

    try {
      const response = await fetch(`/api/settings/transaction-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });

      if (response.ok) {
        showToast(rule.isActive ? "Kural pasifleştirildi." : "Kural aktifleştirildi.");
        await refreshRules();
        router.refresh();
      } else {
        showToast("Kural durumu değiştirilemedi.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule() {
    if (!pendingDelete) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/settings/transaction-rules/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("Kural silinemedi.");
        return;
      }

      showToast("Kural silindi.");
      emitAppDataMutation("transaction-rule-delete");
      setPendingDelete(null);
      await refreshRules();
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function runTest() {
    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/settings/transaction-rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testInput)
      });
      const payload = (await response.json().catch(() => null)) as TestResult | { message?: string } | null;

      if (!response.ok || !isTestResult(payload)) {
        const errorMessage = payload && "message" in payload ? payload.message : "Test çalıştırılamadı.";
        showToast(errorMessage || "Test çalıştırılamadı.");
        return;
      }

      setTestResult(payload);
    } finally {
      setTestLoading(false);
    }
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setForm(toForm(rule));
    setMessage(null);
  }

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Akıllı Banka Analizi</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Kategori ve Sınıflandırma Kuralları</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Banka hareketleri tekrar yüklendiğinde sistem sizin kurallarınızı öncelikli uygular. Açıklama, karşı taraf, IBAN, tutar aralığı veya regex ile kategori, yön, müvekkil, dosya ve kasa önerisi üretin.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm leading-6 text-slate-200">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              <span>Kurallar kullanıcı onayıyla oluşturulur; düşük güvenli eşleşmeler otomatik kayıt oluşturmaz, analiz ekranında öneri olarak görünür.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <form onSubmit={submitRule} className="surface p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{editingId ? "Kural Düzenle" : "Kural Ekle"}</h2>
              <p className="mt-1 text-xs text-slate-500">Kullanıcı dostu cümle mantığı: Açıklama içinde kelime geçerse kategori ve yön atansın.</p>
            </div>
            <button type="submit" className="primary-action min-h-11" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {editingId ? "Güncelle" : "Kural ekle"}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example.label}
                type="button"
                className="secondary-action min-h-11 px-3"
                onClick={() => setForm((current) => ({ ...current, ...example.data }))}
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                {example.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Kural adı" className="xl:col-span-2">
              <input className="field" value={form.name} onChange={(event) => setFormValue("name", event.target.value, setForm)} placeholder="Örn. Ofis kira ödemesi" />
            </Field>
            <Field label="Aktif mi?">
              <select className="field" value={form.isActive} onChange={(event) => setFormValue("isActive", event.target.value, setForm)}>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </Field>
            <Field label="Kural türü" className="md:col-span-2">
              <select className="field" value={form.matchType} onChange={(event) => setFormValue("matchType", event.target.value, setForm)}>
                {matchTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={form.matchType === "REGEX" ? "Regex / desen" : form.matchType === "AMOUNT_RANGE" ? "Eşleşme metni (opsiyonel)" : "Eşleşme metni"} className="md:col-span-2">
              <input className="field" value={form.keyword} onChange={(event) => setFormValue("keyword", event.target.value, setForm)} placeholder={form.matchType === "REGEX" ? "UYAP|HARÇ" : "KİRA, SGK, VERGİ, müvekkil adı"} />
            </Field>
            <Field label="Yön">
              <select className="field" value={form.direction} onChange={(event) => setFormValue("direction", event.target.value, setForm)}>
                {directionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kategori ata">
              <input className="field" value={form.category} onChange={(event) => setFormValue("category", event.target.value, setForm)} placeholder="Ofis/Kira, SGK, Vergi, Harç" />
            </Field>
            <Field label="Gelir/gider/transfer tipi">
              <select className="field" value={form.targetGroup} onChange={(event) => setFormValue("targetGroup", event.target.value, setForm)}>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tutar alt sınır">
              <input className="field" type="number" min="0" step="0.01" value={form.amountMin} onChange={(event) => setFormValue("amountMin", event.target.value, setForm)} />
            </Field>
            <Field label="Tutar üst sınır">
              <input className="field" type="number" min="0" step="0.01" value={form.amountMax} onChange={(event) => setFormValue("amountMax", event.target.value, setForm)} />
            </Field>
            <Field label="Öncelik">
              <input className="field" type="number" min="1" max="999" step="1" value={form.priority} onChange={(event) => setFormValue("priority", event.target.value, setForm)} />
            </Field>
            <Field label="Güven skoru">
              <input className="field" type="number" min="0" max="1" step="0.01" value={form.confidence} onChange={(event) => setFormValue("confidence", event.target.value, setForm)} />
            </Field>
            <Field label="Müvekkil öner">
              <select className="field" value={form.clientId} onChange={(event) => setFormValue("clientId", event.target.value, setForm)}>
                <option value="">Önerme</option>
                {clients.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dosya öner">
              <select className="field" value={form.caseFileId} onChange={(event) => setFormValue("caseFileId", event.target.value, setForm)}>
                <option value="">Önerme</option>
                {caseFiles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kasa hesabı öner">
              <select className="field" value={form.cashAccountId} onChange={(event) => setFormValue("cashAccountId", event.target.value, setForm)}>
                <option value="">Önerme</option>
                {cashAccounts.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}

          {editingId ? (
            <button type="button" className="secondary-action mt-4 min-h-11" onClick={() => { setEditingId(null); setForm(defaultForm()); }}>
              <XCircle className="h-4 w-4" aria-hidden />
              Düzenlemeyi bırak
            </button>
          ) : null}
        </form>

        <section className="surface p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <FlaskConical className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Kural Testi</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Örnek açıklama girin; hangi kuralın eşleştiğini ve hangi sonucu ürettiğini görün.</p>
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Örnek açıklama">
              <textarea className="field min-h-24 resize-none" value={testInput.description} onChange={(event) => setTestInput((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Yön">
                <select className="field" value={testInput.direction} onChange={(event) => setTestInput((current) => ({ ...current, direction: event.target.value }))}>
                  <option value="IN">Giriş</option>
                  <option value="OUT">Çıkış</option>
                  <option value="NEUTRAL">Nötr</option>
                </select>
              </Field>
              <Field label="Tutar">
                <input className="field" type="number" min="0" step="0.01" value={testInput.amount} onChange={(event) => setTestInput((current) => ({ ...current, amount: event.target.value }))} />
              </Field>
              <Field label="Karşı taraf">
                <input className="field" value={testInput.counterparty} onChange={(event) => setTestInput((current) => ({ ...current, counterparty: event.target.value }))} />
              </Field>
              <Field label="IBAN / hesap no">
                <input className="field" value={testInput.iban} onChange={(event) => setTestInput((current) => ({ ...current, iban: event.target.value }))} />
              </Field>
            </div>
            <button type="button" className="primary-action min-h-11 w-full justify-center" onClick={runTest} disabled={testLoading}>
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FlaskConical className="h-4 w-4" aria-hidden />}
              Test et
            </button>
          </div>

          {testResult ? (
            <div className={cn("mt-4 rounded-3xl border p-4", testResult.matched ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{testResult.matched ? "Eşleşen kural" : "Varsayılan analiz"}</p>
              <h3 className="mt-2 text-base font-semibold text-slate-950">{testResult.rule?.name ?? testResult.suggestion.ruleName ?? "Kural eşleşmedi"}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <InfoLine label="Kategori" value={testResult.suggestion.category} />
                <InfoLine label="Tip" value={groupLabel(testResult.suggestion.group)} />
                <InfoLine label="Güven" value={testResult.suggestion.confidenceLabel} />
                <InfoLine label="Sebep" value={testResult.suggestion.reason} />
                {testResult.rule?.clientName ? <InfoLine label="Müvekkil" value={testResult.rule.clientName} /> : null}
                {testResult.rule?.caseFileTitle ? <InfoLine label="Dosya" value={testResult.rule.caseFileTitle} /> : null}
                {testResult.rule?.cashAccountName ? <InfoLine label="Kasa" value={testResult.rule.cashAccountName} /> : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Kural Listesi</h2>
            <p className="mt-1 text-xs text-slate-500">Öncelik küçük olan kural önce çalışır. İlk eşleşen aktif kural uygulanır.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rules.length} kural</span>
        </div>

        {sortedRules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-950">Henüz kural yok</p>
            <p className="mt-1 text-sm text-slate-500">Kira, SGK, vergi, UYAP veya müvekkil adı gibi tekrar eden açıklamalar için ilk kuralınızı ekleyin.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedRules.map((rule) => (
              <article key={rule.id} className={cn("rounded-3xl border p-4", rule.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-80")}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", rule.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
                        {rule.isActive ? "Aktif" : "Pasif"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Öncelik {rule.priority}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{matchTypeLabel(rule.matchType)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-950">{rule.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {sentenceForRule(rule)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Pill label={`Kategori: ${rule.category}`} />
                      <Pill label={`Tip: ${groupLabel(rule.targetGroup)}`} />
                      <Pill label={`Yön: ${directionLabel(rule.direction)}`} />
                      <Pill label={`Güven: %${Math.round(rule.confidence * 100)}`} />
                      {rule.clientName ? <Pill label={`Müvekkil: ${rule.clientName}`} /> : null}
                      {rule.caseFileTitle ? <Pill label={`Dosya: ${rule.caseFileTitle}`} /> : null}
                      {rule.cashAccountName ? <Pill label={`Kasa: ${rule.cashAccountName}`} /> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="secondary-action min-h-11" onClick={() => toggleRule(rule)} disabled={loading}>
                      <Power className="h-4 w-4" aria-hidden />
                      {rule.isActive ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                    <button type="button" className="secondary-action min-h-11" onClick={() => startEdit(rule)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      Düzenle
                    </button>
                    <button type="button" className="secondary-action min-h-11 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setPendingDelete(rule)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Kural silinsin mi?"
        description="Bu kural normal listeden kaldırılır ve banka hareketi analizinde artık kullanılmaz."
        confirmLabel="Sil"
        loading={deleteLoading}
        onConfirm={deleteRule}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("space-y-1", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-24 text-slate-500">{label}</span>
      <span className="font-medium text-slate-950">{value}</span>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{label}</span>;
}

function defaultForm(): RuleFormState {
  return {
    name: "",
    matchType: "DESCRIPTION_CONTAINS",
    keyword: "",
    direction: "ANY",
    targetGroup: "",
    category: "",
    amountMin: "",
    amountMax: "",
    priority: "100",
    confidence: "0.9",
    clientId: "",
    caseFileId: "",
    cashAccountId: "",
    isActive: "true"
  };
}

function toForm(rule: Rule): RuleFormState {
  return {
    name: rule.name,
    matchType: rule.matchType,
    keyword: rule.keyword,
    direction: rule.direction,
    targetGroup: rule.targetGroup,
    category: rule.category,
    amountMin: rule.amountMin?.toString() ?? "",
    amountMax: rule.amountMax?.toString() ?? "",
    priority: rule.priority.toString(),
    confidence: rule.confidence.toString(),
    clientId: rule.clientId ?? "",
    caseFileId: rule.caseFileId ?? "",
    cashAccountId: rule.cashAccountId ?? "",
    isActive: rule.isActive ? "true" : "false"
  };
}

function setFormValue(field: keyof RuleFormState, value: string, setForm: React.Dispatch<React.SetStateAction<RuleFormState>>) {
  setForm((current) => ({ ...current, [field]: value }));
}

function isTestResult(value: TestResult | { message?: string } | null): value is TestResult {
  return Boolean(value && "suggestion" in value && "matched" in value);
}

function matchTypeLabel(value: string) {
  return matchTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function directionLabel(value: string) {
  return directionOptions.find((option) => option.value === value)?.label ?? value;
}

function groupLabel(value: string) {
  return groupOptions.find((option) => option.value === value)?.label ?? (value || "Otomatik");
}

function sentenceForRule(rule: Rule) {
  const amountPart =
    rule.amountMin || rule.amountMax
      ? ` Tutar ${rule.amountMin ?? 0} - ${rule.amountMax ?? "∞"} aralığındaysa`
      : "";

  if (rule.matchType === "AMOUNT_RANGE") {
    return `Tutar aralığı eşleşirse kategori "${rule.category}" olsun.${amountPart}`;
  }

  if (rule.matchType === "REGEX") {
    return `Regex "${rule.keyword}" eşleşirse kategori "${rule.category}" olsun.${amountPart}`;
  }

  if (rule.matchType === "COUNTERPARTY_MATCHES") {
    return `Karşı taraf adında "${rule.keyword}" geçerse kategori "${rule.category}" olsun.${amountPart}`;
  }

  if (rule.matchType === "IBAN_MATCHES") {
    return `IBAN/hesap no "${rule.keyword}" ile eşleşirse kategori "${rule.category}" olsun.${amountPart}`;
  }

  return `Açıklama içinde "${rule.keyword}" geçerse kategori "${rule.category}" olsun.${amountPart}`;
}
