import { Search } from "lucide-react";

import { SearchResultsList } from "@/components/search/search-results-list";
import { requireUser } from "@/lib/auth";
import { searchAll } from "@/lib/search/search-data";
import type { GlobalSearchData } from "@/lib/search/types";
import { serializeEntity } from "@/lib/serialization";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const data = await searchAll(user.id, query);
  const safeData = serializeEntity(data) as GlobalSearchData;

  return (
    <div className="space-y-5">
      <section className="surface-dark overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Akıllı Arama</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Tüm Sistemde Ara</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Müvekkil, dosya, tahsilat, gider, belge, banka hareketi, kasa hareketi ve sermaye kayıtlarını tek sorguyla bulun.
            </p>
          </div>
          <div className="digital-glass p-4 lg:min-w-72">
            <p className="text-xs font-medium uppercase text-slate-400">Sonuç</p>
            <p className="mt-2 text-3xl font-semibold text-white tabular-nums">{safeData.total}</p>
            <p className="mt-1 text-sm text-slate-400">eşleşen kayıt</p>
          </div>
        </div>
      </section>

      <section className="surface p-4">
        <form action="/search" className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="label">Arama</span>
            <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-slate-400" aria-hidden />
            <input
              className="field min-h-12 pl-10 text-base"
              name="q"
              defaultValue={query}
              placeholder="Müvekkil adı, dosya no, tutar, tarih, belge adı, banka açıklaması..."
              autoFocus
            />
          </label>
          <button type="submit" className="primary-action min-h-12 self-end justify-center px-5">
            <Search className="h-4 w-4" aria-hidden />
            Ara
          </button>
        </form>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          İlk sürümde veritabanı `contains` araması kullanılır. Büyük veri hacminde full-text search altyapısına geçmek için normalize/index arayüzü hazır tutulmuştur.
          {safeData.provider ? ` Aktif sağlayıcı: ${safeData.provider.label}.` : ""}
        </p>
      </section>

      <SearchResultsList data={safeData} />
    </div>
  );
}
