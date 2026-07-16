"use client";

import Link from "@/components/app-link";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  HandCoins,
  Landmark,
  TrendingDown,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DashboardMetricDrilldownItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  value: string;
  tone: "green" | "rose" | "amber" | "neutral";
  href: string;
};

export type DashboardMetricDrilldownCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  icon: "activity" | "bell" | "calendar" | "circleDollar" | "handCoins" | "landmark" | "trendingDown" | "walletCards";
  tone: "neutral" | "green" | "rose" | "amber";
  drilldownLabel?: string;
  emptyLabel?: string;
  items?: DashboardMetricDrilldownItem[];
};

type DashboardMetricDrilldownProps = {
  cards: DashboardMetricDrilldownCard[];
};

const icons: Record<DashboardMetricDrilldownCard["icon"], LucideIcon> = {
  activity: Activity,
  bell: BellRing,
  calendar: CalendarClock,
  circleDollar: CircleDollarSign,
  handCoins: HandCoins,
  landmark: Landmark,
  trendingDown: TrendingDown,
  walletCards: WalletCards
};

const tones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200"
};

const valueTones = {
  neutral: "text-slate-950",
  green: "text-emerald-700",
  rose: "text-rose-700",
  amber: "text-amber-800"
};

const itemTones = {
  neutral: "border-slate-500/35 bg-slate-400/45 shadow-[0_0_12px_rgba(148,163,184,0.25)]",
  green: "border-emerald-300/70 bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.65)]",
  rose: "border-rose-300/70 bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.62)]",
  amber: "border-amber-300/70 bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]"
};

const itemValueTones = {
  neutral: "text-slate-100",
  green: "text-emerald-300",
  rose: "text-rose-300",
  amber: "text-amber-300"
};

export function DashboardMetricDrilldown({ cards }: DashboardMetricDrilldownProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.icon];
        const hasDrilldown = Array.isArray(card.items);
        const isOpen = openCardId === card.id;
        const cardHeader = (
          <>
            <span className="min-w-0">
              <span className="label block">{card.title}</span>
              <span className={cn("mt-2 block truncate text-2xl font-semibold tabular-nums sm:text-3xl", valueTones[card.tone])}>
                {card.value}
              </span>
              <span className="mt-3 block truncate text-xs text-slate-500">{card.detail}</span>
              {hasDrilldown ? (
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {isOpen ? "Kapat" : "Kayıtları aç"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition duration-200", isOpen && "rotate-180")} aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-3">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl ring-1 shadow-[0_12px_24px_rgba(15,23,42,0.07)]", tones[card.tone])}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </span>
          </>
        );

        return (
          <article key={card.id} className={cn("premium-card p-0", hasDrilldown && "premium-card-hover", isOpen && "ring-1 ring-slate-950/10")}>
            {hasDrilldown ? (
              <button
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-start justify-between gap-3 rounded-3xl p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10",
                  isOpen && "bg-white/70"
                )}
                aria-expanded={isOpen}
                onClick={() => setOpenCardId(isOpen ? null : card.id)}
              >
                {cardHeader}
              </button>
            ) : (
              <div className="flex w-full items-start justify-between gap-3 rounded-3xl p-4 text-left">
                {cardHeader}
              </div>
            )}

            {hasDrilldown ? (
              <div
                className={cn(
                  "grid px-3 transition-all duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr] opacity-100 pb-3" : "grid-rows-[0fr] opacity-0 pb-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="digital-drilldown-panel p-2">
                    <div className="flex items-center justify-between gap-3 px-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {card.drilldownLabel ?? "Son 5 kayıt"}
                        </p>
                      </div>
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.85)]" />
                    </div>

                    {card.items && card.items.length > 0 ? (
                      <div className="metric-drilldown-scroll-frame scroll-y-stable divide-y divide-white/10 pr-1">
                        {card.items.slice(0, 10).map((item) => (
                          <Link
                            key={item.id}
                            href={item.href}
                            className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl px-2 py-2 transition duration-200 hover:bg-white/[0.065] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/15"
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 shrink-0 rounded-full border", itemTones[item.tone])} />
                                <span className="truncate text-sm font-semibold text-white">{item.title}</span>
                              </span>
                              <span className="mt-1 block truncate text-xs text-slate-400">{item.description}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className={cn("block text-sm font-semibold tabular-nums", itemValueTones[item.tone])}>
                                {item.value}
                              </span>
                              <span className="mt-1 inline-flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                {item.meta}
                                <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" aria-hidden />
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="digital-row-soft px-3 py-4 text-sm text-slate-400">
                        {card.emptyLabel ?? "Bu başlıkta kayıt yok."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
