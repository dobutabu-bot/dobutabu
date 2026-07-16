import { Prisma } from "@prisma/client";

import { getAccountBasedReport, getCashFlowReport, type CashReportFilters } from "@/lib/cash/cash-report-data";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import {
  advanceDirectionLabels,
  cashLedgerDirectionLabels,
  caseStatusLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  paymentMethodLabels,
  receiptStatusLabels
} from "@/lib/labels";
import { type PdfReportInput, type PdfSummaryItem, datedPdfFilename } from "@/lib/pdf/pdf-document";
import { prisma } from "@/lib/prisma";
import { buildFinancialReport, normalizeReportFilters, reportRangeLabels, type ReportFilters } from "@/lib/reporting";
import { buildV3ReportsData, type V3Metric } from "@/lib/reports/v3-report-data";
import { getFirmSettings } from "@/lib/settings";
import { formatDate, formatMoney, formatSignedMoney, toNumber } from "@/lib/utils";

export type BuiltPdfReport = {
  input: PdfReportInput;
  filename: string;
};

export type PdfFilterInput = {
  startDate?: string;
  endDate?: string;
  range?: string;
  clientId?: string;
  caseFileId?: string;
  cashAccountId?: string;
  direction?: string;
  minAmount?: string;
  maxAmount?: string;
  documentStatus?: string;
};

export function pdfFiltersFromSearchParams(searchParams: URLSearchParams): PdfFilterInput {
  return {
    startDate: clean(searchParams.get("startDate")),
    endDate: clean(searchParams.get("endDate")),
    range: clean(searchParams.get("range")),
    clientId: clean(searchParams.get("clientId")),
    caseFileId: clean(searchParams.get("caseFileId")),
    cashAccountId: clean(searchParams.get("cashAccountId")),
    direction: clean(searchParams.get("direction")),
    minAmount: clean(searchParams.get("minAmount")),
    maxAmount: clean(searchParams.get("maxAmount")),
    documentStatus: clean(searchParams.get("documentStatus"))
  };
}

export async function buildClientCurrentPdf(userId: string, clientId: string): Promise<BuiltPdfReport | null> {
  const [settings, client] = await Promise.all([
    getFirmSettings(userId),
    prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
      include: {
        cases: {
          where: { deletedAt: null, status: { not: "ARCHIVED" } },
          orderBy: { createdAt: "desc" }
        },
        incomes: {
          where: {
            deletedAt: null,
            OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
          },
          orderBy: { date: "desc" },
          include: { caseFile: { select: { title: true, fileNumber: true } } }
        },
        expenses: {
          where: {
            deletedAt: null,
            OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
          },
          orderBy: { date: "desc" },
          include: { caseFile: { select: { title: true, fileNumber: true } } }
        },
        documents: {
          where: {
            deletedAt: null,
            OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
          },
          orderBy: { issueDate: "desc" },
          include: { caseFile: { select: { title: true, fileNumber: true } } }
        }
      }
    })
  ]);

  if (!client) return null;

  const incomeTotal = sum(client.incomes.map((row) => row.amount));
  const expenseTotal = sum(client.expenses.map((row) => row.amount));
  const reimbursableTotal = sum(client.expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
  const openReceivableTotal = sum(client.documents.filter((row) => ["ISSUED", "UNPAID"].includes(row.status)).map((row) => row.netAmount));
  const net = incomeTotal.minus(expenseTotal);

  return {
    filename: datedPdfFilename("muvekkil-cari"),
    input: baseInput(settings, {
      title: "Müvekkil Cari Raporu",
      subtitle: client.name,
      summaries: [
        summary("Toplam Tahsilat", formatMoney(incomeTotal), "green"),
        summary("Toplam Gider", formatMoney(expenseTotal), "rose"),
        summary("Yansıtılabilir Masraf", formatMoney(reimbursableTotal), "amber"),
        summary("Açık Alacak", formatMoney(openReceivableTotal), "amber"),
        summary("Net Durum", formatSignedMoney(net), toNumber(net) >= 0 ? "green" : "rose")
      ],
      tables: [
        {
          title: "Müvekkil Bilgileri",
          headers: ["Alan", "Değer"],
          rows: [
            { Alan: "Müvekkil", Değer: client.name },
            { Alan: "Telefon", Değer: client.phone ?? "-" },
            { Alan: "E-posta", Değer: client.email ?? "-" },
            { Alan: "Adres", Değer: client.address ?? "-" },
            { Alan: "Kayıt Tarihi", Değer: formatDate(client.createdAt) }
          ]
        },
        {
          title: "Bağlı Dosyalar",
          headers: ["Dosya", "Dosya No", "Durum", "Kayıt"],
          rows: client.cases.map((row) => ({
            Dosya: row.title,
            "Dosya No": row.fileNumber ?? "-",
            Durum: caseStatusLabels[row.status],
            Kayıt: formatDate(row.createdAt)
          }))
        },
        {
          title: "Tahsilatlar",
          headers: ["Tarih", "Dosya", "Kategori", "Yöntem", "Tutar"],
          rows: client.incomes.map((row) => ({
            Tarih: formatDate(row.date),
            Dosya: caseLabel(row.caseFile),
            Kategori: incomeCategoryLabels[row.category],
            Yöntem: paymentMethodLabels[row.paymentMethod],
            Tutar: formatMoney(row.amount, row.currency)
          }))
        },
        {
          title: "Giderler",
          headers: ["Tarih", "Dosya", "Kategori", "Yansıtılabilir", "Tutar"],
          rows: client.expenses.map((row) => ({
            Tarih: formatDate(row.date),
            Dosya: caseLabel(row.caseFile),
            Kategori: expenseCategoryLabels[row.category],
            Yansıtılabilir: row.isClientExpense ? "Evet" : "Hayır",
            Tutar: formatMoney(row.amount, row.currency)
          }))
        }
      ]
    })
  };
}

