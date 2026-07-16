import { Prisma } from "@prisma/client";

import {
  expenseCategoryLabels,
  incomeCategoryLabels,
  receiptStatusLabels,
  reminderPriorityLabels,
  reminderTypeLabels
} from "@/lib/labels";
import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import {
  getAccountBasedReport,
  getCashFlowReport
} from "@/lib/cash/cash-report-data";
import { prisma } from "@/lib/prisma";
import { buildV3ReportsData, type V3Metric, type V3ReportTable } from "@/lib/reports/v3-report-data";
import {
  getCaseFileFinancialSummary,
  getExpenseByCategory,
  getIncomeByCategory,
  getIncomeExpenseTrend,
  getReportSummary,
  getTopClientsByBalance,
  getTopClientsByIncome,
  getUpcomingExpenseReminders as getUpcomingExpenseReminderRows
} from "@/lib/reports/report-data";
import {
  addDays,
  addMonths,
  dateInputValue,
  endOfDateInput,
  formatDate,
  formatMoney,
  formatSignedMoney,
  parseDateInput,
  startOfDay,
  startOfMonth,
  startOfYear,
  toNumber
} from "@/lib/utils";

export const reportTypeLabels = {
  daily: "Günlük finans raporu",
  monthly: "Aylık gelir-gider raporu",
  client: "Müvekkil bazlı cari rapor",
  case: "Dosya bazlı finans raporu",
  reimbursable: "Müvekkile yansıtılabilir masraflar raporu",
  unpaid: "Ödenmemiş makbuz/fatura raporu",
  yearly: "Yıllık özet rapor",
  documents: "Belge raporu",
  bankStatements: "Banka ekstresi analiz raporu",
  reconciliation: "Mutabakat raporu",
  capital: "Sermaye raporu"
};

export const reportRangeLabels = {
  today: "Bugün",
  week: "Bu hafta",
  month: "Bu ay",
  last3: "Son 3 ay",
  last6: "Son 6 ay",
  year: "Bu yıl",
  custom: "Özel tarih aralığı"
};

export type ReportType = keyof typeof reportTypeLabels;
export type ReportRange = keyof typeof reportRangeLabels;

export type ReportFilters = {
  type?: string;
  range?: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
  caseFileId?: string;
};

export type ReportSummary = {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "rose" | "amber";
};

export type FinancialReport = {
  type: ReportType;
  title: string;
  summaries: ReportSummary[];
  headers: string[];
  rows: Record<string, string>[];
  chartData?: ReportChartPoint[];
  empty: string;
};

export type ReportChartPoint = {
  label: string;
  tahsilat?: number;
  gider?: number;
  net?: number;
  belge?: number;
  masraf?: number;
};

export type ReportKpi = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "green" | "rose" | "amber";
};

export type ReportSeriesPoint = {
  label: string;
  value: number;
};

export type ReportFinancialPicturePoint = {
  label: string;
  value: number;
  valueLabel: string;
  tone: "positive" | "negative" | "attention" | "neutral";
};

export type ReportFinancialInsight = {
  id: string;
  category: "cash-flow" | "collection" | "spending" | "case-mix" | "investment-readiness" | "motivation";
  title: string;
  message: string;
  evidence: string;
  tone: "green" | "rose" | "amber" | "blue" | "neutral";
  actionLabel: string;
  actionHref: string;
};

export type ReportMonthlyTrendPoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net: number;
};

export type ReportCaseFinancePoint = {
  label: string;
  tahsilat: number;
  gider: number;
  net: number;
};

export type ReportAnalysisRow = Record<string, string>;

export type ReportAnalytics = {
  rangeLabel: string;
  kpis: ReportKpi[];
  financialPicture: ReportFinancialPicturePoint[];
  insights: ReportFinancialInsight[];
  charts: {
    cashDailyFlow: ReportMonthlyTrendPoint[];
    monthlyTrend: ReportMonthlyTrendPoint[];
    cashAccountDistribution: ReportSeriesPoint[];
    incomeCategories: ReportSeriesPoint[];
    expenseCategories: ReportSeriesPoint[];
    topClientsByIncome: ReportSeriesPoint[];
    clientOpenBalances: ReportSeriesPoint[];
    caseFinanceSummary: ReportCaseFinancePoint[];
    topExpenseItems: ReportSeriesPoint[];
    overdueReminderTimeline: ReportSeriesPoint[];
    netTrend: ReportSeriesPoint[];
  };
  tables: {
    cashAccounts: ReportAnalysisRow[];
    cashTransfers: ReportAnalysisRow[];
    recentIncomes: ReportAnalysisRow[];
    recentExpenses: ReportAnalysisRow[];
    topExpenses: ReportAnalysisRow[];
    topIncomeClients: ReportAnalysisRow[];
    upcomingExpenseReminders: ReportAnalysisRow[];
    clientProfitability: ReportAnalysisRow[];
    caseFinancials: ReportAnalysisRow[];
    overdueReminders: ReportAnalysisRow[];
  };
};

type ReportContext = {
  incomes: Awaited<ReturnType<typeof getReportData>>["incomes"];
  expenses: Awaited<ReturnType<typeof getReportData>>["expenses"];
  documents: Awaited<ReturnType<typeof getReportData>>["documents"];
  cases: Awaited<ReturnType<typeof getReportData>>["cases"];
  clients: Awaited<ReturnType<typeof getReportData>>["clients"];
};

const reportTypes = Object.keys(reportTypeLabels) as ReportType[];
const reportRanges = Object.keys(reportRangeLabels) as ReportRange[];

export function normalizeReportFilters(filters: ReportFilters) {
  const type = isReportType(filters.type) ? filters.type : "daily";
  const range = isReportRange(filters.range) ? filters.range : "month";
  const rangeDates = range === "custom" ? null : dateRangeFor(range);

  return {
    type,
    range,
    startDate: rangeDates?.startDate ?? cleanDate(filters.startDate),
    endDate: rangeDates?.endDate ?? cleanDate(filters.endDate),
    clientId: clean(filters.clientId),
    caseFileId: clean(filters.caseFileId)
  };
}

