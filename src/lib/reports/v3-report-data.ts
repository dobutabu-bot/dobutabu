import type { AssetType, BankStatementDirection, DocumentType } from "@prisma/client";

import { categorizeTransaction, type TransactionRuleInput } from "@/lib/bank-analysis/categorize-transaction";
import { getAllCashAccountBalances } from "@/lib/cash/cash-account-service";
import { getCapitalCenterData } from "@/lib/capital/capital-data";
import { documentExtractionStatusLabels, documentTypeLabels } from "@/lib/document-labels";
import { assetTypeLabels, expenseCategoryLabels, incomeCategoryLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { isClosedBankMatch } from "@/lib/reconciliation/match-status";
import { addMonths, dateInputValue, endOfDateInput, formatDate, formatMoney, formatSignedMoney, parseDateInput, startOfMonth, toNumber } from "@/lib/utils";

export type V3ReportFilters = {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  caseFileId?: string;
};

export type V3Metric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "green" | "rose" | "amber" | "blue";
};

export type V3SeriesPoint = {
  label: string;
  value: number;
  valueLabel: string;
  percent: number;
  tone?: V3Metric["tone"];
};

export type V3ReportTable = {
  title: string;
  description: string;
  headers: string[];
  rows: Record<string, string>[];
  empty: string;
};

export type V3ReportsData = {
  documentReport: {
    metrics: V3Metric[];
    documentTypeDistribution: V3SeriesPoint[];
    linkDistribution: V3SeriesPoint[];
    tables: V3ReportTable[];
  };
  bankStatementReport: {
    metrics: V3Metric[];
    monthlyCashFlow: { label: string; tahsilat: number; gider: number; net: number }[];
    incomeDistribution: V3SeriesPoint[];
    expenseDistribution: V3SeriesPoint[];
    tables: V3ReportTable[];
  };
  reconciliationReport: {
    metrics: V3Metric[];
    statusTone: V3Metric["tone"];
    suggestedActions: string[];
    tables: V3ReportTable[];
  };
  capitalReport: {
    metrics: V3Metric[];
    assetDistribution: V3SeriesPoint[];
    currencyDistribution: V3SeriesPoint[];
    tables: V3ReportTable[];
  };
};

const BANK_ROW_LIMIT = 10000;
const TABLE_ROW_LIMIT = 20;
const HIGH_BANK_TRANSACTION_LIMIT = 10000;

export async function buildV3ReportsData(userId: string, filters: V3ReportFilters): Promise<V3ReportsData> {
  const [documentReport, bankStatementReport, reconciliationReport, capitalReport] = await Promise.all([
    buildDocumentReport(userId, filters),
    buildBankStatementReport(userId, filters),
    buildReconciliationReport(userId, filters),
    buildCapitalReport(userId)
  ]);

  return {
    documentReport,
    bankStatementReport,
    reconciliationReport,
    capitalReport
  };
}

