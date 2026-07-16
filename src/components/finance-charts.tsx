"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ChartFrame, EmptyChartState, ResponsiveChartContainer, type ChartSize } from "@/components/charts/chart-frame";
import type { ReportFinancialPicturePoint } from "@/lib/reporting";
import { cn, formatMoney } from "@/lib/utils";

export type FinanceTone = "income" | "expense" | "net" | "balance" | "document" | "neutral";

export type FinanceFlowPoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net?: number;
};

export type FinanceSeriesPoint = {
  label: string;
  value: number;
};

export type FinanceLineSeries = {
  dataKey: string;
  name: string;
  tone: FinanceTone;
  strokeWidth?: number;
};

export const financeChartTheme = {
  colors: {
    income: "#047857",
    expense: "#be123c",
    net: "#0f172a",
    balance: "#b45309",
    document: "#2563eb",
    neutral: "#64748b",
    muted: "#94a3b8",
    grid: "#e2e8f0"
  },
  palette: ["#047857", "#2563eb", "#b45309", "#be123c", "#0f172a", "#64748b", "#0891b2", "#7c3aed"]
};

type ChartValueFormatter = (value: unknown) => string;

export { EmptyChartState } from "@/components/charts/chart-frame";

export function FinanceChartPanel({
  title,
  description,
  badge = "ANALİZ",
  children,
  className
}: {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface min-w-0 overflow-hidden p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white shadow-soft">{badge}</span>
      </div>
      {children}
    </div>
  );
}

export function MiniLineChart({
  data,
  series,
  size = "md",
  showLegend = false,
  className
}: {
  data: Record<string, string | number>[];
  series: FinanceLineSeries[];
  size?: ChartSize;
  showLegend?: boolean;
  className?: string;
}) {
  if (!hasLineData(data, series)) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={financeChartTheme.colors.grid} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compactMoney} />
          <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} />
          {showLegend ? <Legend /> : null}
          {series.map((item) => (
            <Line
              key={item.dataKey}
              type="monotone"
              dataKey={item.dataKey}
              name={item.name}
              stroke={toneColor(item.tone)}
              strokeWidth={item.strokeWidth ?? 2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
    </ResponsiveChartContainer>
  );
}

export function IncomeExpenseChart({
  data,
  size = "md",
  showLegend = false,
  showNet = false,
  className
}: {
  data: FinanceFlowPoint[];
  size?: ChartSize;
  showLegend?: boolean;
  showNet?: boolean;
  className?: string;
}) {
  if (!hasFlowData(data)) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
        <RechartsBarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={financeChartTheme.colors.grid} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={compactMoney} />
          <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} />
          {showLegend ? <Legend /> : null}
          <Bar dataKey="tahsilat" name="Tahsilat" fill={financeChartTheme.colors.income} radius={[6, 6, 0, 0]} />
          <Bar dataKey="gider" name="Gider" fill={financeChartTheme.colors.muted} radius={[6, 6, 0, 0]} />
          {showNet ? <Bar dataKey="net" name="Net" fill={financeChartTheme.colors.net} radius={[6, 6, 0, 0]} /> : null}
        </RechartsBarChart>
    </ResponsiveChartContainer>
  );
}

export function CashFlowChart({
  data,
  size = "md",
  className
}: {
  data: FinanceFlowPoint[];
  size?: ChartSize;
  className?: string;
}) {
  if (!hasFlowData(data)) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="cashFlowNetFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={financeChartTheme.colors.net} stopOpacity={0.24} />
              <stop offset="95%" stopColor={financeChartTheme.colors.net} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={financeChartTheme.colors.grid} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={10} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compactMoney} />
          <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="net" name="Net" stroke={financeChartTheme.colors.net} fill="url(#cashFlowNetFill)" strokeWidth={3} />
          <Line type="monotone" dataKey="tahsilat" name="Tahsilat" stroke={financeChartTheme.colors.income} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="gider" name="Gider" stroke={financeChartTheme.colors.expense} strokeWidth={2} dot={false} />
        </AreaChart>
    </ResponsiveChartContainer>
  );
}

export function CategoryPieChart({
  data,
  size = "md",
  showLegend = false,
  className
}: {
  data: FinanceSeriesPoint[];
  size?: ChartSize;
  showLegend?: boolean;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={size === "lg" ? 58 : 54} outerRadius={size === "lg" ? 90 : 82} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={financeChartTheme.palette[index % financeChartTheme.palette.length]} />
            ))}
          </Pie>
          <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} />
          {showLegend ? <Legend layout="vertical" align="right" verticalAlign="middle" /> : null}
        </PieChart>
    </ResponsiveChartContainer>
  );
}

export function HorizontalBarChart({
  data,
  dataKeyName,
  tone = "balance",
  size = "md",
  yAxisWidth = 124,
  valueFormatter = compactMoney,
  tooltipFormatter = moneyTooltip,
  className
}: {
  data: FinanceSeriesPoint[];
  dataKeyName: string;
  tone?: FinanceTone;
  size?: ChartSize;
  yAxisWidth?: number;
  valueFormatter?: ChartValueFormatter;
  tooltipFormatter?: ChartValueFormatter;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
        <RechartsBarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={financeChartTheme.colors.grid} horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={valueFormatter} />
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} fontSize={12} width={yAxisWidth} />
          <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
          <Bar dataKey="value" name={dataKeyName} fill={toneColor(tone)} radius={[0, 6, 6, 0]} />
        </RechartsBarChart>
    </ResponsiveChartContainer>
  );
}

export function FinancialPictureChart({
  data,
  size = "lg",
  className
}: {
  data: ReportFinancialPicturePoint[];
  size?: ChartSize;
  className?: string;
}) {
  if (!data.some((point) => point.value !== 0)) {
    return (
      <ChartFrame size={size} className={className}>
        <EmptyChartState title="Finans hareketi bulunamadı" description="Seçilen dönemde grafik oluşturacak finansal hareket yok." />
      </ChartFrame>
    );
  }

  return (
    <ResponsiveChartContainer size={size} className={className}>
      <RechartsBarChart data={data} layout="vertical" margin={{ left: 0, right: 14, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={financeChartTheme.colors.grid} horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactMoney} />
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} fontSize={12} width={104} />
        <ReferenceLine x={0} stroke={financeChartTheme.colors.muted} strokeWidth={1} />
        <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Tutar" radius={[6, 6, 6, 6]}>
          {data.map((point) => (
            <Cell key={point.label} fill={financialPictureColor(point.tone)} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveChartContainer>
  );
}

function hasFlowData(data: FinanceFlowPoint[]) {
  return data.some((point) => point.tahsilat !== 0 || point.gider !== 0 || (point.net ?? 0) !== 0);
}

function hasLineData(data: Record<string, string | number>[], series: FinanceLineSeries[]) {
  return data.some((point) => series.some((item) => Number(point[item.dataKey] ?? 0) !== 0));
}

function toneColor(tone: FinanceTone) {
  return financeChartTheme.colors[tone];
}

function financialPictureColor(tone: ReportFinancialPicturePoint["tone"]) {
  if (tone === "positive") return financeChartTheme.colors.income;
  if (tone === "negative") return financeChartTheme.colors.expense;
  if (tone === "attention") return financeChartTheme.colors.balance;
  return financeChartTheme.colors.neutral;
}

function moneyTooltip(value: unknown) {
  return formatMoney(Number(value));
}

const tooltipStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.14)"
};

function compactMoney(value: unknown) {
  const amount = Number(value);

  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  }

  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} bin`;
  }

  return String(amount);
}
