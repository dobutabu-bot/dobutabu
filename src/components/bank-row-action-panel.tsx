"use client";

import { RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { TouchActionButton } from "@/components/touch-action-button";
import { showToast } from "@/components/toast";
import { apiRequest, clientErrorMessage } from "@/lib/client-api";
import { emitAppDataMutation } from "@/lib/client-sync";

type BankRowActionPanelProps = {
  row: {
    id: string;
    date: string | null;
    description: string;
    direction: "IN" | "OUT" | "NEUTRAL";
    amount: number;
    currency: string;
    amountLabel: string;
    signedAmount: number;
    category: string;
    matchType?: string | null;
    cashAccountId: string | null;
    clientSuggestionId: string | null;
    caseFileSuggestionId: string | null;
  };
  options: {
    clients: Array<{ id: string; name: string }>;
    caseFiles: Array<{ id: string; clientId: string; title: string; clientName: string }>;
    cashAccounts: Array<{ id: string; name: string; currency: string; isDefault: boolean }>;
  };
  systemMovements: Array<{
    id: string;
    date: string;
    description: string;
    direction: "IN" | "OUT";
    entryType: string;
    amount: number;
    amountLabel: string;
    clientName: string;
    caseFileTitle: string;
    cashAccountName: string;
    incomeId: string | null;
    expenseId: string | null;
  }>;
};

type CreateMode = "INCOME" | "EXPENSE" | "LEDGER";
type MatchTargetType = "INCOME" | "EXPENSE" | "LEDGER";

type CreateFormState = {
  clientId: string;
  caseFileId: string;
  cashAccountId: string;
  amount: string;
  currency: string;
  date: string;
  description: string;
  incomeCategory: "LEGAL_FEE" | "ADVANCE" | "EXPENSE_REIMBURSEMENT" | "OTHER";
  expenseCategory: "COURT_FEE" | "NOTARY" | "TRAVEL" | "ACCOMMODATION" | "OFFICE" | "TAX" | "PERSONNEL" | "MEAL" | "OTHER";
  isClientExpense: boolean;
};

const incomeCategories = [
  { value: "LEGAL_FEE", label: "Avukatlık ücreti" },
  { value: "ADVANCE", label: "Avans" },
  { value: "EXPENSE_REIMBURSEMENT", label: "Masraf iadesi" },
  { value: "OTHER", label: "Diğer" }
] as const;

const expenseCategories = [
  { value: "COURT_FEE", label: "Harç" },
  { value: "NOTARY", label: "Noter" },
  { value: "TRAVEL", label: "Ulaşım" },
  { value: "ACCOMMODATION", label: "Konaklama" },
  { value: "OFFICE", label: "Ofis gideri" },
  { value: "TAX", label: "Vergi" },
  { value: "PERSONNEL", label: "Personel" },
  { value: "MEAL", label: "Yemek" },
  { value: "OTHER", label: "Diğer" }
] as const;

export function BankRowActionPanel({ row, options, systemMovements }: BankRowActionPanelProps) {
  const router = useRouter();
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"IGNORE" | "UNDO" | null>(null);
  const [pending, setPending] = useState(false);
  const [matchTargetType, setMatchTargetType] = useState<MatchTargetType>(row.direction === "IN" ? "INCOME" : "EXPENSE");
  const [matchTargetId, setMatchTargetId] = useState("");
  const [form, setForm] = useState<CreateFormState>(() => defaultCreateForm(row, options));
  const suggestedClient = options.clients.find((client) => client.id === row.clientSuggestionId);
  const suggestedCaseFile = options.caseFiles.find((caseFile) => caseFile.id === row.caseFileSuggestionId);
  const bankSuggestions = [
    suggestedClient ? `Müvekkil: ${suggestedClient.name}` : null,
    suggestedCaseFile ? `Dosya: ${suggestedCaseFile.title}` : null,
    row.category ? `Kategori: ${row.category}` : null
  ].filter((item): item is string => Boolean(item));

  const filteredCaseFiles = useMemo(() => {
    if (!form.clientId) return options.caseFiles;
    return options.caseFiles.filter((caseFile) => caseFile.clientId === form.clientId);
  }, [form.clientId, options.caseFiles]);

  const matchOptions = useMemo(() => {
    return systemMovements
      .filter((movement) => movement.direction === row.direction)
      .flatMap((movement) => {
        if (matchTargetType === "INCOME" && movement.incomeId) {
          return [{ id: movement.incomeId, label: matchOptionLabel(movement) }];
        }
        if (matchTargetType === "EXPENSE" && movement.expenseId) {
          return [{ id: movement.expenseId, label: matchOptionLabel(movement) }];
        }
        if (matchTargetType === "LEDGER") {
          return [{ id: movement.id, label: matchOptionLabel(movement) }];
        }
        return [];
      });
  }, [matchTargetType, row.direction, systemMovements]);

  function openCreate(mode: CreateMode) {
    setForm(defaultCreateForm(row, options));
    setCreateMode(mode);
  }

  function closePanels() {
    setCreateMode(null);
    setMatchOpen(false);
    setConfirmAction(null);
    setPending(false);
  }

  function setFormValue<TKey extends keyof CreateFormState>(key: TKey, value: CreateFormState[TKey]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "clientId" && typeof value === "string") {
        const caseFile = options.caseFiles.find((item) => item.id === next.caseFileId);
        if (caseFile && caseFile.clientId !== value) next.caseFileId = "";
      }
      if (key === "caseFileId" && typeof value === "string" && value) {
        const caseFile = options.caseFiles.find((item) => item.id === value);
        if (caseFile && !next.clientId) next.clientId = caseFile.clientId;
      }
      return next;
    });
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createMode || pending) return;

    setPending(true);
    try {
      await apiRequest("/api/reconciliation/create-from-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankRowId: row.id,
          kind: createMode,
          clientId: form.clientId || null,
          caseFileId: form.caseFileId || null,
          cashAccountId: form.cashAccountId || null,
          amount: form.amount,
          currency: form.currency,
          date: form.date,
          description: form.description,
          incomeCategory: createMode === "INCOME" ? form.incomeCategory : null,
          expenseCategory: createMode === "EXPENSE" ? form.expenseCategory : null,
          isClientExpense: createMode === "EXPENSE" ? form.isClientExpense : null
        })
      }, "Kayıt oluşturulamadı.");
      showToast("Banka hareketinden kayıt oluşturuldu.");
      emitAppDataMutation("bank-row-create");
      closePanels();
      router.refresh();
    } catch (error) {
      showToast(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setPending(false);
    }
  }

  async function submitMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const targetId = matchTargetId || matchOptions[0]?.id || "";
    if (!targetId) {
      showToast("Eşleştirilecek kayıt bulunamadı.");
      return;
    }

    setPending(true);
    try {
      await apiRequest("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankRowId: row.id, targetType: matchTargetType, targetId, matchMode: "MANUALLY_MATCHED" })
      }, "Eşleştirme yapılamadı.");
      showToast("Banka hareketi eşleştirildi.");
      emitAppDataMutation("bank-row-match");
      closePanels();
      router.refresh();
    } catch (error) {
      showToast(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex w-full max-w-full min-w-0 flex-wrap justify-stretch gap-2 sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
        {isClosedRow(row.matchType) ? (
          <TouchActionButton onClick={() => setConfirmAction("UNDO")}>
            Geri al
          </TouchActionButton>
        ) : (
          <>
            {row.direction === "IN" ? (
              <TouchActionButton tone="primary" onClick={() => openCreate("INCOME")}>
                Tahsilat oluştur
              </TouchActionButton>
            ) : null}
            {row.direction === "OUT" ? (
              <TouchActionButton tone="primary" onClick={() => openCreate("EXPENSE")}>
                Gider oluştur
              </TouchActionButton>
            ) : null}
            {row.direction !== "NEUTRAL" ? (
              <>
                <TouchActionButton onClick={() => openCreate("LEDGER")}>
                  Kasa hareketi
                </TouchActionButton>
                <TouchActionButton
                  onClick={() => {
                    setMatchTargetType(row.direction === "IN" ? "INCOME" : "EXPENSE");
                    setMatchTargetId("");
                    setMatchOpen(true);
                  }}
                >
                  Var olanla eşleştir
                </TouchActionButton>
              </>
            ) : null}
            <TouchActionButton tone="danger" onClick={() => setConfirmAction("IGNORE")}>
              Yoksay
            </TouchActionButton>
          </>
        )}
      </div>

      {createMode ? (
        <Modal title={createTitle(createMode)} onClose={closePanels}>
          <form onSubmit={submitCreate} className="min-w-0 space-y-4">
            <BankRowSummary row={row} />
            {bankSuggestions.length > 0 ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-semibold">Akıllı öneri</p>
                <p className="mt-1 break-words text-blue-800">{bankSuggestions.join(" · ")}</p>
                <p className="mt-1 text-xs text-blue-700">
                  Banka açıklamasından önerildi. Alanları değiştirebilirsiniz; kayıt yalnız Onayla ve Oluştur ile oluşur.
                </p>
              </div>
            ) : null}
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Tarih">
                <input className="field" type="date" value={form.date} onChange={(event) => setFormValue("date", event.target.value)} required />
              </Field>
              <Field label="Tutar">
                <input className="field" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setFormValue("amount", event.target.value)} required />
              </Field>
              <Field label="Para Birimi">
                <input className="field" value={form.currency} maxLength={3} onChange={(event) => setFormValue("currency", event.target.value.toUpperCase())} required />
              </Field>
              <Field label="Kasa hesabı">
                <select className="field" value={form.cashAccountId} onChange={(event) => setFormValue("cashAccountId", event.target.value)}>
                  {options.cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.isDefault ? "(Varsayılan)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {createMode !== "LEDGER" ? (
                <>
                  <Field label={createMode === "INCOME" ? "Müvekkil" : "Müvekkil opsiyonel"}>
                    <select className="field" value={form.clientId} onChange={(event) => setFormValue("clientId", event.target.value)}>
                      <option value="">Seçilmedi</option>
                      {options.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Dosya opsiyonel">
                    <select className="field" value={form.caseFileId} onChange={(event) => setFormValue("caseFileId", event.target.value)}>
                      <option value="">Seçilmedi</option>
                      {filteredCaseFiles.map((caseFile) => (
                        <option key={caseFile.id} value={caseFile.id}>
                          {caseFile.title} · {caseFile.clientName}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}
              {createMode === "INCOME" ? (
                <Field label="Tahsilat kategorisi">
                  <select className="field" value={form.incomeCategory} onChange={(event) => setFormValue("incomeCategory", event.target.value as CreateFormState["incomeCategory"])}>
                    {incomeCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {createMode === "EXPENSE" ? (
                <>
                  <Field label="Gider kategorisi">
                    <select className="field" value={form.expenseCategory} onChange={(event) => setFormValue("expenseCategory", event.target.value as CreateFormState["expenseCategory"])}>
                      {expenseCategories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={form.isClientExpense} onChange={(event) => setFormValue("isClientExpense", event.target.checked)} />
                    Müvekkile yansıtılabilir gider
                  </label>
                </>
              ) : null}
              {createMode === "LEDGER" ? (
                <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:col-span-2">
                  Bu seçenek yalnızca dijital kasa hareketi oluşturur; gelir/gider raporlarını şişirmez.
                </p>
              ) : null}
              <Field label="Açıklama" className="sm:col-span-2">
                <textarea className="field min-h-24 resize-none" value={form.description} onChange={(event) => setFormValue("description", event.target.value)} />
              </Field>
            </div>
            <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <TouchActionButton onClick={closePanels} className="justify-center">
                Vazgeç
              </TouchActionButton>
              <TouchActionButton type="submit" disabled={pending} tone="primary" className="justify-center">
                {pending ? "Oluşturuluyor..." : "Onayla ve Oluştur"}
              </TouchActionButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {matchOpen ? (
        <Modal title="Var Olan Kayıtla Eşleştir" onClose={closePanels}>
          <form onSubmit={submitMatch} className="min-w-0 space-y-4">
            <BankRowSummary row={row} />
            <div className="grid min-w-0 gap-3">
              <Field label="Eşleştirme türü">
                <select
                  className="field"
                  value={matchTargetType}
                  onChange={(event) => {
                    setMatchTargetType(event.target.value as MatchTargetType);
                    setMatchTargetId("");
                  }}
                >
                  {row.direction === "IN" ? <option value="INCOME">Var olan tahsilat</option> : null}
                  {row.direction === "OUT" ? <option value="EXPENSE">Var olan gider</option> : null}
                  <option value="LEDGER">Var olan kasa hareketi</option>
                </select>
              </Field>
              <Field label="Kayıt seç">
                <select className="field" value={matchTargetId || matchOptions[0]?.id || ""} onChange={(event) => setMatchTargetId(event.target.value)} disabled={matchOptions.length === 0}>
                  {matchOptions.length === 0 ? <option value="">Uygun kayıt bulunamadı</option> : null}
                  {matchOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <TouchActionButton onClick={closePanels} className="justify-center">
                Vazgeç
              </TouchActionButton>
              <TouchActionButton type="submit" disabled={pending || matchOptions.length === 0} tone="primary" className="justify-center">
                {pending ? "Eşleştiriliyor..." : "Onayla ve Eşleştir"}
              </TouchActionButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {confirmAction ? (
        <Modal title={confirmAction === "IGNORE" ? "Banka Hareketini Yoksay" : "İşlemi Geri Al"} onClose={closePanels}>
          <div className="space-y-4">
            <BankRowSummary row={row} />
            <p className="rounded-3xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              {confirmAction === "IGNORE"
                ? "Bu banka hareketi mutabakat listelerinde yoksayılacak. İsterseniz daha sonra geri alabilirsiniz."
                : row.matchType === "CREATED_FROM_BANK"
                  ? "Bankadan oluşturulan kayıt ve bağlı kasa hareketi soft delete yapılacak, banka satırı yeniden eşleşmemiş duruma dönecek."
                  : "Banka hareketinin mevcut eşleşmesi kaldırılacak, sistemdeki kayıt silinmeyecek."}
            </p>
            <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <TouchActionButton onClick={closePanels} className="justify-center">
                Vazgeç
              </TouchActionButton>
              <PostButton
                endpoint={confirmAction === "IGNORE" ? "/api/reconciliation/ignore" : "/api/reconciliation/unmatch"}
                payload={{ bankRowId: row.id }}
                label={confirmAction === "IGNORE" ? "Onayla ve Yoksay" : "Onayla ve Geri Al"}
                onDone={closePanels}
              />
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function defaultCreateForm(row: BankRowActionPanelProps["row"], options: BankRowActionPanelProps["options"]): CreateFormState {
  return {
    clientId: row.clientSuggestionId ?? "",
    caseFileId: row.caseFileSuggestionId ?? "",
    cashAccountId: row.cashAccountId ?? options.cashAccounts.find((account) => account.isDefault)?.id ?? options.cashAccounts[0]?.id ?? "",
    amount: String(row.amount || ""),
    currency: row.currency || "TRY",
    date: row.date ?? "",
    description: row.description,
    incomeCategory: "LEGAL_FEE",
    expenseCategory: defaultExpenseCategory(row.category),
    isClientExpense: Boolean(row.clientSuggestionId || row.caseFileSuggestionId)
  };
}

function defaultExpenseCategory(category: string): CreateFormState["expenseCategory"] {
  const text = category.toLocaleLowerCase("tr-TR");
  if (text.includes("noter")) return "NOTARY";
  if (text.includes("harç") || text.includes("harc")) return "COURT_FEE";
  if (text.includes("ulaş") || text.includes("ulas")) return "TRAVEL";
  if (text.includes("konak")) return "ACCOMMODATION";
  if (text.includes("vergi") || text.includes("sgk")) return "TAX";
  if (text.includes("personel")) return "PERSONNEL";
  if (text.includes("yemek")) return "MEAL";
  if (text.includes("ofis") || text.includes("kira")) return "OFFICE";
  return "OTHER";
}

function createTitle(mode: CreateMode) {
  if (mode === "INCOME") return "Banka Hareketinden Tahsilat Oluştur";
  if (mode === "EXPENSE") return "Banka Hareketinden Gider Oluştur";
  return "Banka Hareketinden Kasa Hareketi Oluştur";
}

function matchOptionLabel(movement: BankRowActionPanelProps["systemMovements"][number]) {
  return `${formatDateInput(movement.date)} · ${movement.amountLabel} · ${movement.description.slice(0, 72)} · ${movement.cashAccountName}`;
}

function formatDateInput(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function BankRowSummary({ row }: { row: BankRowActionPanelProps["row"] }) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Banka hareketi</p>
      <p className="mt-1 text-sm text-slate-600">{formatDateInput(row.date)}</p>
      <p className="mt-2 line-clamp-3 break-words text-sm font-medium text-slate-950 [overflow-wrap:anywhere]">{row.description}</p>
      <p className={row.direction === "IN" ? "mt-2 text-sm font-semibold text-emerald-700 tabular-nums" : "mt-2 text-sm font-semibold text-rose-700 tabular-nums"}>
        {row.direction === "IN" ? "+" : row.direction === "OUT" ? "-" : ""}
        {row.amountLabel}
      </p>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`min-w-0 space-y-1 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92dvh] w-full max-w-[100vw] min-w-0 overflow-y-auto rounded-t-3xl border border-white/70 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-w-[min(42rem,calc(100vw-2rem))] sm:rounded-3xl sm:p-5">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Onay gerekli</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{title}</h2>
          </div>
          <TouchActionButton iconOnly onClick={onClose} className="shrink-0 rounded-2xl border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-50" aria-label="Kapat">
            <X className="h-5 w-5" aria-hidden />
          </TouchActionButton>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function PostButton({ endpoint, payload, label, onDone }: { endpoint: string; payload: Record<string, unknown>; label: string; onDone?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      await apiRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, "İşlem tamamlanamadı.");
      showToast(`${label} işlemi tamamlandı.`);
      emitAppDataMutation("bank-row-action");
      onDone?.();
      router.refresh();
    } catch (error) {
      showToast(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setPending(false);
    }
  }

  return (
    <TouchActionButton tone="danger" onClick={run} disabled={pending} className="justify-center">
      {pending ? (
        <>
          <RotateCcw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          İşleniyor
        </>
      ) : (
          label
      )}
    </TouchActionButton>
  );
}

function isClosedRow(matchType?: string | null) {
  return matchType === "MATCHED" || matchType === "AUTO_MATCHED" || matchType === "MANUALLY_MATCHED" || matchType === "CREATED_FROM_BANK" || matchType === "IGNORED";
}