export function reportFiltersFromSearchParams(searchParams: URLSearchParams): ReportFilters {
  return {
    type: searchParams.get("type") ?? "",
    range: searchParams.get("range") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    clientId: searchParams.get("clientId") ?? "",
    caseFileId: searchParams.get("caseFileId") ?? ""
  };
}

export function appendReportFilters(params: URLSearchParams, filters: ReportFilters) {
  const normalized = normalizeReportFilters(filters);

  for (const [key, value] of Object.entries(normalized)) {
    if (value) {
      params.set(key, value);
    }
  }
}

export async function buildFinancialReport(userId: string, filters: ReportFilters): Promise<FinancialReport> {
  const normalized = normalizeReportFilters(filters);
  if (isV3ReportType(normalized.type)) {
    return buildV3FinancialReport(userId, normalized);
  }

  const context = await getReportData(userId, normalized);

  if (normalized.type === "monthly") return buildMonthlyReport(context);
  if (normalized.type === "client") return buildClientReport(context);
  if (normalized.type === "case") return buildCaseReport(context);
  if (normalized.type === "reimbursable") return buildReimbursableReport(context);
  if (normalized.type === "unpaid") return buildUnpaidReport(context);
  if (normalized.type === "yearly") return buildYearlyReport(context);

  return buildDailyReport(context);
}

async function buildV3FinancialReport(userId: string, filters: ReturnType<typeof normalizeReportFilters>): Promise<FinancialReport> {
  const v3Reports = await buildV3ReportsData(userId, filters);

  if (filters.type === "bankStatements") {
    return v3FinancialReport({
      type: filters.type,
      title: "Banka Ekstresi Analiz Raporu",
      metrics: v3Reports.bankStatementReport.metrics,
      table: v3Reports.bankStatementReport.tables[2],
      empty: "Banka ekstresi analiz verisi yok"
    });
  }

  if (filters.type === "reconciliation") {
    return v3FinancialReport({
      type: filters.type,
      title: "Mutabakat Raporu",
      metrics: v3Reports.reconciliationReport.metrics,
      table: v3Reports.reconciliationReport.tables[0],
      empty: "Mutabakat bekleyen hareket yok"
    });
  }

  if (filters.type === "capital") {
    return v3FinancialReport({
      type: filters.type,
      title: "Sermaye Raporu",
      metrics: v3Reports.capitalReport.metrics,
      table: v3Reports.capitalReport.tables[0],
      empty: "Sermaye raporu verisi yok"
    });
  }

  return v3FinancialReport({
    type: filters.type,
    title: "Belge Raporu",
    metrics: v3Reports.documentReport.metrics,
    table: v3Reports.documentReport.tables[0],
    empty: "Belge raporu verisi yok"
  });
}

function v3FinancialReport({
  type,
  title,
  metrics,
  table,
  empty
}: {
  type: ReportType;
  title: string;
  metrics: V3Metric[];
  table?: V3ReportTable;
  empty: string;
}): FinancialReport {
  return {
    type,
    title,
    summaries: metrics.map((item) => ({
      label: item.label,
      value: item.value,
      tone: item.tone === "blue" ? "neutral" : item.tone
    })),
    headers: table?.headers ?? ["Alan", "Değer"],
    rows: table?.rows ?? [],
    empty
  };
}

function isV3ReportType(type: ReportType) {
  return type === "documents" || type === "bankStatements" || type === "reconciliation" || type === "capital";
}

