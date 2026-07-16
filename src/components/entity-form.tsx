"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { emitAppDataMutation } from "@/lib/client-sync";
import { apiRequest, clientErrorMessage } from "@/lib/client-api";
import { schemaMap, type SchemaKey } from "@/lib/validations";
import { showToast } from "@/components/toast";
import {
  Combobox,
  CurrencyInput,
  DateInput,
  ErrorText,
  FormField,
  FormSection,
  HelperText,
  Label,
  Select,
  SubmitBar,
  Switch,
  Textarea
} from "@/components/premium-form";

type Option = {
  label: string;
  value: string;
  parentValue?: string;
  searchTerms?: string[];
};

type FieldDynamicRule = {
  field: string;
  values: string[];
};

type FieldDynamicTextRule = FieldDynamicRule & {
  text: string;
};

type FieldDynamicPlaceholderRule = FieldDynamicRule & {
  placeholder: string;
};

export type EntityFormField = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "currency" | "date" | "select" | "combobox" | "textarea" | "switch";
  placeholder?: string;
  placeholderWhen?: FieldDynamicPlaceholderRule[];
  hint?: string;
  hintWhen?: FieldDynamicTextRule[];
  options?: Option[];
  step?: string;
  min?: string;
  className?: string;
  required?: boolean;
  section?: "basic" | "advanced";
  showWhen?: FieldDynamicRule;
  highlightWhen?: FieldDynamicRule & {
    className?: string;
  };
};

type EntityFormProps = {
  title: string;
  endpoint: string;
  method?: "POST" | "PATCH";
  schemaKey: SchemaKey;
  fields: EntityFormField[];
  defaults: Record<string, string>;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  successMessage?: string | ((values: Record<string, string>) => string);
  onSuccess?: () => void;
  onCancel?: () => void;
  idPrefix?: string;
};

export function EntityForm({
  title,
  endpoint,
  method = "POST",
  schemaKey,
  fields,
  defaults,
  submitLabel = "Kaydet",
  resetOnSuccess = true,
  successMessage = "Kaydedildi",
  onSuccess,
  onCancel,
  idPrefix
}: EntityFormProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [paymentPreferenceApplied, setPaymentPreferenceApplied] = useState(false);
  const schema = schemaMap[schemaKey];
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema as never) as unknown as Resolver<Record<string, string>>,
    defaultValues: defaults
  });
  const watchedValues = form.watch();
  const submitting = form.formState.isSubmitting || locked;
  const basicFields = fields.filter((field) => field.section !== "advanced");
  const advancedFields = fields.filter((field) => field.section === "advanced");
  const suggestion = useMemo(
    () => resolveSmartSuggestion(schemaKey, fields, watchedValues),
    [fields, schemaKey, watchedValues]
  );
  const smartDefaults = useMemo(
    () => resolveSmartDefaults(method, fields, watchedValues, defaults, paymentPreferenceApplied),
    [defaults, fields, method, paymentPreferenceApplied, watchedValues]
  );

  useEffect(() => {
    setHydrated(true);
    if (method !== "POST") return;
    const preferences = readFormPreferences(schemaKey);
    for (const [name, value] of Object.entries(preferences)) {
      if (fields.some((field) => field.name === name) && value) {
        form.setValue(name, value, { shouldDirty: false, shouldValidate: false });
        if (name === "paymentMethod") setPaymentPreferenceApplied(true);
      }
    }
  }, [fields, form, method, schemaKey]);

  async function onSubmit(values: Record<string, string>) {
    if (locked) {
      return;
    }

    setMessage(null);
    setFormError(null);
    setLocked(true);

    try {
      await apiRequest(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      }, "İşlem tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.");

      const nextSuccessMessage = typeof successMessage === "function" ? successMessage(values) : successMessage;

      if (method === "POST") {
        writeFormPreferences(schemaKey, values);
      }

      if (resetOnSuccess) {
        form.reset(defaults);
      }
      emitAppDataMutation(`${schemaKey}-${method.toLowerCase()}`);
      router.refresh();
      setMessage(nextSuccessMessage);
      showToast(nextSuccessMessage);
      onSuccess?.();
    } catch (error) {
      setFormError(clientErrorMessage(error, "Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin."));
    } finally {
      setLocked(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      aria-busy={submitting}
      data-form-ready={hydrated ? "true" : "false"}
    >
      <FormSection title={title}>
        {smartDefaults.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Akıllı varsayımlar</span>
              {smartDefaults.map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Değerleri değiştirebilirsiniz; kayıt yalnız Kaydet onayınızla oluşturulur.</p>
          </div>
        ) : null}
        {suggestion ? (
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            <div className="min-w-0">
              <p className="font-semibold">Akıllı öneri: {suggestion.label}</p>
              <p className="mt-0.5 text-xs text-blue-700">{suggestion.reason}</p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
              onClick={() => form.setValue(suggestion.field, suggestion.value, { shouldDirty: true, shouldValidate: true })}
            >
              Uygula
            </button>
          </div>
        ) : null}
        <FieldGrid scope="basic" fields={basicFields} submitting={submitting} watchedValues={watchedValues} defaults={defaults} form={form} idPrefix={idPrefix ?? schemaKey} />

        {advancedFields.length > 0 ? (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 open:bg-white">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15">
              <span>Gelişmiş Seçenekler</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">{advancedFields.length} alan</span>
            </summary>
            <div className="border-t border-slate-200 p-4">
              <FieldGrid scope="advanced" fields={advancedFields} submitting={submitting} watchedValues={watchedValues} defaults={defaults} form={form} idPrefix={idPrefix ?? schemaKey} />
            </div>
          </details>
        ) : null}
      </FormSection>

      <SubmitBar
        submitting={submitting}
        submitLabel={submitLabel}
        message={message}
        error={formError}
        onCancel={onCancel}
      />
    </form>
  );
}