export async function buildCaseFinancePdf(userId: string, caseFileId: string): Promise<BuiltPdfReport | null> {
  const [settings, caseFile] = await Promise.all([
    getFirmSettings(userId),
    prisma.caseFile.findFirst({
      where: { id: caseFileId, userId, deletedAt: null },
      include: {
        client: { select: { name: true, deletedAt: true, archivedAt: true } },
        incomes: { where: { deletedAt: null }, orderBy: { date: "desc" } },
        expenses: { where: { deletedAt: null }, orderBy: { date: "desc" } },
        documents: { where: { deletedAt: null }, orderBy: { issueDate: "desc" } }
      }
    })
  ]);

  if (!caseFile || caseFile.client.deletedAt || caseFile.client.archivedAt) return null;

  const incomeTotal = sum(caseFile.incomes.map((row) => row.amount));
  const expenseTotal = sum(caseFile.expenses.map((row) => row.amount));
  const documentTotal = sum(caseFile.documents.map((row) => row.netAmount));
  const reimbursableTotal = sum(caseFile.expenses.filter((row) => row.isClientExpense).map((row) => row.amount));
  const net = incomeTotal.minus(expenseTotal);

  return {
    filename: datedPdfFilename("dosya-finans"),
    input: baseInput(settings, {
      title: "Dosya Finans Raporu",
      subtitle: `${caseFile.client.name} - ${caseFile.title}`,
      summaries: [
        summary("Tahsilat", formatMoney(incomeTotal), "green"),
        summary("Gider", formatMoney(expenseTotal), "rose"),
        summary("Yansıtılabilir Masraf", formatMoney(reimbursableTotal), "amber"),
        summary("Belge Net", formatMoney(documentTotal), "blue"),
        summary("Net Durum", formatSignedMoney(net), toNumber(net) >= 0 ? "green" : "rose")
      ],
      tables: [
        {
          title: "Dosya Bilgileri",
          headers: ["Alan", "Değer"],
          rows: [
            { Alan: "Müvekkil", Değer: caseFile.client.name },
            { Alan: "Dosya", Değer: caseFile.title },
            { Alan: "Dosya No", Değer: caseFile.fileNumber ?? "-" },
            { Alan: "Mahkeme / Daire", Değer: caseFile.courtOrOffice ?? "-" },
            { Alan: "Durum", Değer: caseStatusLabels[caseFile.status] }
          ]
        },
        {
          title: "Tahsilatlar",
          headers: ["Tarih", "Kategori", "Yöntem", "Açıklama", "Tutar"],
          rows: caseFile.incomes.map((row) => ({
            Tarih: formatDate(row.date),
            Kategori: incomeCategoryLabels[row.category],
            Yöntem: paymentMethodLabels[row.paymentMethod],
            Açıklama: row.description ?? "-",
            Tutar: formatMoney(row.amount, row.currency)
          }))
        },
        {
          title: "Giderler",
          headers: ["Tarih", "Kategori", "Yansıtılabilir", "Açıklama", "Tutar"],
          rows: caseFile.expenses.map((row) => ({
            Tarih: formatDate(row.date),
            Kategori: expenseCategoryLabels[row.category],
            Yansıtılabilir: row.isClientExpense ? "Evet" : "Hayır",
            Açıklama: row.description ?? "-",
            Tutar: formatMoney(row.amount, row.currency)
          }))
        },
        {
          title: "Makbuz / Fatura",
          headers: ["Tarih", "Numara", "Durum", "Net"],
          rows: caseFile.documents.map((row) => ({
            Tarih: formatDate(row.issueDate),
            Numara: row.number,
            Durum: receiptStatusLabels[row.status],
            Net: formatMoney(row.netAmount)
          }))
        }
      ]
    })
  };
}

