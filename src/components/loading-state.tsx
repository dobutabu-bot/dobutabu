import { Loader2 } from "lucide-react";

import { LoadingSkeleton } from "@/components/loading-skeleton";

type LoadingStateProps = {
  title?: string;
};

export function LoadingState({ title = "Yükleniyor" }: LoadingStateProps) {
  return (
    <div className="space-y-4">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Finans paneli</p>
            <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface h-32 p-4">
            <LoadingSkeleton className="w-24" />
            <LoadingSkeleton className="mt-5 h-7 w-36" />
            <LoadingSkeleton className="mt-5 w-28 bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
