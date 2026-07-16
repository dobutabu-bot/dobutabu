"use client";

import Link from "@/components/app-link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { AmountText } from "@/components/amount-text";
import { PrivacyAmount } from "@/components/privacy/privacy-mask";
import type { DashboardV5DailyPoint, DashboardV5Period, DashboardV5Point } from "@/lib/dashboard/v5-dashboard-data";
import { cn, formatMoney } from "@/lib/utils";

const periodOptions: Array<{ value: DashboardV5Period; label: string }> = [
  { value: "7d", label: "Son 7 Gün" },
  { value: "30d", label: "Son 30 Gün" },
  { value: "3m", label: "Son 3 Ay" },
  { value: "6m", label: "Son 6 Ay" },
  { value: "year", label: "Bu Yıl" }
];

export function NetWorthChart({
  data,
  currentValue,
  currentValueLabel,
  period
}: {
  data: DashboardV5Point[];
  currentValue: number;
  currentValueLabel: string;
  period: DashboardV5Period;
}) {
  const firstValue = data[0]?.value ?? currentValue;
  const change = currentValue - firstValue;
  const positive = change >= 0;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Net Sermaye</p>
          <PrivacyAmount as="p" className="mt-2 max-w-full truncate text-[clamp(1.8rem,3.2vw,3.4rem)] font-semibold leading-none tabular-nums text-white" title={currentValueLabel}>
            {currentValueLabel}
          </PrivacyAmount>
          <p className={cn("mt-3 text-sm font-semibold tabular-nums", positive ? "text-emerald-300" : "text-rose-300")}>
            {positive ? "+" : "-"}{formatMoney(Math.abs(change))} dönem değişimi
          </p>
        </div>
        <div className="scroll-x-stable flex max-w-full gap-1.5 pb-1 sm:flex-wrap" aria-label="Net sermaye dönemi">
          {periodOptions.map((option) => (
            <Link
              key={option.value}
              href={option.value === "30d" ? "/dashboard" : `/dashboard?period=${option.value}`}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
                period === option.value
                  ? "border-emerald-300/40 bg-emerald-300 text-slate-950"
                  : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]"
              )}
              aria-current={period === option.value ? "page" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 h-[260px] min-w-0 sm:h-[310px]" data-testid="v5-net-worth-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="v5NetWorthFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="4%" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity={0.38} />
                <stop offset="96%" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={compactAxis} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={darkTooltipStyle} labelStyle={{ color: "#cbd5e1" }} />
            <Area
              type="monotone"
              dataKey="value"
              name="Net sermaye"
              stroke={positive ? "#34d399" : "#fb7185"}
              strokeWidth={3}
              fill="url(#v5NetWorthFill)"
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardMetricCards({
  daily,
  monthDaily,
  month,
  openReceivable,
  unmatchedBankCount
}: {
  daily: DashboardV5DailyPoint[];
  monthDaily: DashboardV5DailyPoint[];
  month: { income: number; expense: number; net: number };
  openReceivable: number;
  unmatchedBankCount: number;
}) {
  const cards = [
    { id: "income", title: "Bu Ay Tahsilat", value: month.income, href: "/collections", tone: "green" as const, detail: "Bu ay günlük tahsilat", chart: "bar" as const },
    { id: "expense", title: "Bu Ay Gider", value: -month.expense, href: "/expenses", tone: "rose" as const, detail: "Bu ay günlük gider", chart: "bar" as const },
    { id: "net", title: "Bu Ay Net", value: month.net, href: "/reports", tone: month.net >= 0 ? ("green" as const) : ("rose" as const), detail: "Günlük tahsilat - gider", chart: "net" as const },
    { id: "receivable", title: "Açık Alacak", value: openReceivable, href: "/collections", tone: "green" as const, detail: "Son 30 günlük değişim", chart: "line" as const },
    { id: "unmatched", title: "Eşleşmemiş Banka", value: unmatchedBankCount, href: "/reconciliation", tone: "amber" as const, detail: "Mutabakat bekleyen kayıt", chart: "count" as const }
  ];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5" data-testid="v5-monthly-metric-cards">
      {cards.map((card) => (
        <article key={card.id} data-testid={`v5-card-${card.id}`} className="premium-card flex min-h-[230px] min-w-0 flex-col overflow-hidden p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.title}</p>
              {card.id === "unmatched" ? (
                <p className="mt-3 truncate text-[clamp(1.55rem,2.6vw,2.35rem)] font-semibold leading-none tabular-nums text-amber-700" title={`${unmatchedBankCount} kayıt`}>
                  {unmatchedBankCount.toLocaleString("tr-TR")} kayıt
                </p>
              ) : (
                <AmountText value={card.value} compact showSign size="xl" variant="strong" className="mt-3 block" />
              )}
            </div>
            <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", toneDot(card.tone))} aria-hidden />
          </div>
          <div className="pointer-events-none mt-auto h-[94px] min-w-0 pt-3" aria-hidden>
            <MiniMetricChart daily={card.id === "income" || card.id === "expense" || card.id === "net" ? monthDaily : daily} type={card.chart} tone={card.tone} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="truncate text-xs text-slate-500" title={card.detail}>{card.detail}</p>
            <Link href={card.href} className="relative z-10 inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
              Detay
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniMetricChart({ daily, type, tone }: { daily: DashboardV5DailyPoint[]; type: "bar" | "net" | "line" | "count"; tone: "green" | "rose" | "amber" }) {
  if (type === "line" || type === "count") {
    const dataKey = type === "line" ? "receivable" : "unmatched";
    const color = type === "line" ? "#059669" : "#d97706";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={daily} margin={{ top: 8, right: 2, left: 2, bottom: 2 }}>
          <Tooltip formatter={(value) => type === "line" ? formatMoney(Number(value)) : `${Number(value).toLocaleString("tr-TR")} kayıt`} contentStyle={lightTooltipStyle} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "net") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={daily} margin={{ top: 6, right: 1, left: 1, bottom: 1 }}>
          <ReferenceLine y={0} stroke="#94a3b8" strokeOpacity={0.55} />
          <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={lightTooltipStyle} />
          <Bar dataKey="net" radius={[2, 2, 2, 2]}>
            {daily.map((point) => <Cell key={point.date} fill={point.net >= 0 ? "#059669" : "#e11d48"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const dataKey = tone === "green" ? "income" : "expense";
  const color = tone === "green" ? "#059669" : "#e11d48";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={daily} margin={{ top: 6, right: 1, left: 1, bottom: 1 }}>
        <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={lightTooltipStyle} />
        <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function compactAxis(value: unknown) {
  const amount = Number(value);
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} B`;
  return amount.toLocaleString("tr-TR");
}

function toneDot(tone: "green" | "rose" | "amber") {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "rose") return "bg-rose-500";
  return "bg-amber-500";
}

const darkTooltipStyle = { borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(8,18,34,0.96)", color: "#fff" };
const lightTooltipStyle = { borderRadius: 12, border: "1px solid rgba(148,163,184,0.24)", background: "rgba(255,255,255,0.96)", fontSize: 12 };
