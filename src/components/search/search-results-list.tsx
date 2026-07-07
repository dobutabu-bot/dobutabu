import { ArrowRight, Building2, FileText, Landmark, Search, WalletCards } from "lucide-react";
import Link from "next/link";

import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import type { GlobalSearchData, SearchResultGroupId, SearchResultItem } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type SearchResultsListProps = {
  data: GlobalSearchData;
  compact?: boolean;
  onNavigate?: () => void;
};

const groupIcons: Record<SearchResultGroupId, typeof Search> = {
  clients: Building2,
  cases: FileText,
  finance: WalletCards,
  documents: FileText,
  bank: Landmark,
  capital: WalletCards
};

export function SearchResultsList({ data, compact = false, onNavigate }: SearchResultsListProps) {
  if (data.query.length < 2) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm leading-6 text-slate-500">
        En az 2 karakter yazın. Müvekkil, dosya numarası, tutar, tarih, belge adı, belge metni, banka açıklaması veya varlık sembolü arayabilirsiniz.
      </div>
    );
  }

  if (data.total === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm leading-6 text-slate-500">
        “{data.query}” için sonuç bulunamadı.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {data.groups.map((group) => {
        const Icon = groupIcons[group.id];
        return (
          <section key={group.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-slate-950">{group.title}</h2>
              </div>
              <span className="text-xs font-medium text-slate-500">{group.items.length} sonuç</span>
            </div>
            <div className="divide-y divide-slate-100">
              {group.items.map((item) => (
                <SearchResultRow key={`${group.id}-${item.id}-${item.type}`} item={item} compact={compact} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SearchResultRow({
  item,
  compact,
  onNavigate
}: {
  item: SearchResultItem;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const tone = amountTone(item.tone);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn("flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-slate-50", compact ? "min-h-20" : "min-h-24")}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
            {item.type}
          </span>
          <span className="text-xs text-slate-500">{item.meta}</span>
        </div>
        <p className={cn("mt-2 truncate font-semibold text-slate-950", compact ? "text-sm" : "text-base")}>{item.title}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description || "Açıklama yok"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {item.amountLabel ? (
          <PrivacyAmount className={cn("hidden text-sm font-semibold tabular-nums sm:inline", tone)}>{item.amountLabel}</PrivacyAmount>
        ) : null}
        <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
    </Link>
  );
}

function amountTone(tone: SearchResultItem["tone"]) {
  if (tone === "green") return "text-emerald-700";
  if (tone === "rose") return "text-rose-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "blue") return "text-sky-700";
  return "text-slate-700";
}