type FieldGridProps = {
  scope: "basic" | "advanced";
  fields: EntityFormField[];
  submitting: boolean;
  watchedValues: Record<string, string>;
  defaults: Record<string, string>;
  form: ReturnType<typeof useForm<Record<string, string>>>;
  idPrefix: string;
};

function FieldGrid({ scope, fields, submitting, watchedValues, defaults, form, idPrefix }: FieldGridProps) {
  return (
    <fieldset data-form-section={scope} disabled={submitting} className="grid gap-3 disabled:opacity-75 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => {
        if (field.showWhen && !field.showWhen.values.includes(watchedValues[field.showWhen.field] ?? "")) return null;
        const error = form.formState.errors[field.name]?.message as string | undefined;
        const id = `${idPrefix}-${field.name}`;
        const hint = resolveHint(field, watchedValues);
        const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
        const highlighted = field.highlightWhen && field.highlightWhen.values.includes(watchedValues[field.highlightWhen.field] ?? "");
        const type = resolveFieldType(field);
        const registration = form.register(field.name);
        const commonProps = { "aria-invalid": Boolean(error), "aria-describedby": describedBy };
        return (
          <FormField key={field.name} highlighted={Boolean(highlighted)} highlightClassName={field.highlightWhen?.className} className={field.className}>
            {type === "switch" ? (
              <Switch id={id} label={field.label} description={hint} {...commonProps} {...registration} />
            ) : (
              <>
                <Label htmlFor={id} required={field.required ?? isLikelyRequired(field)}>{field.label}</Label>
                {type === "textarea" ? <Textarea id={id} rows={3} placeholder={resolvePlaceholder(field, watchedValues)} {...commonProps} {...registration} /> :
                type === "select" ? <Select id={id} options={field.options ?? []} value={watchedValues[field.name] ?? defaults[field.name] ?? ""} name={registration.name} ref={registration.ref} onBlur={registration.onBlur} onChange={(event) => form.setValue(field.name, event.target.value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })} {...commonProps} /> :
                type === "combobox" ? <Combobox id={id} options={field.options ?? []} type="text" placeholder={resolvePlaceholder(field, watchedValues)} {...commonProps} {...registration} /> :
                type === "currency" ? <CurrencyInput id={id} currency={watchedValues.currency || defaults.currency || "TRY"} min={field.min} step={field.step} placeholder={resolvePlaceholder(field, watchedValues)} {...commonProps} {...registration} /> :
                type === "date" ? <DateInput id={id} {...commonProps} {...registration} /> :
                <input id={id} type={type} step={field.step} min={field.min} placeholder={resolvePlaceholder(field, watchedValues)} className="field" {...commonProps} {...registration} />}
                <HelperText id={`${id}-hint`}>{hint}</HelperText>
              </>
            )}
            <ErrorText id={`${id}-error`}>{error}</ErrorText>
          </FormField>
        );
      })}
    </fieldset>
  );
}

const PREFERENCE_FIELDS = new Set(["paymentMethod"]);

function preferenceKey(schemaKey: SchemaKey) {
  return `buro-finans-preferences-v1:${schemaKey}`;
}

function readFormPreferences(schemaKey: SchemaKey): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(preferenceKey(schemaKey)) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => PREFERENCE_FIELDS.has(key) && typeof value === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeFormPreferences(schemaKey: SchemaKey, values: Record<string, string>) {
  if (typeof window === "undefined") return;
  const safe = Object.fromEntries(Object.entries(values).filter(([key, value]) => PREFERENCE_FIELDS.has(key) && typeof value === "string" && value));
  window.localStorage.setItem(preferenceKey(schemaKey), JSON.stringify(safe));
}

