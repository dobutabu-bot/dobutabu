"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { cn } from "@/lib/utils";
import { emitAppDataMutation } from "@/lib/client-sync";
import { schemaMap, type SchemaKey } from "@/lib/validations";
import { showToast } from "@/components/toast";

type Option = {
  label: string;
  value: string;
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
  type?: "text" | "email" | "tel" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  placeholderWhen?: FieldDynamicPlaceholderRule[];
  hint?: string;
  hintWhen?: FieldDynamicTextRule[];
  options?: Option[];
  step?: string;
  min?: string;
  className?: string;
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
  onSuccess
}: EntityFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const schema = schemaMap[schemaKey];
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema as never) as unknown as Resolver<Record<string, string>>,
    defaultValues: defaults
  });
  const watchedValues = form.watch();
  const submitting = form.formState.isSubmitting || locked;

  async function onSubmit(values: Record<string, string>) {
    if (locked) {
      return;
    }

    setMessage(null);
    setLocked(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(payload?.message || "İşlem tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.");
        return;
      }

      const nextSuccessMessage = typeof successMessage === "function" ? successMessage(values) : successMessage;

      if (resetOnSuccess) {
        form.reset(defaults);
      }
      emitAppDataMutation(`${schemaKey}-${method.toLowerCase()}`);
      router.refresh();
      setMessage(nextSuccessMessage);
      showToast(nextSuccessMessage);
      onSuccess?.();
    } catch {
      setMessage("Bağlantı sırasında sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLocked(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="surface p-4" aria-busy={submitting}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-950 sm:text-sm">{title}</h2>
        <button
          type="submit"
          disabled={submitting}
          className="primary-action w-full text-base sm:w-auto sm:text-sm"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {submitting ? "Kaydediliyor" : submitLabel}
        </button>
      </div>

      <fieldset disabled={submitting} className="grid gap-3 disabled:opacity-75 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => {
          if (field.showWhen && !field.showWhen.values.includes(watchedValues[field.showWhen.field] ?? "")) {
            return null;
          }

          const error = form.formState.errors[field.name]?.message as string | undefined;
          const id = `${schemaKey}-${field.name}`;
          const placeholder = resolvePlaceholder(field, watchedValues);
          const hint = resolveHint(field, watchedValues);
          const highlighted =
            field.highlightWhen && field.highlightWhen.values.includes(watchedValues[field.highlightWhen.field] ?? "");

          return (
            <label
              key={field.name}
              htmlFor={id}
              className={cn(
                "space-y-1",
                highlighted
                  ? field.highlightWhen?.className ?? "rounded-xl border border-amber-200 bg-amber-50/80 p-2"
                  : undefined,
                field.className
              )}
            >
              <span className="label">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  rows={3}
                  placeholder={placeholder}
                  className="field resize-none"
                  {...form.register(field.name)}
                />
              ) : field.type === "select" ? (
                <select id={id} className="field" {...form.register(field.name)}>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type={field.type ?? "text"}
                  step={field.step}
                  min={field.min}
                  placeholder={placeholder}
                  className="field"
                  {...form.register(field.name)}
                />
              )}
              {hint ? <span className="block text-xs leading-5 text-slate-500">{hint}</span> : null}
              {error ? <span className="block text-xs text-slate-700">{error}</span> : null}
            </label>
          );
        })}
      </fieldset>

      {message ? (
        <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
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
