export type SearchResultGroupId = "clients" | "cases" | "finance" | "documents" | "bank" | "capital";

export type SearchResultTone = "neutral" | "green" | "rose" | "amber" | "blue";

export type SearchResultItem = {
  id: string;
  group: SearchResultGroupId;
  type: string;
  title: string;
  description: string;
  meta: string;
  href: string;
  amountLabel?: string;
  tone?: SearchResultTone;
};

export type SearchResultGroup = {
  id: SearchResultGroupId;
  title: string;
  items: SearchResultItem[];
};

export type SearchProviderMode = "DATABASE_CONTAINS" | "FULL_TEXT_INDEX";

export type SearchProviderMeta = {
  id: string;
  label: string;
  mode: SearchProviderMode;
  normalizedQuery: string;
};

export type GlobalSearchData = {
  query: string;
  total: number;
  groups: SearchResultGroup[];
  provider?: SearchProviderMeta;
};

export const SEARCH_GROUP_LABELS: Record<SearchResultGroupId, string> = {
  clients: "Müvekkiller",
  cases: "Dosyalar",
  finance: "Finans Kayıtları",
  documents: "Belgeler",
  bank: "Banka Hareketleri",
  capital: "Sermaye"
};