function normalizeSuggestionText(value: string) {
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

function resolveSmartSuggestion(schemaKey: SchemaKey, fields: EntityFormField[], values: Record<string, string>) {
  const selectedClientId = values.clientId || values.relatedClientId;
  const caseField = fields.find((candidate) => candidate.name === "caseFileId" || candidate.name === "relatedCaseFileId");
  const relatedCase = selectedClientId && caseField?.options?.find((option) => option.value && option.parentValue === selectedClientId);
  if (caseField && relatedCase && !values[caseField.name]) {
    return { field: caseField.name, value: relatedCase.value, label: relatedCase.label, reason: "Seçilen müvekkilin en son aktif dosyası olduğu için önerildi." };
  }

  const description = normalizeSuggestionText(values.description ?? values.notes ?? "");
  if (!description) return null;

  const categoryField = fields.find((field) => field.name === "category");
  const categoryRules = schemaKey === "expense"
    ? [
        { terms: ["noter"], value: "NOTARY", label: "Noter" },
        { terms: ["sgk", "vergi", "kdv"], value: "TAX", label: "Vergi / SGK" },
        { terms: ["harc", "uyap", "mahkeme"], value: "COURT_FEE", label: "Harç" },
        { terms: ["taksi", "otopark", "ulasim", "yol"], value: "TRAVEL", label: "Ulaşım" },
        { terms: ["otel", "konaklama"], value: "ACCOMMODATION", label: "Konaklama" },
        { terms: ["kira", "ofis", "elektrik", "internet"], value: "OFFICE", label: "Ofis gideri" },
        { terms: ["personel", "maas"], value: "PERSONNEL", label: "Personel" },
        { terms: ["yemek", "restoran"], value: "MEAL", label: "Yemek" }
      ]
    : schemaKey === "collection"
      ? [
          { terms: ["avukatlik", "vekalet", "hukuki ucret", "hizmet bedeli"], value: "LEGAL_FEE", label: "Avukatlık ücreti" },
          { terms: ["avans"], value: "ADVANCE", label: "Avans" },
          { terms: ["masraf iade", "gider iade"], value: "EXPENSE_REIMBURSEMENT", label: "Masraf iadesi" }
        ]
      : [];
  const matchedCategory = categoryRules.find((rule) => rule.terms.some((term) => description.includes(term)));
  if (categoryField && matchedCategory && values.category !== matchedCategory.value) {
    return { field: "category", value: matchedCategory.value, label: matchedCategory.label, reason: `Açıklamadaki “${matchedCategory.terms.find((term) => description.includes(term))}” ifadesine göre önerildi.` };
  }

  for (const fieldName of ["clientId", "relatedClientId", "caseFileId", "relatedCaseFileId"]) {
    const field = fields.find((candidate) => candidate.name === fieldName);
    const option = field?.options?.find((candidate) => candidate.value && [candidate.label, ...(candidate.searchTerms ?? [])].some((term) => {
      const normalized = normalizeSuggestionText(term);
      return normalized.length > 1 && description.includes(normalized);
    }));
    if (field && option && values[fieldName] !== option.value) {
      return { field: fieldName, value: option.value, label: option.label, reason: `${field.label} adı veya numarası açıklamada geçtiği için önerildi.` };
    }
  }
  return null;
}

function resolveSmartDefaults(
  method: "POST" | "PATCH",
  fields: EntityFormField[],
  values: Record<string, string>,
  defaults: Record<string, string>,
  paymentPreferenceApplied: boolean
) {
  if (method !== "POST") return [];
  const items: string[] = [];
  const hasField = (name: string) => fields.some((field) => field.name === name);
  const fieldValue = (name: string) => values[name] || defaults[name] || "";
  const optionLabel = (name: string, value: string) => fields.find((field) => field.name === name)?.options?.find((option) => option.value === value)?.label;

  if ((hasField("date") && fieldValue("date")) || (hasField("occurredAt") && fieldValue("occurredAt"))) items.push("Tarih: Bugün");
  if (hasField("currency") && fieldValue("currency")) items.push(`Para birimi: ${fieldValue("currency")}`);
  if (hasField("cashAccountId") && fieldValue("cashAccountId")) {
    items.push(`Kasa: ${optionLabel("cashAccountId", fieldValue("cashAccountId")) ?? "Varsayılan hesap"}`);
  }
  if (hasField("paymentMethod") && fieldValue("paymentMethod")) {
    const suffix = paymentPreferenceApplied ? " (son kullanılan)" : "";
    items.push(`Ödeme: ${optionLabel("paymentMethod", fieldValue("paymentMethod")) ?? fieldValue("paymentMethod")}${suffix}`);
  }
  if (hasField("notifyBeforeDays") && fieldValue("notifyBeforeDays") === "3") items.push("Hatırlatma: 3 gün önce");
  return items;
}

function resolveFieldType(field: EntityFormField) {
  if (field.type) return field.type;
  if (isAmountField(field.name)) return "currency";
  return "text";
}

function isAmountField(name: string) {
  return /(^amount$|Amount$|amount|totalValue|unitPrice|manualTotalValue|openingBalance)/i.test(name);
}

function isLikelyRequired(field: EntityFormField) {
  if (field.required !== undefined) return field.required;
  if (field.name === "notes" || field.name === "description" || field.name.endsWith("Id") || field.name === "receiptNumber") {
    return false;
  }
  return true;
}

function resolvePlaceholder(field: EntityFormField, values: Record<string, string>) {
  return (
    field.placeholderWhen?.find((rule) => rule.values.includes(values[rule.field] ?? ""))?.placeholder ??
    field.placeholder
  );
}

function resolveHint(field: EntityFormField, values: Record<string, string>) {
  return field.hintWhen?.find((rule) => rule.values.includes(values[rule.field] ?? ""))?.text ?? field.hint;
}
