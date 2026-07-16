import { ArrowRight } from "lucide-react";
import Link from "@/components/app-link";

import { AmountText } from "@/components/amount-text";
import { DashboardSection, TodaySummaryStrip } from "@/components/dashboard-v5";
import { LazyDashboardMetricCards, LazyNetWorthChart } from "@/components/lazy-dashboard-v5-charts";
import { requireUser } from "@/lib/auth";
import { getDashboardV5Data, parseDashboardV5Period, type DashboardV5Data } from "@/lib/dashboard/v5-dashboard-data";
import { serializeEntity } from "@/lib/serialization";
import { cn } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const period = parseDashboardV5Period(params.period);
  const data = serializeEntity(await getDashboardV5Data(user.id, period)) as DashboardV5Data;

  return (
    <div className="min-w-0 space-y-5" data-dashboard-version="v5">
      <section className="finance-terminal-panel min-w-0 overflow-hidden p-4 sm:p-5 lg:p-6">
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.72fr)]">
          <div className="min-w-0">
            <LazyNetWorthChart
              data={data.netWorthTrend}
              currentValue={data.netWorth}
              currentValueLabel={data.netWorthLabel}
              period={data.netWorthPeriod}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
              <p className="text-xs text-slate-400">Sermaye değerlemeleri ve kayıtlı snapshot verileri · {data.referenceDateLabel}</p>
              <Link
                href="/cash"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                Kasa detayları
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <aside className="grid min-w-0 content-start gap-3" aria-label="Finans kontrol kartları">
            {data.controls.map((control) => (
              <div key={control.label} className="digital-row-soft flex min-h-[104px] min-w-0 items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{control.label}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{control.detail}</p>
                </div>
                <AmountText
                  value={control.value}
                  compact
                  showSign
                  size="lg"
                  variant="terminal"
                  className={cn("shrink-0", controlTone(control.tone))}
                />
              </div>
            ))}
            <Link
              href="/capital"
              data-testid="v3-dashboard-tab-capital"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Sermaye detayları
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </aside>
        </div>
      </section>

      <TodaySummaryStrip income={data.today.income} expense={data.today.expense} net={data.today.net} />

      <DashboardSection
        eyebrow="Finans Göstergeleri"
        title="Büronun güncel finans ritmi"
        description="Her kart tek bir ana değer ve ilgili dönemin günlük değişimini gösterir. Detaylar ilgili modülde korunur."
      >
        <LazyDashboardMetricCards
          daily={data.daily}
          monthDaily={data.monthDaily}
          month={data.month}
          openReceivable={data.openReceivable}
          unmatchedBankCount={data.unmatchedBankCount}
        />
      </DashboardSection>
    </div>
  );
}

function controlTone(tone: DashboardV5Data["controls"][number]["tone"]) {
  if (tone === "green") return "text-emerald-300";
  if (tone === "rose") return "text-rose-300";
  if (tone === "amber") return "text-amber-300";
  return "text-slate-200";
}
