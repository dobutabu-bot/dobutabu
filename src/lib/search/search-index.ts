import type { GlobalSearchData, SearchResultGroupId, SearchResultTone } from "@/lib/search/types";

export type SearchIndexEntityType =
  | "CLIENT"
  | "CASE_FILE"
  | "INCOME"
  | "EXPENSE"
  | "INVOICE_OR_RECEIPT"
  | "CASH_LEDGER_ENTRY"
  | "DOCUMENT"
  | "BANK_STATEMENT_ROW"
  | "ASSET_ACCOUNT";

export type SearchIndexDocument = {
  entityType: SearchIndexEntityType;
  entityId: string;
  userId: string;
  group: SearchResultGroupId;
  title: string;
  description?: string;
  indexedText: string;
  href: string;
  amountLabel?: string;
  tone?: SearchResultTone;
  updatedAt?: string;
};

export type SearchIndexQuery = {
  userId: string;
  query: string;
  normalizedQuery: string;
  limitPerGroup?: number;
};

export interface SearchIndexProvider {
  readonly id: string;
  readonly label: string;
  search(input: SearchIndexQuery): Promise<GlobalSearchData>;
}

export const DATABASE_CONTAINS_SEARCH_PROVIDER = {
  id: "database-contains-v1",
  label: "Veritabanı contains araması"
} as const;