async function buildDocumentReport(userId: string, filters: V3ReportFilters): Promise<V3ReportsData["documentReport"]> {
  const bounds = dateBounds(filters);
  const [documents, undocumentedIncomes, undocumentedExpenses] = await Promise.all([
    prisma.document.findMany({
      where: {
        userId,
        deletedAt: null,
        uploadedAt: { gte: bounds.start, lte: bounds.end },
        ...documentScopeWhere(filters)
      },
      orderBy: { uploadedAt: "desc" },
      include: {
        linkedClient: { select: { name: true } },
        linkedCaseFile: { select: { title: true, fileNumber: true } }
      },
      take: 500
    }),
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        date: { gte: bounds.start, lte: bounds.end },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {}),
        attachedDocuments: { none: { deletedAt: null } },
        client: { deletedAt: null, archivedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }]
      },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: 200
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        date: { gte: bounds.start, lte: bounds.end },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {}),
        attachedDocuments: { none: { deletedAt: null } },
        AND: [
          { OR: [{ clientId: null }, { client: { deletedAt: null, archivedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } } }] }
        ]
      },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: 200
    })
  ]);

  const linkedDocuments = documents.filter(isLinkedDocument).length;
  const unlinkedDocuments = documents.length - linkedDocuments;
  const waitingProcessing = documents.filter((row) => ["NOT_PROCESSED", "PROCESSING"].includes(row.extractionStatus)).length;

  return {
    metrics: [
      metric("Yüklenen Belge", String(documents.length), "Seçilen tarih aralığında", "blue"),
      metric("Bağlı Belge", String(linkedDocuments), "Müvekkil, dosya veya finans kaydına bağlı", "green"),
      metric("Bağsız Belge", String(unlinkedDocuments), "Eşleştirme bekleyen belge", unlinkedDocuments > 0 ? "amber" : "green"),
      metric("İşlem Bekleyen", String(waitingProcessing), "Metin çıkarma kuyruğunda", waitingProcessing > 0 ? "amber" : "green"),
      metric("Belgesiz Tahsilat", String(undocumentedIncomes.length), "Dekont/makbuz bağlantısı olmayan", undocumentedIncomes.length > 0 ? "amber" : "green"),
      metric("Belgesiz Gider", String(undocumentedExpenses.length), "Fiş/fatura bağlantısı olmayan", undocumentedExpenses.length > 0 ? "rose" : "green")
    ],
    documentTypeDistribution: distributionByDocumentType(documents),
    linkDistribution: documentLinkDistribution(linkedDocuments, unlinkedDocuments),
    tables: [
      {
        title: "Yüklenen Belgeler",
        description: "Seçilen dönemde yüklenen son belgeler",
        headers: ["Tarih", "Başlık", "Tür", "Müvekkil", "Dosya", "Tutar", "İşleme Durumu"],
        rows: documents.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: formatDate(row.uploadedAt),
          Başlık: row.title,
          Tür: documentTypeLabels[row.documentType],
          Müvekkil: row.linkedClient?.name ?? "-",
          Dosya: caseLabel(row.linkedCaseFile),
          Tutar: row.amount ? formatMoney(row.amount, row.currency) : "-",
          "İşleme Durumu": documentExtractionStatusLabels[row.extractionStatus]
        })),
        empty: "Seçilen aralıkta belge yok"
      },
      {
        title: "Belgesiz Tahsilatlar",
        description: "Dekont veya makbuz bağlantısı olmayan tahsilatlar",
        headers: ["Tarih", "Müvekkil", "Dosya", "Kategori", "Tutar"],
        rows: undocumentedIncomes.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: formatDate(row.date),
          Müvekkil: row.client.name,
          Dosya: caseLabel(row.caseFile),
          Kategori: incomeCategoryLabels[row.category],
          Tutar: formatSignedMoney(row.amount, row.currency)
        })),
        empty: "Belgesiz tahsilat yok"
      },
      {
        title: "Belgesiz Giderler",
        description: "Fiş, fatura veya dekont bağlantısı olmayan giderler",
        headers: ["Tarih", "Müvekkil", "Dosya", "Kategori", "Tutar"],
        rows: undocumentedExpenses.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: formatDate(row.date),
          Müvekkil: row.client?.name ?? "-",
          Dosya: caseLabel(row.caseFile),
          Kategori: expenseCategoryLabels[row.category],
          Tutar: formatSignedMoney(-toNumber(row.amount), row.currency)
        })),
        empty: "Belgesiz gider yok"
      }
    ]
  };
}

