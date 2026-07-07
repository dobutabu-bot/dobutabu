import type { CashLedgerDirection, CashLedgerEntryType } from "@prisma/client";

import { cashLedgerDirectionLabels, cashLedgerEntryTypeLabels } from "@/lib/labels";

export type CashLedgerFilters = {
  startDate: string;
  endDate: string;
  cashAccountId: string;
  clientId: string;
  caseFileId: string;
  entryType: CashLedgerEntryType | "";
  direction: CashLedgerDirection | "";
};

export function cashLedgerFiltersFromSearchParams(searchParams: URLSearchParams): CashLedgerFilters {
  const entryType = searchParams.get("entryType")?.trim() ?? "";
  const direction = searchParams.get("direction")?.trim() ?? "";

  return {
    startDate: searchParams.get("startDate")?.trim() ?? "",
    endDate: searchParams.get("endDate")?.trim() ?? "",
    cashAccountId: searchParams.get("cashAccountId")?.trim() ?? "",
    clientId: searchParams.get("clientId")?.trim() ?? "",
    caseFileId: searchParams.get("caseFileId")?.trim() ?? "",
    entryType: entryType && entryType in cashLedgerEntryTypeLabels ? (entryType as CashLedgerEntryType) : "",
    direction: direction && direction in cashLedgerDirectionLabels ? (direction as CashLedgerDirection) : ""
  };
}

export function cashLedgerFiltersFromRecord(params: Partial<Record<keyof CashLedgerFilters, string | undefined>>): CashLedgerFilters {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return cashLedgerFiltersFromSearchParams(searchParams);
}

export function appendCashLedgerFilters(params: URLSearchParams, filters: CashLedgerFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
}
