import { Prisma } from "@prisma/client";

import { receiptStatusLabels, receiptTypeLabels } from "@/lib/labels";
import {
  datedPdfFilename,
  type PdfReportInput,
  type PdfSummaryItem
} from "@/lib/pdf/pdf-document";
import type { BuiltPdfReport } from "@/lib/pdf/pdf-report-data";
import { prisma } from "@/lib/prisma";
import {
  receiptWhereFromFilters,
  type ReceiptFilters
} from "@/lib/receipt-query";
import { getFirmSettings } from "@/lib/settings";
import { formatDate, formatMoney } from "@/lib/utils";

export async function buildReceiptsPdf(
  userId: string,
  filters: ReceiptFilters
): Promise<BuiltPdfReport> {
  const where: Prisma.InvoiceOrReceiptWhereInput = {
    ...receiptWhereFromFilters(filters),
    userId
  };
  const unpaidWhere: Prisma.InvoiceOrReceiptWhereInput = {
    ...where,
    status: "UNPAID"
  };
  const [
    settings,
    receipts,
    totalCount,
    totalAggregate,
    unpaidCount,
    unpaidAggregate
  ] = await Promise.all([
    getFirmSettings(userId),
    prisma.invoiceOrReceipt.findMany({
      where,
      orderBy: { issueDate: "desc" },
      take: 500,
      select: {
        issueDate: true,
        number: true,
        type: true,
        status: true,
        netAmount: true,
        client: { select: { name: true } },
        caseFile: { select: { title: true, fileNumber: true } }
      }
    }),
    prisma.invoiceOrReceipt.count({ where }),
    prisma.invoiceOrReceipt.aggregate({ where, _sum: { netAmount: true } }),
    prisma.invoiceOrReceipt.count({ where: unpaidWhere }),
    prisma.invoiceOrReceipt.aggregate({
      where: unpaidWhere,
      _sum: { netAmount: true }
    })
  ]);

  return {
    filename: datedPdfFilename("makbuz-fatura-takip"),
    input: reportInput(settings, {
      title: "Makbuz / Fatura Takip Raporu",
      subtitle: "Takip amaçlı makbuz ve fatura kayıtları",
      period: reportPeriodLabel(filters),
      summaries: [
        summary("Belge Sayısı", String(totalCount)),
        summary(
          "Toplam Net",
          formatMoney(totalAggregate._sum.netAmount ?? 0),
          "green"
        ),
        summary(
          "Ödenmeyen Belge",
          String(unpaidCount),
          unpaidCount > 0 ? "amber" : "neutral"
        ),
        summary(
          "Ödenmeyen Net",
          formatMoney(unpaidAggregate._sum.netAmount ?? 0),
          unpaidCount > 0 ? "amber" : "neutral"
        )
      ],
      tables: [
        {
          title: "Makbuz / Fatura Kayıtları",
          headers: [
            "Tarih",
            "Müvekkil",
            "Dosya",
            "Belge No",
            "Tür",
            "Durum",
            "Net Tutar"
          ],
          rows: receipts.map((receipt) => ({
            Tarih: formatDate(receipt.issueDate),
            Müvekkil: receipt.client.name,
            Dosya: caseLabel(receipt.caseFile),
            "Belge No": receipt.number,
            Tür: receiptTypeLabels[receipt.type],
            Durum: receiptStatusLabels[receipt.status],
            "Net Tutar": formatMoney(receipt.netAmount)
          }))
        }
      ],
      notes: [
        "Bu rapor yalnızca sistemdeki takip kayıtlarına göre hazırlanır; resmi e-SMM/e-Fatura yerine geçmez.",
        totalCount > receipts.length
          ? `Performans için PDF çıktısı ilk ${receipts.length} kayıtla sınırlandı.`
          : "Seçilen filtredeki tüm kayıtlar PDF'e dahil edildi."
      ]
    })
  };
}

function reportInput(
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

function summary(
  label: string,
  value: string,
  tone: PdfSummaryItem["tone"] = "neutral"
): PdfSummaryItem {
  return { label, value, tone };
}

function caseLabel(caseFile: {
  title: string;
  fileNumber?: string | null;
} | null) {
  if (!caseFile) return "-";
  return `${caseFile.title}${
    caseFile.fileNumber ? ` (${caseFile.fileNumber})` : ""
  }`;
}

function reportPeriodLabel(filters: ReceiptFilters) {
  if (filters.startDate && filters.endDate) {
    return `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`;
  }
  if (filters.startDate) return `${formatDate(filters.startDate)} sonrası`;
  if (filters.endDate) return `${formatDate(filters.endDate)} öncesi`;
  return "Tüm dönem";
}