export async function buildReportAnalytics(userId: string, filters: ReportFilters): Promise<ReportAnalytics> {
  const normalized = normalizeReportFilters(filters);
  const dataFilters = {
    userId,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    clientId: normalized.clientId,
    caseFileId: normalized.caseFileId
  };
  const [
    context,
    summaryData,
    cashReport,
    cashAccountReport,
    cashAccountBalances,
    monthlyTrend,
    incomeCategories,
    expenseCategories,
    topClientsByIncome,
    clientOpenBalances,
    caseFinanceSummary,
    upcomingExpenseReminders,
    overdueReminderAnalysis
  ] = await Promise.all([
    getReportData(userId, normalized),
    getReportSummary(dataFilters),
    getCashFlowReport(dataFilters),
    getAccountBasedReport(dataFilters),
    getAllCashAccountBalances(userId),
    getIncomeExpenseTrend(dataFilters),
    getIncomeByCategory(dataFilters),
    getExpenseByCategory(dataFilters),
    getTopClientsByIncome(dataFilters),
    getTopClientsByBalance(dataFilters),
    getCaseFileFinancialSummary(dataFilters),
    getUpcomingExpenseReminderRows(dataFilters),
    getOverdueReminderAnalysis(userId, normalized)
  ]);
  const rangeLabel = analyticsRangeLabel(normalized);
  const cashBalanceMap = new Map(cashAccountBalances.map((row) => [row.accountId, row]));
  const financialPicture = buildFinancialPicture(summaryData);
  const insights = buildFinancialInsights(context, summaryData, expenseCategories, rangeLabel);

  return {
    rangeLabel,
    kpis: [
      {
        label: "Toplam Kasa Girişi",
        value: cashReport.summary.cashInLabel,
        detail: `${cashReport.rows.filter((row) => row.direction === "IN").length} kasa giriş hareketi`,
        tone: "green"
      },
      {
        label: "Toplam Kasa Çıkışı",
        value: cashReport.summary.cashOutLabel,
        detail: `${cashReport.rows.filter((row) => row.direction === "OUT").length} kasa çıkış hareketi`,
        tone: "rose"
      },
      {
        label: "Net Nakit Akışı",
        value: cashReport.summary.netLabel,
        detail: cashReport.summary.net >= 0 ? "Kasa akışı pozitif" : "Kasa çıkışı girişi aşıyor",
        tone: cashReport.summary.net >= 0 ? "green" : "rose"
      },
      {
        label: "Toplam Tahsilat",
        value: summaryData.formatted.totalIncome,
        detail: `${summaryData.incomeCount} tahsilat kaydı`,
        tone: "green"
      },
      {
        label: "Toplam Gider",
        value: summaryData.formatted.totalExpense,
        detail: `${summaryData.expenseCount} gider kaydı`,
        tone: "rose"
      },
      {
        label: "Tahsil Edilecek Açık Alacak",
        value: summaryData.formatted.outstandingReceivables,
        detail: "Kesilmiş veya ödenmemiş belge bakiyesi",
        tone: "amber"
      },
      {
        label: "Yansıtılabilir Masraf",
        value: summaryData.formatted.reimbursableExpenses,
        detail: "Müvekkile aktarılabilecek giderler",
        tone: "amber"
      },
      {
        label: "Ödenmemiş Belge Toplamı",
        value: summaryData.formatted.unpaidInvoices,
        detail: `${summaryData.unpaidInvoiceCount} belge`,
        tone: "amber"
      }
    ],
    financialPicture,
    insights,
    charts: {
      cashDailyFlow: cashReport.dailyFlow.map((point) => ({
        label: point.label,
        tahsilat: point.giris,
        gider: point.cikis,
        net: point.net
      })),
      monthlyTrend,
      cashAccountDistribution: cashAccountBalances
        .map((account) => ({ label: account.accountName, value: Math.abs(account.balance) }))
        .filter((row) => row.value > 0),
      incomeCategories,
      expenseCategories,
      topClientsByIncome,
      clientOpenBalances,
      caseFinanceSummary,
      topExpenseItems: buildTopExpenseSeries(context),
      overdueReminderTimeline: overdueReminderAnalysis.timeline,
      netTrend: monthlyTrend.map((point) => ({ label: point.label, value: point.net }))
    },
    tables: {
      cashAccounts: cashAccountReport.map((row) => {
        const balance = cashBalanceMap.get(row.accountId);
        return {
          "Kasa Hesabı": row.account,
          "Güncel Bakiye": balance?.balanceLabel ?? formatMoney(0),
          Giriş: row.cashInLabel,
          Çıkış: row.cashOutLabel,
          Net: row.netLabel,
          Hareket: String(row.movementCount)
        };
      }),
      cashTransfers: cashReport.rows
        .filter((row) => row.entryType === "Transfer")
        .slice(0, 12)
        .map((row) => ({
          Tarih: row.date,
          Kasa: row.account,
          Yön: row.direction === "IN" ? "Giriş" : "Çıkış",
          Açıklama: row.description || "Kasa transferi",
          Tutar: row.signedAmountLabel
        })),
      recentIncomes: context.incomes.slice(0, 8).map((row) => ({
        Tarih: formatDate(row.date),
        Müvekkil: row.client.name,
        Dosya: row.caseFile?.title ?? "-",
        Kategori: incomeCategoryLabels[row.category],
        Tutar: formatMoney(row.amount, row.currency)
      })),
      recentExpenses: context.expenses.slice(0, 8).map((row) => ({
        Tarih: formatDate(row.date),
        Müvekkil: row.client?.name ?? "Genel gider",
        Dosya: row.caseFile?.title ?? "-",
        Kategori: expenseCategoryLabels[row.category],
        Tutar: formatMoney(row.amount, row.currency)
      })),
      topExpenses: [...context.expenses]
        .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
        .slice(0, 8)
        .map((row) => ({
          Tarih: formatDate(row.date),
          Kalem: row.description || expenseCategoryLabels[row.category],
          Kategori: expenseCategoryLabels[row.category],
          Kapsam: row.client?.name ?? "Genel gider",
          Tutar: formatMoney(row.amount, row.currency)
        })),
      topIncomeClients: buildTopIncomeClientRows(context),
      upcomingExpenseReminders: upcomingExpenseReminders.slice(0, 8).map((row) => ({
        Vade: row.dueDate,
        Başlık: row.title,
        Müvekkil: row.client,
        Dosya: row.caseFile,
        Öncelik: row.priority,
        Tutar: row.amountLabel
      })),
      clientProfitability: buildClientProfitabilityRows(context),
      caseFinancials: buildCaseFinancialRows(context),
      overdueReminders: overdueReminderAnalysis.rows
    }
  };
}

function buildFinancialPicture(summary: Awaited<ReturnType<typeof getReportSummary>>): ReportFinancialPicturePoint[] {
  return [
    {
      label: "Tahsilat",
      value: summary.totalIncome,
      valueLabel: formatSignedMoney(summary.totalIncome),
      tone: "positive"
    },
    {
      label: "Gider",
      value: -summary.totalExpense,
      valueLabel: formatSignedMoney(-summary.totalExpense),
      tone: "negative"
    },
    {
      label: "Net",
      value: summary.net,
      valueLabel: formatSignedMoney(summary.net),
      tone: summary.net > 0 ? "positive" : summary.net < 0 ? "negative" : "neutral"
    },
    {
      label: "Açık alacak",
      value: summary.outstandingReceivables,
      valueLabel: formatMoney(summary.outstandingReceivables),
      tone: summary.outstandingReceivables > 0 ? "attention" : "neutral"
    },
    {
      label: "Yansıtılabilir",
      value: summary.reimbursableExpenses,
      valueLabel: formatMoney(summary.reimbursableExpenses),
      tone: summary.reimbursableExpenses > 0 ? "attention" : "neutral"
    },
    {
      label: "Ödenmemiş belge",
      value: summary.unpaidInvoices,
      valueLabel: formatMoney(summary.unpaidInvoices),
      tone: summary.unpaidInvoices > 0 ? "attention" : "neutral"
    }
  ];
}

