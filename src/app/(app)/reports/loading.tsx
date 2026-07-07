import { LoadingSkeleton } from "@/components/loading-skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <p className="text-xs font-medium uppercase text-slate-400">Raporlar V2</p>
        <LoadingSkeleton className="mt-3 h-10 max-w-md bg-white/20" />
        <LoadingSkeleton className="mt-4 h-4 max-w-2xl bg-white/15" />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="premium-card p-4">
            <LoadingSkeleton className="w-28" />
            <LoadingSkeleton className="mt-5 h-8 w-40" />
            <LoadingSkeleton className="mt-4 w-32" />
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface p-4">
            <LoadingSkeleton className="w-40" />
            <LoadingSkeleton className="mt-3 w-64" />
            <LoadingSkeleton className="mt-6 h-64 rounded-3xl" />
          </div>
        ))}
      </section>
    </div>
  );
}
