import { FileText, type LucideIcon } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

export function EmptyState({
  title,
  description = "Kayıt oluştuğunda bu alanda listelenecek.",
  icon: Icon = FileText
}: EmptyStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/55 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-950">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