function buildFinancialInsights(
  context: ReportContext,
  summary: Awaited<ReturnType<typeof getReportSummary>>,
  expenseCategories: ReportSeriesPoint[],
  rangeLabel: string
): ReportFinancialInsight[] {
  const insights: ReportFinancialInsight[] = [];
  const income = summary.totalIncome;
  const expense = summary.totalExpense;
  const net = summary.net;
  const expenseRatio = income > 0 ? expense / income : expense > 0 ? 1 : 0;
  const margin = income > 0 ? net / income : 0;
  const collectionRatio = income > 0 ? summary.outstandingReceivables / income : summary.outstandingReceivables > 0 ? 1 : 0;
  const topExpense = expenseCategories[0];
  const caseSignals = caseTypeSignals(context);

  if (net < 0) {
    insights.push({
      id: "cash-flow-negative",
      category: "cash-flow",
      title: "Önce nakit dengesini toparlayın",
      message: "Seçilen dönemde giderler tahsilatı aşıyor. Yeni yatırım ayırmadan önce zorunlu olmayan çıkışları ve tahsilat takvimini gözden geçirmek daha güvenli olur.",
      evidence: `${rangeLabel}: ${formatSignedMoney(net)} net nakit sonucu`,
      tone: "rose",
      actionLabel: "Giderleri incele",
      actionHref: "/expenses"
    });
  } else if (income > 0) {
    insights.push({
      id: "cash-flow-positive",
      category: "cash-flow",
      title: margin >= 0.2 ? "Finansal hareket alanınız güçleniyor" : "Pozitif dengeyi kalıcı hale getirin",
      message:
        margin >= 0.2
          ? "Dönem neti güçlü görünüyor. Vergi, yaklaşan ödeme ve işletme tamponunu ayırdıktan sonra kalan tutar için düzenli birikim planı oluşturmayı değerlendirin."
          : "Dönem pozitif kapansa da marj sınırlı. Düzenli giderleri sabitlemek ve tahsilat hızını artırmak bu alanı büyütebilir.",
      evidence: `${rangeLabel}: %${Math.round(Math.max(0, margin) * 100).toLocaleString("tr-TR")} net marj`,
      tone: margin >= 0.2 ? "green" : "blue",
      actionLabel: "Nakit akışını gör",
      actionHref: "/cash/ledger"
    });
  }

  if (summary.outstandingReceivables > 0 && (collectionRatio >= 0.25 || summary.unpaidInvoiceCount > 0)) {
    insights.push({
      id: "collection-focus",
      category: "collection",
      title: "Tahsilat hızını öne alın",
      message: "Açık alacakların nakde dönüşmesi, yeni gelir aramadan önce en düşük riskli finansal iyileştirme alanınız olabilir. Vade ve takip notlarını netleştirin.",
      evidence: `${formatMoney(summary.outstandingReceivables)} açık alacak · ${summary.unpaidInvoiceCount} ödenmemiş belge`,
      tone: "amber",
      actionLabel: "Tahsilatları aç",
      actionHref: "/collections"
    });
  }

  if (expenseRatio >= 0.65 && expense > 0) {
    insights.push({
      id: "spending-ratio",
      category: "spending",
      title: "Gider oranı yakın takip istiyor",
      message: topExpense
        ? `${topExpense.label} seçilen dönemin en yüksek gider yoğunluğunu oluşturuyor. Tek seferlik ve tekrarlayan kalemleri ayırarak pazarlık veya limit alanlarını belirleyin.`
        : "Giderler gelirin önemli bölümünü kullanıyor. Tek seferlik ve tekrarlayan kalemleri ayırarak kontrol edilebilir harcamaları belirleyin.",
      evidence: `Gider / tahsilat oranı %${Math.round(expenseRatio * 100).toLocaleString("tr-TR")}${topExpense ? ` · ${topExpense.label}: ${formatMoney(topExpense.value)}` : ""}`,
      tone: expenseRatio >= 0.9 ? "rose" : "amber",
      actionLabel: "Gider dağılımına git",
      actionHref: "/reports#analysis-charts"
    });
  }

  if (summary.reimbursableExpenses > 0) {
    insights.push({
      id: "reimbursable-expense",
      category: "spending",
      title: "Yansıtılabilir masrafları bekletmeyin",
      message: "Müvekkile yansıtılabilir giderleri dosya ve belge bağlantılarıyla birlikte düzenli faturalamak, büronun kendi nakdinin dosya masraflarında bağlı kalmasını azaltır.",
      evidence: `${formatMoney(summary.reimbursableExpenses)} yansıtılabilir masraf`,
      tone: "blue",
      actionLabel: "Masrafları incele",
      actionHref: "/reports?type=reimbursable"
    });
  }

  if (caseSignals.risk) {
    insights.push({
      id: "case-type-risk",
      category: "case-mix",
      title: `${caseSignals.risk.label} dosyalarında finans planını sıkılaştırın`,
      message: "Bu dosya türünde giderler tahsilatı aşıyor. Dosya kabul kararını mesleki ve etik değerlendirmeden ayırmadan; masraf avansı, ara ödeme ve fiyatlandırma planını baştan netleştirin.",
      evidence: `${caseSignals.risk.count} dosya · ${formatSignedMoney(caseSignals.risk.net)} net katkı`,
      tone: "rose",
      actionLabel: "Dosyaları incele",
      actionHref: "/cases"
    });
  } else if (caseSignals.strong) {
    insights.push({
      id: "case-type-strong",
      category: "case-mix",
      title: `${caseSignals.strong.label} dosyaları güçlü katkı veriyor`,
      message: "Bu sinyali dava kabulü için tek ölçüt olarak kullanmayın. Benzer dosyalarda emek süresi, tahsilat süresi ve masraf yapısını karşılaştırarak fiyatlandırma standardınızı geliştirin.",
      evidence: `${caseSignals.strong.count} dosya · ${formatSignedMoney(caseSignals.strong.net)} net katkı`,
      tone: "green",
      actionLabel: "Dosya raporunu aç",
      actionHref: "/reports?type=case"
    });
  }

  insights.push(investmentReadinessInsight({ income, net, margin, collectionRatio, rangeLabel }));

  if (net > 0) {
    insights.push({
      id: "motivation-positive",
      category: "motivation",
      title: "İstikrar küçük ama düzenli adımlarla büyür",
      message: "Pozitif dönemi yalnız sonuç olarak değil, tekrar edilebilir bir sistem olarak görün: tahsilatı zamanında takip edin, giderleri haftalık kontrol edin ve birikimi otomatik bir alışkanlığa dönüştürün.",
      evidence: `${formatSignedMoney(net)} dönem neti`,
      tone: "green",
      actionLabel: "Sermaye merkezini aç",
      actionHref: "/capital"
    });
  }

  return insights.slice(0, 7);
}