async function buildBankStatementReport(userId: string, filters: V3ReportFilters): Promise<V3ReportsData["bankStatementReport"]> {
  const bounds = last12MonthBounds();
  const [rows, rules] = await Promise.all([
    prisma.bankStatementRow.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        transactionDate: { gte: bounds.start, lte: bounds.end },
        import: { deletedAt: null },
        ...bankScopeWhere(filters)
      },
      orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
      include: {
        import: { select: { bankName: true, originalFileName: true } },
        clientSuggestion: { select: { name: true } },
        caseFileSuggestion: { select: { title: true, fileNumber: true } }
      },
      take: BANK_ROW_LIMIT
    }),
    getTransactionRules(userId)
  ]);
  const categorizedRows = rows.map((row) => {
    const amount = Math.abs(resolveBankAmount(row));
    const category = categorizeTransaction({ description: row.description, direction: row.direction, amount }, rules);
    return { row, amount, category };
  });
  const totalIn = round(categorizedRows.filter((item) => item.row.direction === "IN").reduce((total, item) => total + item.amount, 0));
  const totalOut = round(categorizedRows.filter((item) => item.row.direction === "OUT").reduce((total, item) => total + item.amount, 0));
  const net = round(totalIn - totalOut);
  const unmatchedRows = categorizedRows.filter((item) => !isMatchedBankRow(item.row));
  const recurring = recurringTransactions(categorizedRows);
  const largeTransactions = categorizedRows
    .filter((item) => item.amount >= HIGH_BANK_TRANSACTION_LIMIT && item.row.direction !== "NEUTRAL")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TABLE_ROW_LIMIT);

  return {
    metrics: [
      metric("Son 12 Ay Giriş", formatSignedMoney(totalIn), `${categorizedRows.filter((item) => item.row.direction === "IN").length} banka hareketi`, "green"),
      metric("Son 12 Ay Çıkış", formatSignedMoney(-totalOut), `${categorizedRows.filter((item) => item.row.direction === "OUT").length} banka hareketi`, "rose"),
      metric("Net Nakit Akışı", formatSignedMoney(net), "Banka girişleri - çıkışları", net >= 0 ? "green" : "rose"),
      metric("Düzenli Ödeme", `${recurring.length} kalıp`, "Tekrarlayan açıklama/tutar desenleri", recurring.length > 0 ? "blue" : "neutral"),
      metric("Yüksek İşlem", `${largeTransactions.length} kayıt`, `${formatMoney(HIGH_BANK_TRANSACTION_LIMIT)} ve üzeri`, largeTransactions.length > 0 ? "amber" : "green"),
      metric("Eşleşmeyen", `${unmatchedRows.length} kayıt`, "Mutabakat bekleyen banka satırı", unmatchedRows.length > 0 ? "amber" : "green")
    ],
    monthlyCashFlow: monthlyBankFlow(categorizedRows, bounds.start),
    incomeDistribution: categoryDistribution(categorizedRows.filter((item) => item.category.group === "INCOME"), "green"),
    expenseDistribution: categoryDistribution(categorizedRows.filter((item) => item.category.group === "EXPENSE"), "rose"),
    tables: [
      {
        title: "Düzenli Ödemeler",
        description: "Benzer açıklama ve yönle tekrarlayan banka hareketleri",
        headers: ["Açıklama", "Yön", "Kategori", "Tekrar", "Toplam", "Ortalama"],
        rows: recurring.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Açıklama: row.label,
          Yön: row.direction === "IN" ? "Giriş" : "Çıkış",
          Kategori: row.category,
          Tekrar: String(row.count),
          Toplam: formatMoney(row.total),
          Ortalama: formatMoney(row.average)
        })),
        empty: "Düzenli ödeme kalıbı bulunmadı"
      },
      {
        title: "Yüksek Tutarlı İşlemler",
        description: "Son 12 ayda eşik üstündeki banka hareketleri",
        headers: ["Tarih", "Banka", "Açıklama", "Yön", "Kategori", "Tutar"],
        rows: largeTransactions.map(({ row, amount, category }) => ({
          Tarih: formatDate(row.transactionDate),
          Banka: row.import.bankName,
          Açıklama: row.description,
          Yön: row.direction === "IN" ? "Giriş" : "Çıkış",
          Kategori: category.category,
          Tutar: formatSignedMoney(row.direction === "OUT" ? -amount : amount, row.currency)
        })),
        empty: "Yüksek tutarlı hareket yok"
      },
      {
        title: "Eşleşmeyen Banka Hareketleri",
        description: "Sistemde tahsilat, gider veya kasa hareketiyle bağlantısı olmayan satırlar",
        headers: ["Tarih", "Banka", "Açıklama", "Yön", "Tutar", "Önerilen Kategori"],
        rows: unmatchedRows.slice(0, TABLE_ROW_LIMIT).map(({ row, amount, category }) => ({
          Tarih: formatDate(row.transactionDate),
          Banka: row.import.bankName,
          Açıklama: row.description,
          Yön: row.direction === "IN" ? "Giriş" : row.direction === "OUT" ? "Çıkış" : "Nötr",
          Tutar: formatSignedMoney(row.direction === "OUT" ? -amount : amount, row.currency),
          "Önerilen Kategori": category.category
        })),
        empty: "Eşleşmeyen banka hareketi yok"
      }
    ]
  };
}

