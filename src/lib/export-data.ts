import {
  auditActionLabels,
  auditEntityLabels
} from "@/lib/audit";
import {
  assetTypeLabels,
  assetValuationSourceLabels,
  cashLedgerDirectionLabels,
  cashLedgerEntryTypeLabels,
  caseStatusLabels,
  clientTypeLabels,
  expenseCategoryLabels,
  incomeCategoryLabels,
  paymentMethodLabels,
  receiptStatusLabels,
  receiptTypeLabels
} from "@/lib/labels";
import { cashLedgerWhere } from "@/lib/cash/cash-ledger-service";
import { cashLedgerFiltersFromSearchParams } from "@/lib/cash/cash-ledger-query";
import { collectionFiltersFromSearchParams, collectionWhereFromFilters } from "@/lib/collection-query";
import { documentExtractionStatusLabels, documentTypeLabels } from "@/lib/document-labels";
import { expenseFiltersFromSearchParams, expenseWhereFromFilters } from "@/lib/expense-query";
import { receiptFiltersFromSearchParams, receiptWhereFromFilters } from "@/lib/receipt-query";
import { prisma } from "@/lib/prisma";
import { buildFinancialReport, normalizeReportFilters, reportFiltersFromSearchParams } from "@/lib/reporting";
import { buildV3ReportsData } from "@/lib/reports/v3-report-data";
import { formatDate, toNumber } from "@/lib/utils";

export type ExportData = {
  title: string;
  headers: string[];
  rows: unknown[][];
};