function investmentReadinessInsight({
  income,
  net,
  margin,
  collectionRatio,
  rangeLabel
}: {
  income: number;
  net: number;
  margin: number;
  collectionRatio: number;
  rangeLabel: string;
}): ReportFinancialInsight {
  const ready = income > 0 && net > 0 && margin >= 0.15 && collectionRatio < 0.5;

  return {
    id: "investment-readiness",
    category: "investment-readiness",
    title: ready ? "Yatırım için hazırlık zemini oluşuyor" : "Yatırımdan önce finansal zemini güçlendirin",
    message: ready
      ? "Önce vergi ve kısa vadeli yükümlülükleri, ardından 3-6 aylık büro gideri için likit tamponu doğrulayın. Kalan tutarı risk süreniz ve kayıp toleransınıza uygun araçlarda değerlendirmeden önce yetkili bir yatırım kuruluşundan yerindelik değerlendirmesi alın."
      : "Nakit tamponu, açık alacaklar ve dönem marjı netleşmeden yatırım tutarı ayırmak büro likiditesini zorlayabilir. Önce düzenli pozitif nakit akışı hedefleyin.",
    evidence: `${rangeLabel}: ${formatSignedMoney(net)} net · %${Math.round(Math.max(0, margin) * 100).toLocaleString("tr-TR")} marj`,
    tone: ready ? "blue" : "amber",
    actionLabel: ready ? "Varlık planını aç" : "Finans planını gözden geçir",
    actionHref: ready ? "/capital" : "/reports#summary-kpis"
  };
}

function caseTypeSignals(context: ReportContext) {
  const groups = new Map<string, { label: string; income: number; expense: number; caseIds: Set<string> }>();

  for (const row of context.incomes) {
    const label = cleanCaseType(row.caseFile?.caseType);
    if (!label || !row.caseFileId) continue;
    const current = groups.get(label) ?? { label, income: 0, expense: 0, caseIds: new Set<string>() };
    current.income += toNumber(row.amount);
    current.caseIds.add(row.caseFileId);
    groups.set(label, current);
  }

  for (const row of context.expenses) {
    const label = cleanCaseType(row.caseFile?.caseType);
    if (!label || !row.caseFileId) continue;
    const current = groups.get(label) ?? { label, income: 0, expense: 0, caseIds: new Set<string>() };
    current.expense += toNumber(row.amount);
    current.caseIds.add(row.caseFileId);
    groups.set(label, current);
  }

  const signals = [...groups.values()]
    .map((item) => ({ label: item.label, count: item.caseIds.size, net: item.income - item.expense, income: item.income, expense: item.expense }))
    .filter((item) => item.count > 0);
  const risk = signals.filter((item) => item.net < 0 && item.expense > 0).sort((a, b) => a.net - b.net)[0] ?? null;
  const strong = signals.filter((item) => item.net > 0).sort((a, b) => b.net - a.net)[0] ?? null;

  return { risk, strong };
}

function cleanCaseType(value: string | null | undefined) {
  const clean = value?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > 42 ? `${clean.slice(0, 41)}…` : clean;
}

function buildTopIncomeClientRows(context: ReportContext): ReportAnalysisRow[] {
  const grouped = new Map<string, { total: Prisma.Decimal; count: number; lastDate: Date | null }>();

  for (const income of context.incomes) {
    const current = grouped.get(income.client.name) ?? { total: new Prisma.Decimal(0), count: 0, lastDate: null };
    current.total = current.total.plus(income.amount);
    current.count += 1;
    current.lastDate = !current.lastDate || income.date > current.lastDate ? income.date : current.lastDate;
    grouped.set(income.client.name, current);
  }

  return Array.from(grouped.entries())
    .sort(([, a], [, b]) => toNumber(b.total) - toNumber(a.total))
    .slice(0, 8)
    .map(([clientName, item]) => ({
      Müvekkil: clientName,
      Tahsilat: formatMoney(item.total),
      Kayıt: String(item.count),
      "Son Tahsilat": item.lastDate ? formatDate(item.lastDate) : "-"
    }));
}

function buildTopExpenseSeries(context: ReportContext): ReportSeriesPoint[] {
  return [...context.expenses]
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
    .slice(0, 8)
    .map((row) => ({
      label: row.description || expenseCategoryLabels[row.category],
      value: toNumber(row.amount)
    }));
}

function buildClientProfitabilityRows(context: ReportContext): ReportAnalysisRow[] {
  return context.clients
    .map((client) => {
      const incomes = context.incomes.filter((row) => row.clientId === client.id);
      const expenses = context.expenses.filter((row) => row.clientId === client.id);
      const documents = context.documents.filter((row) => row.clientId === client.id);
      const incomeTotal = sum(incomes.map((row) => row.amount));
      const expenseTotal = sum(expenses.map((row) => row.amount));
      const reimbursableTotal = sum(expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
      const openDocuments = sum(documents.filter((row) => ["ISSUED", "UNPAID"].includes(row.status)).map((row) => row.netAmount));
      const advances = sum(incomes.filter((row) => row.category === "ADVANCE").map((row) => row.amount));
      const openBalance = openDocuments.plus(reimbursableTotal).minus(advances);
      const net = incomeTotal.minus(expenseTotal);
      const hasData = !incomeTotal.equals(0) || !expenseTotal.equals(0) || !openBalance.equals(0);

      return {
        hasData,
        sortValue: Math.abs(toNumber(net)) + Math.abs(toNumber(openBalance)),
        row: {
          Müvekkil: client.name,
          "Toplam Tahsilat": formatMoney(incomeTotal),
          "Toplam Gider": formatMoney(expenseTotal),
          "Yansıtılabilir Gider": formatMoney(reimbursableTotal),
          "Net Durum": formatMoney(net),
          "Açık Bakiye": formatMoney(openBalance)
        }
      };
    })
    .filter((item) => item.hasData)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, 12)
    .map((item) => item.row);
}

function buildCaseFinancialRows(context: ReportContext): ReportAnalysisRow[] {
  return context.cases
    .map((caseFile) => {
      const incomes = context.incomes.filter((row) => row.caseFileId === caseFile.id);
      const expenses = context.expenses.filter((row) => row.caseFileId === caseFile.id);
      const incomeTotal = sum(incomes.map((row) => row.amount));
      const expenseTotal = sum(expenses.map((row) => row.amount));
      const reimbursableTotal = sum(expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
      const net = incomeTotal.minus(expenseTotal);
      const dates = [...incomes.map((row) => row.date), ...expenses.map((row) => row.date)];
      const lastDate = dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const hasData = !incomeTotal.equals(0) || !expenseTotal.equals(0);

      return {
        hasData,
        sortValue: Math.abs(toNumber(net)),
        row: {
          Müvekkil: caseFile.client.name,
          Dosya: caseFile.title,
          Tahsilat: formatMoney(incomeTotal),
          Gider: formatMoney(expenseTotal),
          Masraf: formatMoney(reimbursableTotal),
          Net: formatMoney(net),
          "Son İşlem": lastDate ? formatDate(lastDate) : "-"
        }
      };
    })
    .filter((item) => item.hasData)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, 12)
    .map((item) => item.row);
}