async function buildReconciliationReport(userId: string, filters: V3ReportFilters): Promise<V3ReportsData["reconciliationReport"]> {
  const bounds = dateBounds(filters);
  const [rows, ledgerEntries, latestImports, cashBalances] = await Promise.all([
    prisma.bankStatementRow.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        transactionDate: { gte: bounds.start, lte: bounds.end },
        import: { deletedAt: null },
        ...bankScopeWhere(filters)
      },
      orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
      include: { import: { select: { bankName: true, cashAccountId: true, closingBalance: true, currency: true } } },
      take: BANK_ROW_LIMIT
    }),
    prisma.cashLedgerEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: bounds.start, lte: bounds.end },
        entryType: { not: "TRANSFER" },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.caseFileId ? { caseFileId: filters.caseFileId } : {})
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { cashAccount: { select: { name: true, currency: true } }, client: { select: { name: true } }, caseFile: { select: { title: true, fileNumber: true } } },
      take: BANK_ROW_LIMIT
    }),
    prisma.bankStatementImport.findMany({
      where: { userId, deletedAt: null, cashAccountId: { not: null }, closingBalance: { not: null } },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: { cashAccountId: true, closingBalance: true, currency: true },
      take: 200
    }),
    getAllCashAccountBalances(userId)
  ]);
  const matchedRows = rows.filter(isMatchedBankRow);
  const unmatchedRows = rows.filter((row) => !isMatchedBankRow(row) && row.matchType !== "IGNORED");
  const matchedLedgerIds = new Set(rows.map((row) => row.matchedCashLedgerEntryId).filter((id): id is string => Boolean(id)));
  const unmatchedSystemEntries = ledgerEntries.filter((row) => !matchedLedgerIds.has(row.id));
  const balance = latestBalanceComparison(latestImports, cashBalances);
  const statusTone = Math.abs(balance.difference) < 1 ? "green" : Math.abs(balance.difference) < 1000 ? "amber" : "rose";

  return {
    metrics: [
      metric("Banka Bakiyesi", balance.bankBalanceLabel, "Son kapanış bakiyesi olan ekstreler", "blue"),
      metric("Sistem Bakiyesi", balance.systemBalanceLabel, "Dijital kasa bakiyesi", balance.systemBalance >= 0 ? "green" : "rose"),
      metric("Fark", balance.differenceLabel, "Banka - sistem", statusTone),
      metric("Eşleşmiş", `${matchedRows.length} kayıt`, "Tahsilat/gider/kasa hareketiyle bağlı", "green"),
      metric("Eşleşmemiş Banka", `${unmatchedRows.length} kayıt`, "Sistemde karşılığı beklenen satırlar", unmatchedRows.length > 0 ? "amber" : "green"),
      metric("Eşleşmemiş Sistem", `${unmatchedSystemEntries.length} kayıt`, "Bankada karşılığı görünmeyen kasa hareketi", unmatchedSystemEntries.length > 0 ? "amber" : "green")
    ],
    statusTone,
    suggestedActions: reconciliationActions(unmatchedRows.length, unmatchedSystemEntries.length, balance.difference),
    tables: [
      {
        title: "Eşleşmemiş Banka Hareketleri",
        description: "Banka ekstresinde var, sistemde henüz eşleşmemiş",
        headers: ["Tarih", "Banka", "Açıklama", "Yön", "Tutar"],
        rows: unmatchedRows.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: formatDate(row.transactionDate),
          Banka: row.import.bankName,
          Açıklama: row.description,
          Yön: row.direction === "IN" ? "Giriş" : row.direction === "OUT" ? "Çıkış" : "Nötr",
          Tutar: formatSignedMoney(row.direction === "OUT" ? -Math.abs(resolveBankAmount(row)) : Math.abs(resolveBankAmount(row)), row.currency)
        })),
        empty: "Eşleşmemiş banka hareketi yok"
      },
      {
        title: "Eşleşmemiş Sistem Hareketleri",
        description: "Dijital kasada var, banka satırıyla eşleşmemiş",
        headers: ["Tarih", "Kasa", "Açıklama", "Yön", "Müvekkil", "Tutar"],
        rows: unmatchedSystemEntries.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: formatDate(row.date),
          Kasa: row.cashAccount.name,
          Açıklama: row.description ?? "-",
          Yön: row.direction === "IN" ? "Giriş" : "Çıkış",
          Müvekkil: row.client?.name ?? "-",
          Tutar: formatSignedMoney(row.direction === "OUT" ? -toNumber(row.amount) : toNumber(row.amount), row.currency)
        })),
        empty: "Eşleşmemiş sistem hareketi yok"
      }
    ]
  };
}

