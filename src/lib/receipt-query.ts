import type { Prisma } from "@prisma/client";

import { endOfDateInput, parseDateInput } from "@/lib/utils";

export type ReceiptFilters = {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  status?: string;
  unpaidOnly?: string;
};

const receiptStatuses = ["DRAFT", "ISSUED", "CANCELLED", "PAID", "UNPAID"] as const;

type ReceiptStatusFilter = (typeof receiptStatuses)[number];

export function receiptWhereFromFilters(filters: ReceiptFilters): Prisma.InvoiceOrReceiptWhereInput {
  const where: Prisma.InvoiceOrReceiptWhereInput = {
    deletedAt: null,
    client: { archivedAt: null, deletedAt: null },
    OR: [{ caseFileId: null }, { caseFile: { status: { not: "ARCHIVED" }, archivedAt: null, deletedAt: null } }]
  };
  const startDate = cleanDate(filters.startDate);
  const endDate = cleanDate(filters.endDate);
  const clientId = clean(filters.clientId);
  const status = clean(filters.status);
  const unpaidOnly = clean(filters.unpaidOnly) === "1";

  if (clientId) {
    where.clientId = clientId;
  }

  if (unpaidOnly) {
    where.status = "UNPAID";
  } else if (isReceiptStatus(status)) {
    where.status = status;
  }

  const issueDate: Prisma.DateTimeFilter = {};

  if (startDate) {
    issueDate.gte = parseDateInput(startDate);
  }

  if (endDate) {
    issueDate.lte = endOfDateInput(endDate);
  }

  if (issueDate.gte || issueDate.lte) {
    where.issueDate = issueDate;
  }

  return where;
}

export function receiptFiltersFromSearchParams(searchParams: URLSearchParams): ReceiptFilters {
  return {
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    clientId: searchParams.get("clientId") ?? "",
    status: searchParams.get("status") ?? "",
    unpaidOnly: searchParams.get("unpaidOnly") ?? ""
  };
}

export function appendReceiptFilters(params: URLSearchParams, filters: ReceiptFilters) {
  for (const [key, value] of Object.entries(filters)) {
    const cleanValue = clean(value);

    if (cleanValue) {
      params.set(key, cleanValue);
    }
  }
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function cleanDate(value: string | undefined) {
  const next = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}

function isReceiptStatus(value: string): value is ReceiptStatusFilter {
  return receiptStatuses.includes(value as ReceiptStatusFilter);
}