async function getOverdueReminderAnalysis(userId: string, filters: ReturnType<typeof normalizeReportFilters>) {
  const today = startOfDay(new Date());
  const dueDate: Prisma.DateTimeFilter = { lt: today };

  if (filters.startDate) {
    dueDate.gte = parseDateInput(filters.startDate);
  }

  if (filters.endDate) {
    const end = endOfDateInput(filters.endDate);
    if (end < today) {
      dueDate.lte = end;
    }
  }

  const reminders = await prisma.taskReminder.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "OPEN",
      dueDate,
      ...(filters.clientId ? { relatedClientId: filters.clientId } : {}),
      ...(filters.caseFileId ? { relatedCaseFileId: filters.caseFileId } : {}),
      AND: [
        { OR: [{ relatedClientId: null }, { relatedClient: { archivedAt: null, deletedAt: null } }] },
        { OR: [{ relatedCaseFileId: null }, { relatedCaseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
      ]
    },
    include: {
      relatedClient: { select: { name: true } },
      relatedCaseFile: { select: { title: true } }
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }]
  });
  const grouped = new Map<string, number>();

  for (const reminder of reminders) {
    const label = formatDate(reminder.dueDate);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }

  return {
    timeline: Array.from(grouped.entries()).map(([label, value]) => ({ label, value })).slice(0, 12),
    rows: reminders.slice(0, 12).map((row) => ({
      Vade: formatDate(row.dueDate),
      Başlık: row.title,
      Tür: reminderTypeLabels[row.reminderType],
      Müvekkil: row.relatedClient?.name ?? "-",
      Dosya: row.relatedCaseFile?.title ?? "-",
      Öncelik: reminderPriorityLabels[row.priority],
      Tutar: row.amount ? formatMoney(row.amount, row.currency) : "-"
    }))
  };
}

