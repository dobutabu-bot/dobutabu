export const PRIVACY_MODE_STORAGE_KEY = "buro-finans-privacy-mode";
export const PRIVACY_MODE_EVENT = "buro-finans:privacy-mode";
export const PRIVACY_MASK_TEXT = "•••••";

export function readStoredPrivacyPreference(storage: Pick<Storage, "getItem">) {
  return storage.getItem(PRIVACY_MODE_STORAGE_KEY) === "1";
}

export function writeStoredPrivacyPreference(storage: Pick<Storage, "setItem">, enabled: boolean) {
  storage.setItem(PRIVACY_MODE_STORAGE_KEY, enabled ? "1" : "0");
}

export function applyPrivacyModeToDocument(documentRef: Document, enabled: boolean) {
  documentRef.documentElement.dataset.privacyMode = enabled ? "on" : "off";
}

export function privacyModeEvent(enabled: boolean) {
  return new CustomEvent(PRIVACY_MODE_EVENT, { detail: { enabled } });
}

export function isSensitiveFinancialColumn(header: string) {
  const normalized = header.toLocaleLowerCase("tr-TR");
  return [
    "tutar",
    "bakiye",
    "net",
    "brüt",
    "kdv",
    "stopaj",
    "giriş",
    "çıkış",
    "tahsilat",
    "gider",
    "masraf",
    "varlık",
    "borç",
    "kasa",
    "değer"
  ].some((keyword) => normalized.includes(keyword));
}