async function buildCapitalReport(userId: string): Promise<V3ReportsData["capitalReport"]> {
  const capital = await getCapitalCenterData(userId);

  return {
    metrics: [
      metric("Toplam Varlık", capital.summary.totalAssetsLabel, "Borçlar hariç brüt varlık", "green"),
      metric("Toplam Borç", capital.summary.totalDebtsLabel, "Net sermayeden düşülen borçlar", capital.summary.totalDebts > 0 ? "rose" : "green"),
      metric("Net Sermaye", capital.summary.netWorthLabel, "Varlık - borç", capital.summary.netWorth >= 0 ? "green" : "rose"),
      metric("Nakit/Banka", capital.summary.cashBankTotalLabel, `Nakit oranı %${capital.summary.cashRatio.toLocaleString("tr-TR")}`, "blue"),
      metric("Döviz/Altın/Borsa", formatMoney(capital.summary.fxTotal + capital.summary.goldTotal + capital.summary.stockTotal, capital.currency), "FX, altın, borsa/fon toplamı", "amber"),
      metric("Crypto", capital.summary.cryptoTotalLabel, "Manuel kayıtlı crypto varlıkları", capital.summary.cryptoTotal > 0 ? "neutral" : "blue")
    ],
    assetDistribution: capital.assetTypeDistribution.map((item) => ({
      label: item.label,
      value: item.value,
      valueLabel: formatMoney(item.value, capital.currency),
      percent: percent(item.value, capital.summary.totalAssets),
      tone: item.label === assetTypeLabels.DEBT ? "rose" : "green"
    })),
    currencyDistribution: capital.currencyDistribution.map((item) => ({
      label: item.label,
      value: item.value,
      valueLabel: formatMoney(item.value, item.label),
      percent: percent(item.value, capital.summary.totalAssets),
      tone: "blue"
    })),
    tables: [
      {
        title: "Varlık Dağılımı",
        description: "Tür bazlı toplam varlık kompozisyonu",
        headers: ["Tür", "Toplam", "Oran"],
        rows: capital.assetTypeDistribution.map((row) => ({
          Tür: row.label,
          Toplam: formatMoney(row.value, capital.currency),
          Oran: `%${percent(row.value, capital.summary.totalAssets).toLocaleString("tr-TR")}`
        })),
        empty: "Varlık dağılımı yok"
      },
      {
        title: "Varlık Değer Geçmişi",
        description: "Son değerleme kayıtları",
        headers: ["Tarih", "Varlık", "Tür", "Toplam Değer", "Kaynak"],
        rows: capital.latestValuations.slice(0, TABLE_ROW_LIMIT).map((row) => ({
          Tarih: row.valuationDateLabel,
          Varlık: row.assetName,
          Tür: assetTypeLabels[row.assetType as AssetType],
          "Toplam Değer": row.totalValueLabel,
          Kaynak: row.source
        })),
        empty: "Değerleme geçmişi yok"
      }
    ]
  };
}

function metric(label: string, value: string, detail: string, tone: V3Metric["tone"]): V3Metric {
  return { label, value, detail, tone };
}

function dateBounds(filters: V3ReportFilters) {
  return {
    start: filters.startDate ? parseDateInput(filters.startDate) : addMonths(startOfMonth(new Date()), -1),
    end: filters.endDate ? endOfDateInput(filters.endDate) : new Date()
  };
}

function last12MonthBounds() {
  const end = new Date();
  const start = addMonths(startOfMonth(end), -11);
  return { start, end };
}

function documentScopeWhere(filters: V3ReportFilters) {
  const AND = [];
  if (filters.clientId) {
    AND.push({
      OR: [
        { linkedClientId: filters.clientId },
        { linkedCaseFile: { clientId: filters.clientId } },
        { linkedIncome: { clientId: filters.clientId } },
        { linkedExpense: { clientId: filters.clientId } },
        { linkedInvoiceOrReceipt: { clientId: filters.clientId } },
        { linkedCashLedgerEntry: { clientId: filters.clientId } }
      ]
    });
  }
  if (filters.caseFileId) {
    AND.push({
      OR: [
        { linkedCaseFileId: filters.caseFileId },
        { linkedIncome: { caseFileId: filters.caseFileId } },
        { linkedExpense: { caseFileId: filters.caseFileId } },
        { linkedInvoiceOrReceipt: { caseFileId: filters.caseFileId } },
        { linkedCashLedgerEntry: { caseFileId: filters.caseFileId } }
      ]
    });
  }

  return AND.length > 0 ? { AND } : {};
}