function buildDailyReport(context: ReportContext): FinancialReport {
  const grouped = new Map<string, { date: Date; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (const income of context.incomes) {
    const key = dayKey(income.date);
    const current = grouped.get(key) ?? moneyGroup(income.date);
    current.income = current.income.plus(income.amount);
    grouped.set(key, current);
  }

  for (const expense of context.expenses) {
    const key = dayKey(expense.date);
    const current = grouped.get(key) ?? moneyGroup(expense.date);
    current.expense = current.expense.plus(expense.amount);
    grouped.set(key, current);
  }

  const rows = Array.from(grouped.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((row) => ({
      Tarih: formatDate(row.date),
      Tahsilat: formatMoney(row.income),
      Gider: formatMoney(row.expense),
      Net: formatMoney(row.income.minus(row.expense))
    }));
  const chartData = Array.from(grouped.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((row) => ({
      label: formatDate(row.date),
      tahsilat: toNumber(row.income),
      gider: toNumber(row.expense),
      net: toNumber(row.income.minus(row.expense))
    }));

  return {
    type: "daily",
    title: reportTypeLabels.daily,
    summaries: baseFinancialSummaries(context),
    headers: ["Tarih", "Tahsilat", "Gider", "Net"],
    rows,
    chartData,
    empty: "Seçilen aralıkta günlük finans hareketi yok"
  };
}

function buildMonthlyReport(context: ReportContext): FinancialReport {
  const grouped = new Map<string, { label: string; sort: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();

  for (const income of context.incomes) {
    const key = monthKey(income.date);
    const current = grouped.get(key) ?? periodGroup(monthLabel(income.date), key);
    current.income = current.income.plus(income.amount);
    grouped.set(key, current);
  }

  for (const expense of context.expenses) {
    const key = monthKey(expense.date);
    const current = grouped.get(key) ?? periodGroup(monthLabel(expense.date), key);
    current.expense = current.expense.plus(expense.amount);
    grouped.set(key, current);
  }

  const rows = Array.from(grouped.values())
    .sort((a, b) => b.sort.localeCompare(a.sort))
    .map((row) => ({
      Ay: row.label,
      Tahsilat: formatMoney(row.income),
      Gider: formatMoney(row.expense),
      Net: formatMoney(row.income.minus(row.expense))
    }));
  const chartData = Array.from(grouped.values())
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((row) => ({
      label: row.label,
      tahsilat: toNumber(row.income),
      gider: toNumber(row.expense),
      net: toNumber(row.income.minus(row.expense))
    }));

  return {
    type: "monthly",
    title: reportTypeLabels.monthly,
    summaries: baseFinancialSummaries(context),
    headers: ["Ay", "Tahsilat", "Gider", "Net"],
    rows,
    chartData,
    empty: "Seçilen aralıkta aylık gelir-gider verisi yok"
  };
}

function buildClientReport(context: ReportContext): FinancialReport {
  const items = context.clients
    .map((client) => {
      const incomes = context.incomes.filter((row) => row.clientId === client.id);
      const expenses = context.expenses.filter((row) => row.clientId === client.id);
      const documents = context.documents.filter((row) => row.clientId === client.id);
      const incomeTotal = sum(incomes.map((row) => row.amount));
      const expenseTotal = sum(expenses.map((row) => row.amount));
      const reimbursableTotal = sum(expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
      const unpaidTotal = sum(documents.filter((row) => row.status === "UNPAID").map((row) => row.netAmount));
      const balance = incomeTotal.minus(expenseTotal).plus(unpaidTotal);
      const hasData = !incomeTotal.equals(0) || !expenseTotal.equals(0) || !unpaidTotal.equals(0);

      return {
        sort: client.name,
        hasData,
        chartPoint: {
          label: client.name,
          tahsilat: toNumber(incomeTotal),
          gider: toNumber(expenseTotal),
          masraf: toNumber(reimbursableTotal),
          belge: toNumber(unpaidTotal),
          net: toNumber(balance)
        },
        row: {
          Müvekkil: client.name,
          Tahsilat: formatMoney(incomeTotal),
          Gider: formatMoney(expenseTotal),
          "Yansıtılabilir Masraf": formatMoney(reimbursableTotal),
          "Ödenmemiş Belge": formatMoney(unpaidTotal),
          Bakiye: formatMoney(balance)
        }
      };
    })
    .filter((item) => item.hasData)
    .sort((a, b) => a.sort.localeCompare(b.sort, "tr"));
  const rows = items.map(({ row }) => row);
  const chartData = [...items]
    .sort((a, b) => Math.abs(b.chartPoint.net ?? 0) - Math.abs(a.chartPoint.net ?? 0))
    .slice(0, 8)
    .map(({ chartPoint }) => chartPoint);

  return {
    type: "client",
    title: reportTypeLabels.client,
    summaries: [...baseFinancialSummaries(context), summary("Müvekkil", String(rows.length))],
    headers: ["Müvekkil", "Tahsilat", "Gider", "Yansıtılabilir Masraf", "Ödenmemiş Belge", "Bakiye"],
    rows,
    chartData,
    empty: "Seçilen filtrelerde müvekkil cari verisi yok"
  };
}

function buildCaseReport(context: ReportContext): FinancialReport {
  const items = context.cases
    .map((caseFile) => {
      const incomes = context.incomes.filter((row) => row.caseFileId === caseFile.id);
      const expenses = context.expenses.filter((row) => row.caseFileId === caseFile.id);
      const documents = context.documents.filter((row) => row.caseFileId === caseFile.id);
      const incomeTotal = sum(incomes.map((row) => row.amount));
      const expenseTotal = sum(expenses.map((row) => row.amount));
      const documentTotal = sum(documents.map((row) => row.netAmount));
      const net = incomeTotal.minus(expenseTotal);
      const hasData = !incomeTotal.equals(0) || !expenseTotal.equals(0) || !documentTotal.equals(0);

      return {
        sort: caseFile.title,
        hasData,
        chartPoint: {
          label: caseFile.title,
          tahsilat: toNumber(incomeTotal),
          gider: toNumber(expenseTotal),
          belge: toNumber(documentTotal),
          net: toNumber(net)
        },
        row: {
          Müvekkil: caseFile.client.name,
          Dosya: caseFile.title,
          "Dosya No": caseFile.fileNumber ?? "",
          Tahsilat: formatMoney(incomeTotal),
          Gider: formatMoney(expenseTotal),
          "Belge Net": formatMoney(documentTotal),
          Net: formatMoney(net)
        }
      };
    })
    .filter((item) => item.hasData)
    .sort((a, b) => a.sort.localeCompare(b.sort, "tr"));
  const rows = items.map(({ row }) => row);
  const chartData = [...items]
    .sort((a, b) => Math.abs(b.chartPoint.net ?? 0) - Math.abs(a.chartPoint.net ?? 0))
    .slice(0, 8)
    .map(({ chartPoint }) => chartPoint);

  return {
    type: "case",
    title: reportTypeLabels.case,
    summaries: [...baseFinancialSummaries(context), summary("Dosya", String(rows.length))],
    headers: ["Müvekkil", "Dosya", "Dosya No", "Tahsilat", "Gider", "Belge Net", "Net"],
    rows,
    chartData,
    empty: "Seçilen filtrelerde dosya bazlı finans verisi yok"
  };
}

function buildReimbursableReport(context: ReportContext): FinancialReport {
  const expenses = context.expenses.filter((row) => row.isClientExpense);
  const rows = expenses.map((row) => ({
    Tarih: formatDate(row.date),
    Müvekkil: row.client?.name ?? "",
    Dosya: row.caseFile?.title ?? "",
    Kategori: expenseCategoryLabels[row.category],
    Açıklama: row.description ?? "",
    Tutar: formatMoney(row.amount, row.currency)
  }));
  const chartData = expenses.slice(0, 10).map((row) => ({
    label: row.client?.name || row.caseFile?.title || formatDate(row.date),
    masraf: toNumber(row.amount)
  }));

  return {
    type: "reimbursable",
    title: reportTypeLabels.reimbursable,
    summaries: [
      summary("Yansıtılabilir Masraf", formatMoney(sum(expenses.map((row) => row.amount))), "amber"),
      summary("Kayıt", String(rows.length))
    ],
    headers: ["Tarih", "Müvekkil", "Dosya", "Kategori", "Açıklama", "Tutar"],
    rows,
    chartData,
    empty: "Seçilen filtrelerde müvekkile yansıtılabilir masraf yok"
  };
}

function buildUnpaidReport(context: ReportContext): FinancialReport {
  const documents = context.documents.filter((row) => row.status === "UNPAID");
  const rows = documents.map((row) => ({
    Tarih: formatDate(row.issueDate),
    Müvekkil: row.client.name,
    Dosya: row.caseFile?.title ?? "",
    "Belge No": row.number,
    Durum: receiptStatusLabels[row.status],
    Net: formatMoney(row.netAmount)
  }));
  const chartData = documents.slice(0, 10).map((row) => ({
    label: row.client.name,
    belge: toNumber(row.netAmount)
  }));

  return {
    type: "unpaid",
    title: reportTypeLabels.unpaid,
    summaries: [
      summary("Ödenmemiş Belge", String(rows.length), "amber"),
      summary("Ödenmemiş Net", formatMoney(sum(documents.map((row) => row.netAmount))), "rose")
    ],
    headers: ["Tarih", "Müvekkil", "Dosya", "Belge No", "Durum", "Net"],
    rows,
    chartData,
    empty: "Seçilen filtrelerde ödenmemiş makbuz/fatura yok"
  };
}

function buildYearlyReport(context: ReportContext): FinancialReport {
  const grouped = new Map<string, { year: string; income: Prisma.Decimal; expense: Prisma.Decimal; documents: Prisma.Decimal }>();

  for (const income of context.incomes) {
    const key = String(income.date.getFullYear());
    const current = grouped.get(key) ?? yearGroup(key);
    current.income = current.income.plus(income.amount);
    grouped.set(key, current);
  }

  for (const expense of context.expenses) {
    const key = String(expense.date.getFullYear());
    const current = grouped.get(key) ?? yearGroup(key);
    current.expense = current.expense.plus(expense.amount);
    grouped.set(key, current);
  }

  for (const document of context.documents) {
    const key = String(document.issueDate.getFullYear());
    const current = grouped.get(key) ?? yearGroup(key);
    current.documents = current.documents.plus(document.netAmount);
    grouped.set(key, current);
  }

  const rows = Array.from(grouped.values())
    .sort((a, b) => b.year.localeCompare(a.year))
    .map((row) => ({
      Yıl: row.year,
      Tahsilat: formatMoney(row.income),
      Gider: formatMoney(row.expense),
      "Belge Net": formatMoney(row.documents),
      Net: formatMoney(row.income.minus(row.expense))
    }));
  const chartData = Array.from(grouped.values())
    .sort((a, b) => a.year.localeCompare(b.year))
    .map((row) => ({
      label: row.year,
      tahsilat: toNumber(row.income),
      gider: toNumber(row.expense),
      belge: toNumber(row.documents),
      net: toNumber(row.income.minus(row.expense))
    }));

  return {
    type: "yearly",
    title: reportTypeLabels.yearly,
    summaries: baseFinancialSummaries(context),
    headers: ["Yıl", "Tahsilat", "Gider", "Belge Net", "Net"],
    rows,
    chartData,
    empty: "Seçilen filtrelerde yıllık özet verisi yok"
  };
}

async function getReportData(userId: string, filters: ReturnType<typeof normalizeReportFilters>) {
  const [incomes, expenses, documents, clients, cases] = await Promise.all([
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        ...clientCaseFilter(filters),
        ...(dateFilter("date", filters) as object)
      },
      include: { client: true, caseFile: true },
      orderBy: { date: "desc" }
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ],
        ...clientCaseFilter(filters),
        ...(dateFilter("date", filters) as object)
      },
      include: { client: true, caseFile: true },
      orderBy: { date: "desc" }
    }),
    prisma.invoiceOrReceipt.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        ...clientCaseFilter(filters),
        ...(dateFilter("issueDate", filters) as object)
      },
      include: { client: true, caseFile: true },
      orderBy: { issueDate: "desc" }
    }),
    prisma.client.findMany({
      where: { userId, archivedAt: null, deletedAt: null, ...(filters.clientId ? { id: filters.clientId } : {}) },
      orderBy: { name: "asc" }
    }),
    prisma.caseFile.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        client: { archivedAt: null, deletedAt: null },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.caseFileId ? { id: filters.caseFileId } : {})
      },
      include: { client: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return { incomes, expenses, documents, clients, cases };
}