export async function buildCollectionSummaryPdf(userId: string, incomeId: string): Promise<BuiltPdfReport | null> {
  const [settings, income] = await Promise.all([
    getFirmSettings(userId),
    prisma.income.findFirst({
      where: { id: incomeId, userId, deletedAt: null, client: { deletedAt: null, archivedAt: null } },
      include: {
        client: { select: { name: true } },
        caseFile: { select: { title: true, fileNumber: true, deletedAt: true, archivedAt: true, status: true } },
        cashAccount: { select: { name: true } }
      }
    })
  ]);

  if (!income || (income.caseFile && (income.caseFile.deletedAt || income.caseFile.archivedAt || income.caseFile.status === "ARCHIVED"))) {
    return null;
  }

  return {
    filename: datedPdfFilename("tahsilat-ozet"),
    input: baseInput(settings, {
      title: "Tahsilat Makbuz / Özet PDF",
      subtitle: income.client.name,
      summaries: [
        summary("Tahsilat Tutarı", formatMoney(income.amount, income.currency), "green"),
        summary("Tarih", formatDate(income.date)),
        summary("Ödeme Yöntemi", paymentMethodLabels[income.paymentMethod]),
        summary("Kategori", incomeCategoryLabels[income.category])
      ],
      tables: [
        {
          title: "Tahsilat Detayı",
          headers: ["Alan", "Değer"],
          rows: [
            { Alan: "Müvekkil", Değer: income.client.name },
            { Alan: "Dosya", Değer: caseLabel(income.caseFile) },
            { Alan: "Kasa Hesabı", Değer: income.cashAccount?.name ?? "-" },
            { Alan: "Makbuz Kesildi", Değer: income.receiptIssued ? "Evet" : "Hayır" },
            { Alan: "Makbuz No", Değer: income.receiptNumber ?? "-" },
            { Alan: "Açıklama", Değer: income.description ?? "-" }
          ]
        }
      ]
    })
  };
}

export async function buildExpenseSummaryPdf(userId: string, expenseId: string): Promise<BuiltPdfReport | null> {
  const [settings, expense] = await Promise.all([
    getFirmSettings(userId),
    prisma.expense.findFirst({
      where: { id: expenseId, userId, deletedAt: null },
      include: {
        client: { select: { name: true, deletedAt: true, archivedAt: true } },
        caseFile: { select: { title: true, fileNumber: true, deletedAt: true, archivedAt: true, status: true } },
        cashAccount: { select: { name: true } }
      }
    })
  ]);

  if (
    !expense ||
    (expense.client && (expense.client.deletedAt || expense.client.archivedAt)) ||
    (expense.caseFile && (expense.caseFile.deletedAt || expense.caseFile.archivedAt || expense.caseFile.status === "ARCHIVED"))
  ) {
    return null;
  }

  return {
    filename: datedPdfFilename("gider-ozet"),
    input: baseInput(settings, {
      title: "Gider Özet PDF",
      subtitle: expense.client?.name ?? "Genel gider",
      summaries: [
        summary("Gider Tutarı", formatMoney(expense.amount, expense.currency), "rose"),
        summary("Tarih", formatDate(expense.date)),
        summary("Ödeme Yöntemi", paymentMethodLabels[expense.paymentMethod]),
        summary("Kategori", expenseCategoryLabels[expense.category])
      ],
      tables: [
        {
          title: "Gider Detayı",
          headers: ["Alan", "Değer"],
          rows: [
            { Alan: "Müvekkil", Değer: expense.client?.name ?? "-" },
            { Alan: "Dosya", Değer: caseLabel(expense.caseFile) },
            { Alan: "Kasa Hesabı", Değer: expense.cashAccount?.name ?? "-" },
            { Alan: "Müvekkile Yansıtılabilir", Değer: expense.isClientExpense ? "Evet" : "Hayır" },
            { Alan: "Açıklama", Değer: expense.description ?? "-" }
          ]
        }
      ]
    })
  };
}

export async function buildMonthlyFinancePdf(userId: string, filters: ReportFilters): Promise<BuiltPdfReport> {
  const [settings, report] = await Promise.all([
    getFirmSettings(userId),
    buildFinancialReport(userId, { ...filters, type: "monthly" })
  ]);
  const normalized = normalizeReportFilters({ ...filters, type: "monthly" });
  const monthDate = normalized.endDate ? new Date(`${normalized.endDate}T12:00:00+03:00`) : new Date();

  return {
    filename: datedPdfFilename("aylik-finans", monthDate, "month"),
    input: baseInput(settings, {
      title: "Aylık Finans Raporu",
      subtitle: report.title,
      period: reportPeriodLabel(normalized),
      summaries: report.summaries,
      tables: [
        {
          title: "Aylık Gelir / Gider Tablosu",
          headers: report.headers,
          rows: report.rows
        }
      ],
      notes: [`Rapor aralığı: ${reportRangeLabels[normalized.range]}`]
    })
  };
}