function bankScopeWhere(filters: V3ReportFilters) {
  const AND = [];
  if (filters.clientId) {
    AND.push({
      OR: [
        { clientSuggestionId: filters.clientId },
        { matchedIncome: { clientId: filters.clientId } },
        { matchedExpense: { clientId: filters.clientId } },
        { matchedCashLedgerEntry: { clientId: filters.clientId } }
      ]
    });
  }
  if (filters.caseFileId) {
    AND.push({
      OR: [
        { caseFileSuggestionId: filters.caseFileId },
        { matchedIncome: { caseFileId: filters.caseFileId } },
        { matchedExpense: { caseFileId: filters.caseFileId } },
        { matchedCashLedgerEntry: { caseFileId: filters.caseFileId } }
      ]
    });
  }

  return AND.length > 0 ? { AND } : {};
}

async function getTransactionRules(userId: string): Promise<TransactionRuleInput[]> {
  return prisma.transactionRule.findMany({
    where: { userId, isActive: true, deletedAt: null },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      keyword: true,
      matchType: true,
      direction: true,
      category: true,
      targetGroup: true,
      amountMin: true,
      amountMax: true,
      confidence: true,
      clientId: true,
      caseFileId: true,
      cashAccountId: true
    }
  });
}

function isLinkedDocument(row: {
  linkedClientId: string | null;
  linkedCaseFileId: string | null;
  linkedIncomeId: string | null;
  linkedExpenseId: string | null;
  linkedInvoiceOrReceiptId: string | null;
  linkedCashLedgerEntryId: string | null;
}) {
  return Boolean(
    row.linkedClientId ||
      row.linkedCaseFileId ||
      row.linkedIncomeId ||
      row.linkedExpenseId ||
      row.linkedInvoiceOrReceiptId ||
      row.linkedCashLedgerEntryId
  );
}

function distributionByDocumentType(rows: { documentType: DocumentType }[]) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    grouped.set(documentTypeLabels[row.documentType], (grouped.get(documentTypeLabels[row.documentType]) ?? 0) + 1);
  }
  return countDistribution(grouped, rows.length);
}

function documentLinkDistribution(linked: number, unlinked: number) {
  return countDistribution(
    new Map([
      ["Bağlı", linked],
      ["Bağsız", unlinked]
    ]),
    linked + unlinked
  );
}

function countDistribution(grouped: Map<string, number>, total: number): V3SeriesPoint[] {
  return [...grouped.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      valueLabel: `${value.toLocaleString("tr-TR")} kayıt`,
      percent: total > 0 ? percent(value, total) : 0,
      tone: "blue"
    }));
}

function categoryDistribution(
  rows: { amount: number; category: { category: string; group: string } }[],
  tone: V3Metric["tone"]
): V3SeriesPoint[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    grouped.set(row.category.category, round((grouped.get(row.category.category) ?? 0) + row.amount));
  }
  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0);
  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value,
      valueLabel: formatMoney(value),
      percent: percent(value, total),
      tone
    }));
}

function monthlyBankFlow(
  rows: { row: { transactionDate: Date | null; direction: BankStatementDirection }; amount: number }[],
  start: Date
) {
  const months = new Map<string, { label: string; tahsilat: number; gider: number; net: number }>();
  for (let index = 0; index < 12; index += 1) {
    const date = addMonths(start, index);
    const key = dateInputValue(date).slice(0, 7);
    months.set(key, { label: monthLabel(date), tahsilat: 0, gider: 0, net: 0 });
  }

  for (const item of rows) {
    if (!item.row.transactionDate) continue;
    const key = dateInputValue(item.row.transactionDate).slice(0, 7);
    const current = months.get(key);
    if (!current) continue;
    if (item.row.direction === "IN") current.tahsilat = round(current.tahsilat + item.amount);
    if (item.row.direction === "OUT") current.gider = round(current.gider + item.amount);
    current.net = round(current.tahsilat - current.gider);
  }

  return [...months.values()];
}

