import { AlertTriangle, type LucideIcon } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
};

export function ErrorState({
  title = "Bir sorun oluştu",
  description = "İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.",
  icon: Icon = AlertTriangle
}: ErrorStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-rose-100 bg-rose-50/70 px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-700 text-white shadow-[0_16px_34px_rgba(190,18,60,0.18)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-rose-950">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-rose-800">{description}</p>
    </div>
  );
}
