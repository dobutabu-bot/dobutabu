const MAX_QUERY_LENGTH = 120;

export function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string) {
  const normalized = normalizeSearchText(normalizeSearchQuery(query));
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(" ").filter((token) => token.length >= 2)));
}

export function buildSearchIndexText(parts: unknown[]) {
  return normalizeSearchText(parts.filter((part) => part != null && String(part).trim() !== "").join(" "));
}

export function includesNormalized(haystack: unknown, needle: string) {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return true;
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}