export async function buildExport(userId: string, resource: string, searchParams: URLSearchParams): Promise<ExportData> {
  const includeDeleted = searchParams.get("includeDeleted") === "1";

  if (resource === "reports") {
    const report = await buildFinancialReport(userId, reportFiltersFromSearchParams(searchParams));

    return {
      title: report.title,
      headers: report.headers,
      rows: report.rows.map((row) => report.headers.map((header) => row[header] ?? ""))
    };
  }

  if (resource === "v3Documents") {
    const data = await buildV3ReportsData(userId, normalizeReportFilters(reportFiltersFromSearchParams(searchParams)));
    return {
      title: "V3 Belge Raporu",
      headers: ["Rapor", "Tarih", "Başlık", "Tür", "Müvekkil", "Dosya", "Tutar", "Durum"],
      rows: data.documentReport.tables.flatMap((table) =>
        table.rows.map((row) => [
          table.title,
          row.Tarih ?? "",
          row.Başlık ?? row.Müvekkil ?? "",
          row.Tür ?? row.Kategori ?? "",
          row.Müvekkil ?? "",
          row.Dosya ?? "",
          row.Tutar ?? "",
          row["İşleme Durumu"] ?? ""
        ])
      )
    };
  }

  if (resource === "v3BankStatements") {
    const data = await buildV3ReportsData(userId, normalizeReportFilters(reportFiltersFromSearchParams(searchParams)));
    return {
      title: "V3 Banka Ekstresi Analiz Raporu",
      headers: ["Rapor", "Tarih", "Banka", "Açıklama", "Yön", "Kategori", "Tutar", "Ek"],
      rows: data.bankStatementReport.tables.flatMap((table) =>
        table.rows.map((row) => [
          table.title,
          row.Tarih ?? "",
          row.Banka ?? "",
          row.Açıklama ?? "",
          row.Yön ?? "",
          row.Kategori ?? row["Önerilen Kategori"] ?? "",
          row.Tutar ?? row.Toplam ?? "",
          row.Tekrar ?? row.Ortalama ?? ""
        ])
      )
    };
  }

  if (resource === "v3Reconciliation") {
    const data = await buildV3ReportsData(userId, normalizeReportFilters(reportFiltersFromSearchParams(searchParams)));
    return {
      title: "V3 Mutabakat Raporu",
      headers: ["Rapor", "Tarih", "Kasa/Banka", "Açıklama", "Yön", "Müvekkil", "Tutar"],
      rows: data.reconciliationReport.tables.flatMap((table) =>
        table.rows.map((row) => [
          table.title,
          row.Tarih ?? "",
          row.Banka ?? row.Kasa ?? "",
          row.Açıklama ?? "",
          row.Yön ?? "",
          row.Müvekkil ?? "",
          row.Tutar ?? ""
        ])
      )
    };
  }

  if (resource === "v3Capital") {
    const data = await buildV3ReportsData(userId, normalizeReportFilters(reportFiltersFromSearchParams(searchParams)));
    return {
      title: "V3 Sermaye Raporu",
      headers: ["Rapor", "Tarih", "Varlık/Tür", "Toplam", "Oran/Kaynak"],
      rows: data.capitalReport.tables.flatMap((table) =>
        table.rows.map((row) => [
          table.title,
          row.Tarih ?? "",
          row.Varlık ?? row.Tür ?? "",
          row["Toplam Değer"] ?? row.Toplam ?? "",
          row.Oran ?? row.Kaynak ?? ""
        ])
      )
    };
  }

  if (resource === "clients") {
    const rows = await prisma.client.findMany({
      where: includeDeleted ? { userId } : { userId, deletedAt: null },
      orderBy: { name: "asc" }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi"] : [];
    return {
      title: "Müvekkiller",
      headers: ["Ad", "Tür", "T.C. No", "Vergi No", "E-posta", "Telefon", "Durum", "Arşiv Tarihi", ...deletedHeaders, "Not"],
      rows: rows.map((row) => [
        row.name,
        clientTypeLabels[row.type],
        row.tcNo,
        row.taxNo,
        row.email,
        row.phone,
        row.deletedAt ? "Silinmiş" : row.archivedAt ? "Arşiv" : "Aktif",
        row.archivedAt ? formatDate(row.archivedAt) : "",
        ...(includeDeleted ? [row.deletedAt ? formatDate(row.deletedAt) : ""] : []),
        row.notes
      ])
    };
  }

  if (resource === "cases") {
    const rows = await prisma.caseFile.findMany({
      where: includeDeleted ? { userId } : { userId, deletedAt: null, client: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { client: true }
    });
    const deletedHeaders = includeDeleted ? ["Arşiv Tarihi", "Silinme Tarihi", "Müvekkil Silinme Tarihi"] : [];
    return {
      title: "Dosyalar",
      headers: ["Müvekkil", "Başlık", "Dosya No", "Mahkeme/Daire", "Tür", "Durum", ...deletedHeaders, "Kayıt"],
      rows: rows.map((row) => [
        row.client.name,
        row.title,
        row.fileNumber,
        row.courtOrOffice,
        row.caseType,
        caseStatusLabels[row.status],
        ...(includeDeleted
          ? [
              row.archivedAt ? formatDate(row.archivedAt) : "",
              row.deletedAt ? formatDate(row.deletedAt) : "",
              row.client.deletedAt ? formatDate(row.client.deletedAt) : ""
            ]
          : []),
        formatDate(row.createdAt)
      ])
    };
  }

  if (resource === "collections") {
    const where = collectionWhereFromFilters(collectionFiltersFromSearchParams(searchParams));
    if (includeDeleted) {
      delete where.deletedAt;
      delete where.client;
      delete where.OR;
    }
    const rows = await prisma.income.findMany({
      where: { ...where, userId },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true, cashAccount: true }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi", "Müvekkil Silinme Tarihi", "Dosya Silinme Tarihi"] : [];
    return {
      title: "Tahsilatlar",
      headers: [
        "Tarih",
        "Müvekkil",
        "Dosya",
        "Kategori",
        "Açıklama",
        "Tutar",
        "Para Birimi",
        "Yöntem",
        "Kasa",
        "Belge No",
        ...deletedHeaders
      ],
      rows: rows.map((row) => [
        formatDate(row.date),
        row.client.name,
        row.caseFile?.title,
        incomeCategoryLabels[row.category],
        row.description,
        row.amount.toString(),
        row.currency,
        paymentMethodLabels[row.paymentMethod],
        row.cashAccount?.name ?? "Ana Kasa",
        row.receiptNumber,
        ...(includeDeleted
          ? [
              row.deletedAt ? formatDate(row.deletedAt) : "",
              row.client.deletedAt ? formatDate(row.client.deletedAt) : "",
              row.caseFile?.deletedAt ? formatDate(row.caseFile.deletedAt) : ""
            ]
          : [])
      ])
    };
  }

  if (resource === "expenses") {
    const where = expenseWhereFromFilters(expenseFiltersFromSearchParams(searchParams));
    if (includeDeleted) {
      delete where.deletedAt;
      delete where.AND;
    }
    const rows = await prisma.expense.findMany({
      where: { ...where, userId },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true, cashAccount: true }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi", "Müvekkil Silinme Tarihi", "Dosya Silinme Tarihi"] : [];
    return {
      title: "Giderler",
      headers: [
        "Tarih",
        "Müvekkil",
        "Dosya",
        "Ayrım",
        "Kategori",
        "Açıklama",
        "Tutar",
        "Para Birimi",
        "Yöntem",
        "Kasa",
        "Müvekkile Yansıtılabilir",
        ...deletedHeaders
      ],
      rows: rows.map((row) => [
        formatDate(row.date),
        row.client?.name,
        row.caseFile?.title,
        expenseScopeLabel(row),
        expenseCategoryLabels[row.category],
        row.description,
        row.amount.toString(),
        row.currency,
        paymentMethodLabels[row.paymentMethod],
        row.cashAccount?.name ?? "Ana Kasa",
        row.isClientExpense ? "Evet" : "Hayır",
        ...(includeDeleted
          ? [
              row.deletedAt ? formatDate(row.deletedAt) : "",
              row.client?.deletedAt ? formatDate(row.client.deletedAt) : "",
              row.caseFile?.deletedAt ? formatDate(row.caseFile.deletedAt) : ""
            ]
          : [])
      ])
    };
  }

  if (resource === "advances") {
    const rows = await prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        category: "ADVANCE",
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
      },
      orderBy: { date: "desc" },
      include: { client: true, caseFile: true }
    });
    return {
      title: "Masraf Avansları",
      headers: ["Tarih", "Müvekkil", "Dosya", "Açıklama", "Tutar", "Para Birimi"],
      rows: rows.map((row) => [
        formatDate(row.date),
        row.client.name,
        row.caseFile?.title,
        row.description,
        toNumber(row.amount),
        row.currency
      ])
    };
  }

  if (resource === "balances") {
    const rows = await prisma.invoiceOrReceipt.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }],
        status: { in: ["ISSUED", "UNPAID", "PAID"] }
      },
      orderBy: { issueDate: "desc" },
      include: { client: true, caseFile: true }
    });
    return {
      title: "Alacak Borç",
      headers: ["Tarih", "Müvekkil", "Dosya", "Belge No", "Durum", "Net Tutar"],
      rows: rows.map((row) => [
        formatDate(row.issueDate),
        row.client.name,
        row.caseFile?.title,
        row.number,
        receiptStatusLabels[row.status],
        toNumber(row.netAmount)
      ])
    };
  }

  if (resource === "receipts") {
    const where = receiptWhereFromFilters(receiptFiltersFromSearchParams(searchParams));
    if (includeDeleted) {
      delete where.deletedAt;
      delete where.client;
      delete where.OR;
    }
    const rows = await prisma.invoiceOrReceipt.findMany({
      where: { ...where, userId },
      orderBy: { issueDate: "desc" },
      include: { client: true, caseFile: true }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi", "Müvekkil Silinme Tarihi", "Dosya Silinme Tarihi"] : [];
    return {
      title: "Makbuz Fatura",
      headers: [
        "Tarih",
        "Müvekkil",
        "Dosya",
        "Belge No",
        "Tür",
        "Durum",
        "Brüt",
        "KDV",
        "Stopaj/Tevkifat",
        "Net",
        "Not",
        "İlişkili Tahsilat ID",
        ...deletedHeaders
      ],
      rows: rows.map((row) => [
        formatDate(row.issueDate),
        row.client.name,
        row.caseFile?.title,
        row.number,
        receiptTypeLabels[row.type],
        receiptStatusLabels[row.status],
        row.grossAmount.toString(),
        row.vatAmount?.toString() ?? "",
        row.withholdingAmount?.toString() ?? "",
        row.netAmount.toString(),
        row.notes,
        row.relatedIncomeId,
        ...(includeDeleted
          ? [
              row.deletedAt ? formatDate(row.deletedAt) : "",
              row.client.deletedAt ? formatDate(row.client.deletedAt) : "",
              row.caseFile?.deletedAt ? formatDate(row.caseFile.deletedAt) : ""
            ]
          : [])
      ])
    };
  }

  if (resource === "auditLogs") {
    const rows = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        entityType: true,
        entityId: true,
        action: true,
        message: true
      }
    });

    return {
      title: "İşlem Geçmişi",
      headers: ["Tarih", "Kayıt Tipi", "İşlem Türü", "Açıklama", "Kayıt ID"],
      rows: rows.map((row) => [
        formatDate(row.createdAt),
        auditEntityLabels[row.entityType],
        auditActionLabels[row.action],
        row.message,
        row.entityId
      ])
    };
  }

  if (resource === "documents") {
    const rows = await prisma.document.findMany({
      where: includeDeleted ? { userId } : { userId, deletedAt: null },
      orderBy: [{ uploadedAt: "desc" }, { title: "asc" }],
      include: {
        linkedClient: { select: { name: true } },
        linkedCaseFile: { select: { title: true, fileNumber: true } },
        linkedIncome: { select: { id: true, amount: true, date: true } },
        linkedExpense: { select: { id: true, amount: true, date: true } },
        linkedInvoiceOrReceipt: { select: { id: true, number: true } },
        linkedCashLedgerEntry: { select: { id: true, description: true, date: true } },
        tags: { include: { tag: true } }
      }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi"] : [];

    return {
      title: "Belge Metadata",
      headers: [
        "Yükleme Tarihi",
        "Belge Tarihi",
        "Başlık",
        "Tür",
        "Orijinal Dosya Adı",
        "Dosya Tipi",
        "Boyut Byte",
        "Dosya Hash",
        "Tutar",
        "Para Birimi",
        "Müvekkil",
        "Dosya",
        "Bağlı Tahsilat",
        "Bağlı Gider",
        "Bağlı Makbuz/Fatura",
        "Bağlı Kasa Hareketi",
        "Etiketler",
        "Metin Çıkarma Durumu",
        "Extracted Text Var Mı",
        ...deletedHeaders
      ],
      rows: rows.map((row) => [
        formatDate(row.uploadedAt),
        row.documentDate ? formatDate(row.documentDate) : "",
        row.title,
        documentTypeLabels[row.documentType],
        row.originalFileName,
        row.mimeType,
        row.fileSize,
        row.fileHash,
        row.amount?.toString() ?? "",
        row.currency,
        row.linkedClient?.name ?? "",
        row.linkedCaseFile ? `${row.linkedCaseFile.title}${row.linkedCaseFile.fileNumber ? ` (${row.linkedCaseFile.fileNumber})` : ""}` : "",
        row.linkedIncome ? `${formatDate(row.linkedIncome.date)} ${row.linkedIncome.amount.toString()}` : "",
        row.linkedExpense ? `${formatDate(row.linkedExpense.date)} ${row.linkedExpense.amount.toString()}` : "",
        row.linkedInvoiceOrReceipt?.number ?? "",
        row.linkedCashLedgerEntry ? `${formatDate(row.linkedCashLedgerEntry.date)} ${row.linkedCashLedgerEntry.description ?? ""}` : "",
        row.tags.map((item) => item.tag.name).join(", "),
        documentExtractionStatusLabels[row.extractionStatus],
        row.extractedText ? "Evet" : "Hayır",
        ...(includeDeleted ? [row.deletedAt ? formatDate(row.deletedAt) : ""] : [])
      ])
    };
  }

  if (resource === "cashLedger") {
    const rows = await prisma.cashLedgerEntry.findMany({
      where: cashLedgerWhere({ userId, ...cashLedgerFiltersFromSearchParams(searchParams) }),
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        cashAccount: true,
        client: true,
        caseFile: true
      }
    });

    return {
      title: "Kasa Hareketleri",
      headers: [
        "Tarih",
        "Kasa",
        "Yön",
        "Hareket Tipi",
        "Açıklama",
        "Müvekkil",
        "Dosya",
        "Giriş",
        "Çıkış",
        "Net",
        "Para Birimi",
        "Referans"
      ],
      rows: rows.map((row) => {
        const signedAmount = row.direction === "IN" ? row.amount : row.amount.negated();
        return [
          formatDate(row.date),
          row.cashAccount.name,
          cashLedgerDirectionLabels[row.direction],
          cashLedgerEntryTypeLabels[row.entryType],
          row.description,
          row.client?.name,
          row.caseFile?.title,
          row.direction === "IN" ? row.amount.toString() : "",
          row.direction === "OUT" ? row.amount.toString() : "",
          signedAmount.toString(),
          row.currency,
          row.referenceNo
        ];
      })
    };
  }

  if (resource === "capitalAssets") {
    const rows = await prisma.assetAccount.findMany({
      where: includeDeleted ? { userId } : { userId, deletedAt: null },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
      include: {
        linkedCashAccount: { select: { name: true } },
        valuations: { orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }], take: 1 }
      }
    });
    const deletedHeaders = includeDeleted ? ["Silinme Tarihi"] : [];

    return {
      title: "Sermaye Varlıkları",
      headers: [
        "Varlık",
        "Tür",
        "Para Birimi",
        "Sembol",
        "Miktar",
        "Birim Fiyat",
        "Toplam Değer",
        "Değerleme Para Birimi",
        "Kasa Bağlantısı",
        "Aktif",
        "Son Değerleme",
        "Açıklama",
        ...deletedHeaders
      ],
      rows: rows.map((row) => {
        const latestValuation = row.valuations[0];
        return [
          row.name,
          assetTypeLabels[row.assetType],
          row.currency,
          row.symbol,
          row.quantity?.toString() ?? "",
          row.unitPrice?.toString() ?? "",
          latestValuation?.totalValue.toString() ?? row.manualTotalValue?.toString() ?? "",
          row.valuationCurrency,
          row.linkedCashAccount?.name ?? "",
          row.isActive ? "Evet" : "Hayır",
          latestValuation ? formatDate(latestValuation.valuationDate) : "",
          row.description,
          ...(includeDeleted ? [row.deletedAt ? formatDate(row.deletedAt) : ""] : [])
        ];
      })
    };
  }

  if (resource === "assetValuations") {
    const rows = await prisma.assetValuation.findMany({
      where: { userId, assetAccount: includeDeleted ? undefined : { deletedAt: null } },
      orderBy: [{ valuationDate: "desc" }, { createdAt: "desc" }],
      include: { assetAccount: true }
    });

    return {
      title: "Varlık Değerleme Geçmişi",
      headers: ["Tarih", "Varlık", "Tür", "Miktar", "Birim Fiyat", "Toplam Değer", "Para Birimi", "Kaynak", "Not"],
      rows: rows.map((row) => [
        formatDate(row.valuationDate),
        row.assetAccount.name,
        assetTypeLabels[row.assetAccount.assetType],
        row.quantity?.toString() ?? "",
        row.unitPrice?.toString() ?? "",
        row.totalValue.toString(),
        row.valuationCurrency,
        assetValuationSourceLabels[row.source],
        row.note
      ])
    };
  }

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: {
        userId,
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
      },
      include: { client: true, caseFile: true }
    }),
    prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        AND: [
          { OR: [{ clientId: null }, { client: { archivedAt: null, deletedAt: null } }] },
          { OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }] }
        ]
      },
      include: { client: true, caseFile: true }
    })
  ]);

  return {
    title: "Finans Özeti",
    headers: ["Tarih", "Tür", "Müvekkil", "Dosya", "Açıklama", "Tutar"],
    rows: [
      ...incomes.map((row) => [
        row.date,
        "Tahsilat",
        row.client.name,
        row.caseFile?.title,
        row.description,
        toNumber(row.amount)
      ]),
      ...expenses.map((row) => [
        row.date,
        "Gider",
        row.client?.name,
        row.caseFile?.title,
        row.description,
        -toNumber(row.amount)
      ])
    ]
      .sort((a, b) => new Date(b[0] as Date).getTime() - new Date(a[0] as Date).getTime())
      .map((row) => [formatDate(row[0] as Date), ...row.slice(1)])
  };
}

function expenseScopeLabel(row: { clientId: string | null; caseFileId: string | null }) {
  if (row.caseFileId) return "Dosya gideri";
  if (row.clientId) return "Müvekkil gideri";
  return "Genel gider";
}