export async function buildCashMovementsPdf(userId: string, filters: PdfFilterInput): Promise<BuiltPdfReport> {
  const cashFilters: CashReportFilters = {
    userId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    cashAccountId: filters.cashAccountId,
    clientId: filters.clientId,
    caseFileId: filters.caseFileId
  };
  const [settings, cashReport, accountReport] = await Promise.all([
    getFirmSettings(userId),
    getCashFlowReport(cashFilters),
    getAccountBasedReport(cashFilters)
  ]);

  return {
    filename: datedPdfFilename("kasa-hareketleri"),
    input: baseInput(settings, {
      title: "Kasa Hareketleri Raporu",
      subtitle: "Dijital kasa giriş, çıkış, transfer ve düzeltme hareketleri",
      period: reportPeriodLabel(filters),
      summaries: [
        summary("Toplam Giriş", cashReport.summary.cashInLabel, "green"),
        summary("Toplam Çıkış", cashReport.summary.cashOutLabel, "rose"),
        summary("Net Nakit Akışı", cashReport.summary.netLabel, cashReport.summary.net >= 0 ? "green" : "rose"),
        summary("Hareket", String(cashReport.rows.length))
      ],
      tables: [
        {
          title: "Hesap Bazlı Özet",
          headers: ["Kasa Hesabı", "Giriş", "Çıkış", "Net", "Hareket"],
          rows: accountReport.map((row) => ({
            "Kasa Hesabı": row.account,
            Giriş: row.cashInLabel,
            Çıkış: row.cashOutLabel,
            Net: row.netLabel,
            Hareket: String(row.movementCount)
          }))
        },
        {
          title: "Kasa Hareketleri",
          headers: ["Tarih", "Kasa", "Tip", "Yön", "Müvekkil", "Açıklama", "Tutar"],
          rows: cashReport.rows.map((row) => ({
            Tarih: row.date,
            Kasa: row.account,
            Tip: row.entryType,
            Yön: row.direction === "IN" ? cashLedgerDirectionLabels.IN : cashLedgerDirectionLabels.OUT,
            Müvekkil: row.client || "-",
            Açıklama: row.description || row.caseFile || "-",
            Tutar: row.signedAmountLabel
          }))
        }
      ],
      notes: ["Transfer hareketleri kasa akışında görünür; gelir/gider raporu toplamlarını resmi tahsilat/gider kayıtları belirler."]
    })
  };
}