function recurringTransactions(
  rows: {
    row: { direction: BankStatementDirection; description: string };
    amount: number;
    category: { category: string; group: string };
  }[]
) {
  const grouped = new Map<string, typeof rows>();
  for (const item of rows) {
    if (item.row.direction === "NEUTRAL" || item.category.group === "TRANSFER") continue;
    const key = `${item.row.direction}:${recurringKey(item.row.description)}:${item.category.category}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return [...grouped.values()]
    .filter((bucket) => bucket.length >= 2)
    .map((bucket) => {
      const total = bucket.reduce((sum, item) => sum + item.amount, 0);
      return {
        label: shortLabel(bucket[0]?.row.description ?? "Tekrarlayan işlem"),
        direction: bucket[0]?.row.direction ?? "NEUTRAL",
        category: bucket[0]?.category.category ?? "Diğer",
        count: bucket.length,
        total: round(total),
        average: round(total / bucket.length)
      };
    })
    .sort((a, b) => b.total - a.total);
}

function latestBalanceComparison(
  imports: { cashAccountId: string | null; closingBalance: unknown; currency: string }[],
  cashBalances: { accountId: string; balance: number; currency: string }[]
) {
  const latestByAccount = new Map<string, (typeof imports)[number]>();
  for (const item of imports) {
    if (item.cashAccountId && !latestByAccount.has(item.cashAccountId)) latestByAccount.set(item.cashAccountId, item);
  }
  const balanceMap = new Map(cashBalances.map((item) => [item.accountId, item]));
  const currency = [...latestByAccount.values()].find((item) => item.currency === "TRY")?.currency ?? cashBalances[0]?.currency ?? "TRY";
  let bankBalance = 0;
  let systemBalance = 0;

  for (const item of latestByAccount.values()) {
    const balance = item.cashAccountId ? balanceMap.get(item.cashAccountId) : null;
    if (!balance || balance.currency !== currency || item.currency !== currency) continue;
    bankBalance += toNumber(item.closingBalance);
    systemBalance += balance.balance;
  }

  const difference = round(bankBalance - systemBalance);
  return {
    bankBalance: round(bankBalance),
    bankBalanceLabel: formatMoney(bankBalance, currency),
    systemBalance: round(systemBalance),
    systemBalanceLabel: formatMoney(systemBalance, currency),
    difference,
    differenceLabel: formatSignedMoney(difference, currency)
  };
}

function reconciliationActions(unmatchedBank: number, unmatchedSystem: number, difference: number) {
  const actions = [];
  if (unmatchedBank > 0) actions.push("Eşleşmemiş banka hareketlerinden tahsilat/gider oluşturun veya var olan kayıtla eşleştirin.");
  if (unmatchedSystem > 0) actions.push("Bankada görünmeyen kasa hareketlerinin tarih ve açıklamalarını kontrol edin.");
  if (Math.abs(difference) >= 1) actions.push("Bakiye farkı devam ediyorsa manuel kasa düzeltmesini yalnızca kontrol sonrası kullanın.");
  if (actions.length === 0) actions.push("Seçilen kapsamda mutabakat dengeli görünüyor.");
  return actions;
}

function resolveBankAmount(row: { amount: unknown; debitAmount: unknown; creditAmount: unknown; direction: BankStatementDirection }) {
  const amount = toNumber(row.amount);
  if (amount !== 0) return amount;
  if (row.direction === "IN") return toNumber(row.creditAmount);
  if (row.direction === "OUT") return toNumber(row.debitAmount);
  return 0;
}

function isMatchedBankRow(row: {
  matchType: string;
  matchedIncomeId: string | null;
  matchedExpenseId: string | null;
  matchedCashLedgerEntryId: string | null;
}) {
  return isClosedBankMatch(row);
}

function caseLabel(caseFile: { title: string; fileNumber?: string | null } | null) {
  if (!caseFile) return "-";
  return `${caseFile.title}${caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""}`;
}

function recurringKey(description: string) {
  return description
    .toLocaleLowerCase("tr-TR")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 34);
}

function shortLabel(value: string, limit = 42) {
  const clean = value.trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: "Europe/Istanbul" }).format(date);
}

function percent(value: number, total: number) {
  return total > 0 ? round((value / total) * 100) : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