function baseFinancialSummaries(context: ReportContext): ReportSummary[] {
  const incomeTotal = sum(context.incomes.map((row) => row.amount));
  const expenseTotal = sum(context.expenses.map((row) => row.amount));
  const unpaidTotal = sum(context.documents.filter((row) => row.status === "UNPAID").map((row) => row.netAmount));

  return [
    summary("Tahsilat", formatMoney(incomeTotal), "green"),
    summary("Gider", formatMoney(expenseTotal), "rose"),
    summary("Net", formatMoney(incomeTotal.minus(expenseTotal)), incomeTotal.greaterThanOrEqualTo(expenseTotal) ? "green" : "rose"),
    summary("Ödenmemiş Belge", formatMoney(unpaidTotal), "amber")
  ];
}

function clientCaseFilter(filters: ReturnType<typeof normalizeReportFilters>) {
  return {
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {})
  };
}

function dateFilter(field: "date" | "issueDate", filters: ReturnType<typeof normalizeReportFilters>) {
  const value: Prisma.DateTimeFilter = {};

  if (filters.startDate) {
    value.gte = parseDateInput(filters.startDate);
  }

  if (filters.endDate) {
    value.lte = endOfDateInput(filters.endDate);
  }

  return value.gte || value.lte ? { [field]: value } : {};
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function summary(label: string, value: string, tone: ReportSummary["tone"] = "neutral"): ReportSummary {
  return { label, value, tone };
}

function moneyGroup(date: Date) {
  return { date, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
}

function periodGroup(label: string, sort: string) {
  return { label, sort, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
}

function yearGroup(year: string) {
  return { year, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0), documents: new Prisma.Decimal(0) };
}

function dayKey(date: Date) {
  return dateInputValue(date);
}

function monthKey(date: Date) {
  return dateInputValue(date).slice(0, 7);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

function dateRangeFor(range: Exclude<ReportRange, "custom">) {
  const today = startOfDay(new Date());

  if (range === "today") {
    return { startDate: dateInputValue(today), endDate: dateInputValue(today) };
  }

  if (range === "week") {
    return { startDate: dateInputValue(startOfWeek(today)), endDate: dateInputValue(today) };
  }

  if (range === "month") {
    return { startDate: dateInputValue(startOfMonth(today)), endDate: dateInputValue(today) };
  }

  if (range === "last3") {
    return { startDate: dateInputValue(startOfMonth(addMonths(today, -2))), endDate: dateInputValue(today) };
  }

  if (range === "last6") {
    return { startDate: dateInputValue(startOfMonth(addMonths(today, -5))), endDate: dateInputValue(today) };
  }

  return { startDate: dateInputValue(startOfYear(today)), endDate: dateInputValue(today) };
}

function startOfWeek(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function analyticsRangeLabel(filters: ReturnType<typeof normalizeReportFilters>) {
  const start = filters.startDate ? formatDate(parseDateInput(filters.startDate)) : "başlangıç yok";
  const end = filters.endDate ? formatDate(endOfDateInput(filters.endDate)) : "bitiş yok";
  return `${reportRangeLabels[filters.range]} · ${start} - ${end}`;
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function cleanDate(value: string | undefined) {
  const next = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}

function isReportType(value: string | undefined): value is ReportType {
  return reportTypes.includes(value as ReportType);
}

function isReportRange(value: string | undefined): value is ReportRange {
  return reportRanges.includes(value as ReportRange);
}