export async function buildAdvancesPdf(userId: string, filters: PdfFilterInput): Promise<BuiltPdfReport> {
  const settings = await getFirmSettings(userId);
  const includeReceived = filters.direction !== "SPENT";
  const includeSpent = filters.direction !== "RECEIVED";
  const receivedWhere = includeReceived ? applyAdvanceIncomePdfFilters(baseAdvanceIncomePdfWhere(userId), filters) : { userId, id: "__never__" };
  const spentWhere = includeSpent ? applyAdvanceExpensePdfFilters(baseAdvanceExpensePdfWhere(userId), filters) : { userId, id: "__never__" };
  const [receivedRows, spentRows, receivedCount, spentCount, receivedTotal, spentTotal, missingReceivedCount, missingSpentCount] = await Promise.all([
    prisma.income.findMany({
      where: receivedWhere,
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true, attachedDocuments: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
      take: 500
    }),
    prisma.expense.findMany({
      where: spentWhere,
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true, attachedDocuments: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
      take: 500
    }),
    prisma.income.count({ where: receivedWhere }),
    prisma.expense.count({ where: spentWhere }),
    prisma.income.aggregate({ where: receivedWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: spentWhere, _sum: { amount: true } }),
    prisma.income.count({ where: applyAdvanceIncomePdfFilters(baseAdvanceIncomePdfWhere(userId), { ...filters, documentStatus: "MISSING_DOCUMENT" }) }),
    prisma.expense.count({ where: applyAdvanceExpensePdfFilters(baseAdvanceExpensePdfWhere(userId), { ...filters, documentStatus: "MISSING_DOCUMENT" }) })
  ]);

  const receivedTotalAmount = receivedTotal._sum.amount ?? new Prisma.Decimal(0);
  const spentTotalAmount = spentTotal._sum.amount ?? new Prisma.Decimal(0);
  const balance = receivedTotalAmount.minus(spentTotalAmount);
  const rows = [
    ...receivedRows.map((row) => ({
      date: row.date,
      Tarih: formatDate(row.date),
      Müvekkil: row.client.name,
      Dosya: caseLabel(row.caseFile),
      Açıklama: row.description ?? "-",
      Yön: advanceDirectionLabels.RECEIVED,
      Tutar: formatSignedMoney(row.amount, row.currency),
      Belge: row.attachedDocuments.length > 0 ? "Var" : "Yok"
    })),
    ...spentRows.map((row) => ({
      date: row.date,
      Tarih: formatDate(row.date),
      Müvekkil: row.client?.name ?? "-",
      Dosya: caseLabel(row.caseFile),
      Açıklama: row.description ?? "-",
      Yön: advanceDirectionLabels.SPENT,
      Tutar: formatSignedMoney(-Math.abs(toNumber(row.amount)), row.currency),
      Belge: row.attachedDocuments.length > 0 ? "Var" : "Yok"
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 500)
    .map((row) => ({
      Tarih: row.Tarih,
      Müvekkil: row.Müvekkil,
      Dosya: row.Dosya,
      Açıklama: row.Açıklama,
      Yön: row.Yön,
      Tutar: row.Tutar,
      Belge: row.Belge
    }));
  const totalRows = receivedCount + spentCount;
  const truncated = totalRows > rows.length;

  return {
    filename: datedPdfFilename("masraf-avanslari"),
    input: baseInput(settings, {
      title: "Masraf Avansları Raporu",
      subtitle: "Müvekkil ve dosya bazlı alınan/harcanan masraf avansları",
      period: reportPeriodLabel(filters),
      summaries: [
        summary("Toplam Alınan", formatMoney(receivedTotalAmount), "green"),
        summary("Toplam Harcanan", formatMoney(spentTotalAmount), "rose"),
        summary("Kullanılabilir Bakiye", formatSignedMoney(balance), toNumber(balance) >= 0 ? "green" : "rose"),
        summary("Hareket Sayısı", String(totalRows)),
        summary("Belgesiz Hareket", String(missingReceivedCount + missingSpentCount), missingReceivedCount + missingSpentCount > 0 ? "amber" : "neutral")
      ],
      tables: [
        {
          title: "Masraf Avansı Hareketleri",
          headers: ["Tarih", "Müvekkil", "Dosya", "Açıklama", "Yön", "Tutar", "Belge"],
          rows
        }
      ],
      notes: [
        "Bu PDF özel rapor route'u üzerinden üretilir; uygulama ekranındaki navigasyon, drawer ve interaktif aksiyonlar PDF'e basılmaz.",
        "Tablolar kontrollü PDF yerleşimiyle sayfalara bölünür; header/footer ve sayfa numarası otomatik eklenir.",
        truncated ? `Filtre ${totalRows} hareket döndürdü. Performans için PDF çıktısı ilk ${rows.length} satırla sınırlandı.` : "Seçilen filtredeki tüm hareketler PDF'e dahil edildi."
      ]
    })
  };
}

export async function buildCapitalPdf(userId: string): Promise<BuiltPdfReport> {
  const [settings, capital] = await Promise.all([getFirmSettings(userId), getCapitalCenterData(userId)]);

  return {
    filename: datedPdfFilename("sermaye-varlik"),
    input: baseInput(settings, {
      title: "Sermaye / Varlık Raporu",
      subtitle: "V3 sermaye ve varlık merkezi",
      summaries: [
        summary("Toplam Varlık", capital.summary.totalAssetsLabel, "green"),
        summary("Toplam Borç", capital.summary.totalDebtsLabel, "rose"),
        summary("Net Sermaye", capital.summary.netWorthLabel, capital.summary.netWorth >= 0 ? "green" : "rose"),
        summary("Nakit/Banka", capital.summary.cashBankTotalLabel, "green"),
        summary("Volatil Oran", `%${capital.summary.volatileRatio.toLocaleString("tr-TR")}`, "amber")
      ],
      tables: [
        {
          title: "Varlık Dağılımı",
          headers: ["Tür", "Toplam"],
          rows: capital.assetTypeDistribution.map((row) => ({
            Tür: row.label,
            Toplam: formatMoney(row.value, capital.currency)
          }))
        },
        {
          title: "Son Değerlemeler",
          headers: ["Tarih", "Varlık", "Tür", "Toplam Değer", "Kaynak"],
          rows: capital.latestValuations.slice(0, 60).map((row) => ({
            Tarih: row.valuationDateLabel,
            Varlık: row.assetName,
            Tür: row.assetTypeLabel,
            "Toplam Değer": row.totalValueLabel,
            Kaynak: row.source
          }))
        },
        {
          title: "Varlık Listesi",
          headers: ["Varlık", "Tür", "Sembol", "Miktar", "Birim Fiyat", "Toplam Değer", "Para Birimi"],
          rows: capital.assets.map((row) => ({
            Varlık: row.name,
            Tür: row.assetTypeLabel,
            Sembol: row.symbol || row.currency || "-",
            Miktar: row.quantity?.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) ?? "-",
            "Birim Fiyat": row.unitPrice != null ? formatMoney(row.unitPrice, row.valuationCurrency) : "-",
            "Toplam Değer": row.currentValueLabel,
            "Para Birimi": row.valuationCurrency
          }))
        }
      ],
      notes: [
        "Bu çıktı yatırım tavsiyesi değildir; yalnızca sistem kayıtlarına göre hazırlanır.",
        "Canlı fiyat entegrasyonu yoktur. Değerler manuel veya sistem kayıtlarına göre hesaplanır."
      ]
    })
  };
}

export async function buildV3DocumentPdf(userId: string, filters: PdfFilterInput): Promise<BuiltPdfReport> {
  const [settings, data] = await Promise.all([getFirmSettings(userId), buildV3ReportsData(userId, filters)]);
  const report = data.documentReport;

  return {
    filename: datedPdfFilename("belge-raporu"),
    input: baseInput(settings, {
      title: "Belge Raporu",
      subtitle: "Yüklenen belgeler, bağlı/bağsız durum ve belgesiz finans kayıtları",
      period: reportPeriodLabel(filters),
      summaries: report.metrics.map(v3Summary),
      tables: [
        {
          title: "Belge Türü Dağılımı",
          headers: ["Tür", "Adet", "Oran"],
          rows: report.documentTypeDistribution.map((row) => ({
            Tür: row.label,
            Adet: row.valueLabel,
            Oran: `%${row.percent.toLocaleString("tr-TR")}`
          }))
        },
        ...report.tables.map((table) => ({
          title: table.title,
          headers: table.headers,
          rows: table.rows.slice(0, 80)
        }))
      ],
      notes: [
        "Silinen belgeler ve silinen finans kayıtları bu rapora dahil edilmez.",
        "PDF çıktı büyük veri durumunda ilk 80 satırla sınırlandırılır."
      ]
    })
  };
}

export async function buildV3BankStatementPdf(userId: string, filters: PdfFilterInput): Promise<BuiltPdfReport> {
  const [settings, data] = await Promise.all([getFirmSettings(userId), buildV3ReportsData(userId, filters)]);
  const report = data.bankStatementReport;

  return {
    filename: datedPdfFilename("banka-ekstresi-v3-analiz"),
    input: baseInput(settings, {
      title: "Banka Ekstresi Analiz Raporu",
      subtitle: "Son 12 ay giriş/çıkış, kategori, düzenli ödeme ve mutabakat özeti",
      period: "Son 12 ay",
      summaries: report.metrics.map(v3Summary),
      tables: [
        {
          title: "Son 12 Ay Giriş / Çıkış",
          headers: ["Ay", "Giriş", "Çıkış", "Net"],
          rows: report.monthlyCashFlow.map((row) => ({
            Ay: row.label,
            Giriş: formatSignedMoney(row.tahsilat),
            Çıkış: formatSignedMoney(-row.gider),
            Net: formatSignedMoney(row.net)
          }))
        },
        {
          title: "Gelir Kaynak Dağılımı",
          headers: ["Kategori", "Toplam", "Oran"],
          rows: report.incomeDistribution.map((row) => ({
            Kategori: row.label,
            Toplam: row.valueLabel,
            Oran: `%${row.percent.toLocaleString("tr-TR")}`
          }))
        },
        {
          title: "Gider Kategori Dağılımı",
          headers: ["Kategori", "Toplam", "Oran"],
          rows: report.expenseDistribution.map((row) => ({
            Kategori: row.label,
            Toplam: row.valueLabel,
            Oran: `%${row.percent.toLocaleString("tr-TR")}`
          }))
        },
        ...report.tables.map((table) => ({
          title: table.title,
          headers: table.headers,
          rows: table.rows.slice(0, 80)
        }))
      ],
      notes: [
        "Duplicate banka satırları rapora dahil edilmez.",
        "Bu rapor bankadan canlı veri çekmez; yüklenen ekstrelerden üretilir.",
        "PDF çıktı büyük veri durumunda ilk 80 satırla sınırlandırılır."
      ]
    })
  };
}

export async function buildV3ReconciliationPdf(userId: string, filters: PdfFilterInput): Promise<BuiltPdfReport> {
  const [settings, data] = await Promise.all([getFirmSettings(userId), buildV3ReportsData(userId, filters)]);
  const report = data.reconciliationReport;

  return {
    filename: datedPdfFilename("mutabakat-raporu"),
    input: baseInput(settings, {
      title: "Mutabakat Raporu",
      subtitle: "Banka bakiyesi, sistem bakiyesi, fark ve eşleşmeyen hareketler",
      period: reportPeriodLabel(filters),
      summaries: report.metrics.map(v3Summary),
      tables: [
        {
          title: "Önerilen Aksiyonlar",
          headers: ["Aksiyon"],
          rows: report.suggestedActions.map((action) => ({ Aksiyon: action }))
        },
        ...report.tables.map((table) => ({
          title: table.title,
          headers: table.headers,
          rows: table.rows.slice(0, 80)
        }))
      ],
      notes: [
        "Kullanıcı onayı olmadan otomatik kasa düzeltmesi yapılmaz.",
        "Transferler gelir/gider toplamlarını şişirmeyecek şekilde ayrı değerlendirilir."
      ]
    })
  };
}

export async function buildBankAnalysisPdf(userId: string, analysisId: string): Promise<BuiltPdfReport> {
  const [settings, bankImport] = await Promise.all([
    getFirmSettings(userId),
    prisma.bankStatementImport.findFirst({
      where: { id: analysisId, userId, deletedAt: null },
      include: {
        cashAccount: { select: { name: true } },
        rows: {
          where: { deletedAt: null },
          orderBy: { rowNumber: "asc" },
          include: {
            clientSuggestion: { select: { name: true } },
            caseFileSuggestion: { select: { title: true, fileNumber: true } },
            matchedCashLedgerEntry: { select: { description: true } }
          },
          take: 500
        }
      }
    })
  ]);

  if (bankImport) {
    const cashIn = bankImport.rows
      .filter((row) => row.status === "SUCCESS" && row.direction === "IN")
      .reduce((total, row) => total + Math.abs(toNumber(row.amount)), 0);
    const cashOut = bankImport.rows
      .filter((row) => row.status === "SUCCESS" && row.direction === "OUT")
      .reduce((total, row) => total + Math.abs(toNumber(row.amount)), 0);
    const net = cashIn - cashOut;

    return {
      filename: datedPdfFilename("banka-ekstresi-analiz"),
      input: baseInput(settings, {
        title: "Banka Ekstresi Analiz Raporu",
        subtitle: `${bankImport.bankName} - ${bankImport.originalFileName}`,
        period: `${formatDate(bankImport.periodStart)} - ${formatDate(bankImport.periodEnd)}`,
        summaries: [
          summary("Toplam Giriş", formatSignedMoney(cashIn, bankImport.currency), "green"),
          summary("Toplam Çıkış", formatSignedMoney(-cashOut, bankImport.currency), "rose"),
          summary("Net Akış", formatSignedMoney(net, bankImport.currency), net >= 0 ? "green" : "rose"),
          summary("Başarılı Satır", String(bankImport.successfulRows), "green"),
          summary("Hatalı Satır", String(bankImport.failedRows), bankImport.failedRows > 0 ? "rose" : "neutral"),
          summary("Duplicate Satır", String(bankImport.duplicateRows), "amber")
        ],
        tables: [
          {
            title: "Ekstre Bilgileri",
            headers: ["Alan", "Değer"],
            rows: [
              { Alan: "Banka", Değer: bankImport.bankName },
              { Alan: "Kasa/Banka Hesabı", Değer: bankImport.cashAccount?.name ?? "-" },
              { Alan: "Kaynak", Değer: bankImport.sourceType },
              { Alan: "Para Birimi", Değer: bankImport.currency },
              { Alan: "Açılış Bakiyesi", Değer: bankImport.openingBalance ? formatMoney(bankImport.openingBalance, bankImport.currency) : "-" },
              { Alan: "Kapanış Bakiyesi", Değer: bankImport.closingBalance ? formatMoney(bankImport.closingBalance, bankImport.currency) : "-" }
            ]
          },
          {
            title: "Satır Analizi",
            headers: ["#", "Tarih", "Açıklama", "Yön", "Tutar", "Kategori", "Müvekkil", "Durum"],
            rows: bankImport.rows.map((row) => ({
              "#": String(row.rowNumber),
              Tarih: formatDate(row.transactionDate),
              Açıklama: row.description,
              Yön: row.direction === "IN" ? "Giriş" : row.direction === "OUT" ? "Çıkış" : "Nötr",
              Tutar: row.amount ? formatSignedMoney(row.amount, row.currency) : "-",
              Kategori: row.categorySuggestion ?? "-",
              Müvekkil: row.clientSuggestion?.name ?? "-",
              Durum: row.status === "SUCCESS" ? "Başarılı" : row.status === "DUPLICATE" ? "Duplicate" : row.errorMessage ?? "Hatalı"
            }))
          }
        ],
        notes: ["Bu rapor bankadan canlı veri çekmez; yüklenen ekstre ve sistem kayıtlarına göre oluşturulur."]
      })
    };
  }

  return {
    filename: datedPdfFilename("banka-ekstresi-analiz"),
    input: baseInput(settings, {
      title: "Banka Ekstresi Analiz Raporu",
      subtitle: `Analiz kaydı: ${analysisId}`,
      summaries: [
        summary("Durum", "Altyapı hazır", "blue"),
        summary("Eşleşen Hareket", "0"),
        summary("Eşleşmeyen Hareket", "0")
      ],
      tables: [
        {
          title: "Analiz Özeti",
          headers: ["Alan", "Değer"],
          rows: [
            { Alan: "Banka ekstresi yükleme", Değer: "V3 fazında CSV/XLSX/PDF ayrıştırma ile beslenecek" },
            { Alan: "Mutabakat", Değer: "Kasa hareketleri ile eşleştirme altyapısına bağlanacak" },
            { Alan: "Güvenlik", Değer: "Rapor yalnızca oturum açmış kullanıcı için üretilir" }
          ]
        }
      ],
      notes: ["Bu rapor bankadan canlı veri çekmez; V3 banka ekstresi analiz kayıtları eklendiğinde otomatik doldurulur."]
    })
  };
}

function baseInput(
  settings: Awaited<ReturnType<typeof getFirmSettings>>,
  input: Omit<PdfReportInput, "firmName" | "ownerName" | "reportDate">
): PdfReportInput {
  return {
    firmName: settings.firmName,
    ownerName: settings.ownerName,
    reportDate: formatDate(new Date()),
    ...input
  };
}

function summary(label: string, value: string, tone: PdfSummaryItem["tone"] = "neutral"): PdfSummaryItem {
  return { label, value, tone };
}

function v3Summary(metric: V3Metric): PdfSummaryItem {
  return { label: metric.label, value: metric.value, tone: metric.tone };
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function caseLabel(caseFile: { title: string; fileNumber?: string | null } | null) {
  if (!caseFile) return "-";
  return `${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`;
}

function reportPeriodLabel(filters: Pick<PdfFilterInput, "startDate" | "endDate">) {
  if (filters.startDate && filters.endDate) {
    return `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`;
  }

  if (filters.startDate) {
    return `${formatDate(filters.startDate)} sonrası`;
  }

  if (filters.endDate) {
    return `${formatDate(filters.endDate)} öncesi`;
  }

  return "Tüm dönem";
}

function baseAdvanceIncomePdfWhere(userId: string): Prisma.IncomeWhereInput {
  return {
    userId,
    deletedAt: null,
    category: "ADVANCE",
    client: { archivedAt: null, deletedAt: null },
    OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
  };
}

function baseAdvanceExpensePdfWhere(userId: string): Prisma.ExpenseWhereInput {
  return {
    userId,
    deletedAt: null,
    isClientExpense: true,
    AND: [
      { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
      { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
    ]
  };
}

function applyAdvanceIncomePdfFilters(baseWhere: Prisma.IncomeWhereInput, filters: PdfFilterInput): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = { ...baseWhere };
  const andFilters: Prisma.IncomeWhereInput[] = [];
  const date = pdfDateFilter(filters);
  const amount = pdfAmountFilter(filters);

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.caseFileId) where.caseFileId = filters.caseFileId;
  if (date) where.date = date;
  if (amount) where.amount = amount;
  if (filters.documentStatus === "WITH_DOCUMENT") andFilters.push({ attachedDocuments: { some: { deletedAt: null } } });
  if (filters.documentStatus === "MISSING_DOCUMENT") {
    andFilters.push({ attachedDocuments: { none: { deletedAt: null } }, documentNotRequired: false });
  }

  return appendPdfAndFilters(where, andFilters);
}

function applyAdvanceExpensePdfFilters(baseWhere: Prisma.ExpenseWhereInput, filters: PdfFilterInput): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { ...baseWhere };
  const andFilters: Prisma.ExpenseWhereInput[] = [];
  const date = pdfDateFilter(filters);
  const amount = pdfAmountFilter(filters);

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.caseFileId) where.caseFileId = filters.caseFileId;
  if (date) where.date = date;
  if (amount) where.amount = amount;
  if (filters.documentStatus === "WITH_DOCUMENT") andFilters.push({ attachedDocuments: { some: { deletedAt: null } } });
  if (filters.documentStatus === "MISSING_DOCUMENT") {
    andFilters.push({ attachedDocuments: { none: { deletedAt: null } }, documentNotRequired: false });
  }

  return appendPdfAndFilters(where, andFilters);
}

function pdfDateFilter(filters: PdfFilterInput): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (filters.startDate) range.gte = new Date(`${filters.startDate}T00:00:00.000+03:00`);
  if (filters.endDate) range.lte = new Date(`${filters.endDate}T23:59:59.999+03:00`);
  return Object.keys(range).length > 0 ? range : undefined;
}

function pdfAmountFilter(filters: PdfFilterInput): Prisma.DecimalFilter | undefined {
  const range: Prisma.DecimalFilter = {};
  if (filters.minAmount) range.gte = filters.minAmount;
  if (filters.maxAmount) range.lte = filters.maxAmount;
  return Object.keys(range).length > 0 ? range : undefined;
}

function appendPdfAndFilters<T extends { AND?: unknown }>(where: T, andFilters: T[]) {
  if (andFilters.length === 0) return where;
  const existing = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  return { ...where, AND: [...existing, ...andFilters] };
}

function clean(value: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
}
