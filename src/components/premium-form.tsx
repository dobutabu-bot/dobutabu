import { Loader2, Save, X } from "lucide-react";
import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

import { cn } from "@/lib/utils";

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
  highlightClassName?: string;
};

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

type TextProps = {
  children?: ReactNode;
  id?: string;
  className?: string;
};

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
};

type ComboboxProps = InputHTMLAttributes<HTMLInputElement> & {
  options?: SelectOption[];
  listId?: string;
};

type CurrencyInputProps = InputHTMLAttributes<HTMLInputElement> & {
  currency?: string;
};

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  description?: string;
};

type SubmitBarProps = {
  submitting?: boolean;
  submitLabel: string;
  submittingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  message?: ReactNode;
  error?: ReactNode;
};

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("surface p-4", className)}>
      {title || description ? (
        <div className="mb-4">
          {title ? <h2 className="text-base font-semibold text-slate-950 sm:text-sm">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormField({ children, className, highlighted, highlightClassName }: FormFieldProps) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-1.5",
        highlighted ? highlightClassName ?? "rounded-2xl border border-amber-200 bg-amber-50/80 p-3" : undefined,
        className
      )}
    >
      {children}
    </div>
  );
}

export function Label({ children, required, className, ...props }: LabelProps) {
  return (
    <label className={cn("label inline-flex items-center gap-1", className)} {...props}>
      <span>{children}</span>
      {required ? (
        <span className="text-rose-600" aria-label="zorunlu alan">
          *
        </span>
      ) : null}
    </label>
  );
}

export function HelperText({ children, className, ...props }: TextProps) {
  if (!children) return null;
  return (
    <span className={cn("block text-xs leading-5 text-slate-500", className)} {...props}>
      {children}
    </span>
  );
}

export function ErrorText({ children, className, ...props }: TextProps) {
  if (!children) return null;
  return (
    <span className={cn("block text-xs font-medium leading-5 text-rose-700", className)} role="alert" {...props}>
      {children}
    </span>
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, className, ...props }, ref) {
  return (
    <select ref={ref} className={cn("field", className)} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export function Combobox({ options = [], listId, className, ...props }: ComboboxProps) {
  const resolvedListId = listId ?? (typeof props.id === "string" ? `${props.id}-options` : undefined);

  return (
    <>
      <input className={cn("field", className)} list={resolvedListId} {...props} />
      {resolvedListId && options.length > 0 ? (
        <datalist id={resolvedListId}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </datalist>
      ) : null}
    </>
  );
}

export function CurrencyInput({ currency = "TRY", className, ...props }: CurrencyInputProps) {
  return (
    <div className="relative">
      <input
        className={cn("field pr-16 tabular-finance", className)}
        type="number"
        inputMode="decimal"
        min={props.min ?? "0"}
        step={props.step ?? "0.01"}
        placeholder={props.placeholder ?? "0,00"}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
        {currency}
      </span>
    </div>
  );
}

export function DateInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} type="date" {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field min-h-28 resize-y", className)} {...props} />;
}

export function Switch({ label, description, className, ...props }: SwitchProps) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3", className)}>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-950 focus:ring-4 focus:ring-slate-900/10"
        {...props}
      />
      <span className="min-w-0">
        {label ? <span className="block text-sm font-semibold text-slate-900">{label}</span> : null}
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

export function SubmitBar({
  submitting,
  submitLabel,
  submittingLabel = "Kaydediliyor",
  cancelLabel = "Vazgeç",
  onCancel,
  message,
  error
}: SubmitBarProps) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 mt-5 rounded-3xl border border-white/70 bg-white/90 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {error ? <p className="text-sm font-medium text-rose-700" role="alert">{error}</p> : null}
          {!error && message ? <p className="text-sm text-slate-600" role="status" aria-live="polite">{message}</p> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onCancel ? (
            <button type="button" className="secondary-action justify-center" disabled={submitting} onClick={onCancel}>
              <X className="h-4 w-4" aria-hidden />
              {cancelLabel}
            </button>
          ) : null}
          <button type="submit" disabled={submitting} className="primary-action min-h-12 justify-center text-base sm:text-sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {submitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
