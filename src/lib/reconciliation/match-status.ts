export const APPROVED_BANK_MATCH_TYPES = ["MATCHED", "AUTO_MATCHED", "MANUALLY_MATCHED", "CREATED_FROM_BANK"] as const;

export const CLOSED_BANK_MATCH_TYPES = [...APPROVED_BANK_MATCH_TYPES, "IGNORED"] as const;

type BankMatchLike = {
  matchType?: string | null;
};

export function isApprovedBankMatch(row: BankMatchLike) {
  return APPROVED_BANK_MATCH_TYPES.includes(row.matchType as (typeof APPROVED_BANK_MATCH_TYPES)[number]);
}

export function isClosedBankMatch(row: BankMatchLike) {
  return CLOSED_BANK_MATCH_TYPES.includes(row.matchType as (typeof CLOSED_BANK_MATCH_TYPES)[number]);
}

export function isIgnoredBankMatch(row: BankMatchLike) {
  return row.matchType === "IGNORED";
}

export function isSuggestedBankMatch(row: BankMatchLike) {
  return row.matchType === "SUGGESTED";
}
