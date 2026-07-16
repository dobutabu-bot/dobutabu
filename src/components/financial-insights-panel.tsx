import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import Link from "@/components/app-link";

import type { ReportFinancialInsight } from "@/lib/reporting";
import { cn } from "@/lib/utils";

const toneStyles: Record<ReportFinancialInsight["tone"], string> = {
  green: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
  rose: "border-rose-200 bg-rose-50/80 text-rose-950",
  amber: "border-amber-200 bg-amber-50/80 text-amber-950",
  blue: "border-blue-200 bg-blue-50/80 text-blue-950",
  neutral: "border-slate-200 bg-slate-50 text-slate-950"
};

const iconStyles: Record<ReportFinancialInsight["tone"], string> = {
  green: "bg-emerald-600 text-white",
  rose: "bg-rose-600 text-white",
  amber: "bg-amber-500 text-slate-950",
  blue: "bg-blue-600 text-white",
  neutral: "bg-slate-700 text-white"
};

export function FinancialInsightsPanel({
  insights,
  rangeLabel
}: {
  insights: ReportFinancialInsight[];
  rangeLabel: string;
}) {
  return (
    <section id="financial-guidance" className="scroll-mt-24 space-y-4" aria-labelledby="financial-guidance-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Sparkles className="h-4 w-4" aria-hidden />
            Akıllı finans koçu
          </div>
          <h2 id="financial-guidance-title" className="mt-1 text-xl font-semibold text-slate-950">
            Kayıtlarınıza dayalı karar notları
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-500">{rangeLabel} verileri; nakit akışı, gider yapısı, tahsilat ve dosya türü açısından yorumlandı.</p>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => {
          const Icon = insightIcon(insight.category);
          return (
            <article key={insight.id} className={cn("min-w-0 rounded-2xl border p-4 shadow-soft", toneStyles[insight.tone])}>
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconStyles[insight.tone])}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-5">{insight.title}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-80">{insight.message}</p>
                </div>
              </div>
              <p className="mt-4 break-words border-t border-current/10 pt-3 text-xs font-medium tabular-nums opacity-75">Dayanak: {insight.evidence}</p>
              <Link href={insight.actionHref} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                {insight.actionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          );
        })}
      </div>

      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden />
        <p className="leading-6">
          Bu notlar finansal farkındalık ve büro planlaması içindir; yatırım tavsiyesi değildir. Belirli bir yatırım aracı önerilmez. Yatırım kararı vermeden önce likidite ihtiyacınızı, kayıp toleransınızı ve risk profilinizi yetkili bir yatırım kuruluşuyla değerlendirin.
        </p>
      </div>
    </section>
  );
}

function insightIcon(category: ReportFinancialInsight["category"]) {
  if (category === "cash-flow") return BadgeDollarSign;
  if (category === "collection") return Target;
  if (category === "spending") return Lightbulb;
  if (category === "case-mix") return BriefcaseBusiness;
  if (category === "investment-readiness") return PiggyBank;
  return Sparkles;
}
