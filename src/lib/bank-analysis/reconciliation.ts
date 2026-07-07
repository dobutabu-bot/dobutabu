import type { TransactionDirection } from "@/lib/bank-analysis/categorize-transaction";
import { isApprovedBankMatch } from "@/lib/reconciliation/match-status";
import { dateInputValue, toNumber } from "@/lib/utils";

export type BankMovementForMatch = {
  id: string;
  rowNumber: number;
  transactionDate: Date | null;
  description: string;
  amount: unknown;
  direction: TransactionDirection;
  cashAccountId?: string | null;
  importCashAccountId?: string | null;
  clientSuggestionName?: string | null;
  caseFileSuggestionTitle?: string | null;
  caseFileSuggestionFileNumber?: string | null;
  matchType?: string | null;
  matchedCashLedgerEntryId?: string | null;
  matchedIncomeId?: string | null;
  matchedExpenseId?: string | null;
};

export type LedgerMovementForMatch = {
  id: string;
  incomeId: string | null;
  expenseId: string | null;
  direction: TransactionDirection;
  amount: unknown;
  date: Date;
  description: string | null;
  clientId?: string | null;
  clientName?: string | null;
  caseFileId?: string | null;
  caseFileTitle?: string | null;
  caseFileNumber?: string | null;
  cashAccountId?: string | null;
};

export const RECONCILIATION_THRESHOLDS = {
  flag: 0.6,
  suggest: 0.68,
  highConfidence: 0.9,
  ambiguousAutoBlock: 0.88
} as const;

export type ReconciliationConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export type LedgerMatchSuggestion = {
  rowId: string;
  rowNumber: number;
  ledgerEntryId: string;
  incomeId: string | null;
  expenseId: string | null;
  confidence: number;
  confidenceBand: ReconciliationConfidenceBand;
  reason: string;
  reasons: string[];
  dateDiffDays: number;
  amountDiff: number;
  requiresUserApproval: true;
};

export function suggestLedgerMatch(row: BankMovementForMatch, candidates: LedgerMovementForMatch[]): LedgerMatchSuggestion | null {
  if (!row.transactionDate || row.direction === "NEUTRAL") return null;
  const rowAmount = Math.abs(toNumber(row.amount));
  if (rowAmount <= 0) return null;

  const scored = candidates
    .filter((candidate) => candidate.direction === row.direction)
    .map((candidate) => scoreLedgerMatch(row, candidate))
    .filter((candidate): candidate is LedgerMatchSuggestion => candidate != null)
    .sort((a, b) => b.confidence - a.confidence);

  return scored[0]?.confidence >= RECONCILIATION_THRESHOLDS.suggest ? scored[0] : null;
}

export function suggestLedgerMatches(row: BankMovementForMatch, candidates: LedgerMovementForMatch[], limit = 3): LedgerMatchSuggestion[] {
  if (!row.transactionDate || row.direction === "NEUTRAL") return [];
  const rowAmount = Math.abs(toNumber(row.amount));
  if (rowAmount <= 0) return [];

  return candidates
    .filter((candidate) => candidate.direction === row.direction)
    .map((candidate) => scoreLedgerMatch(row, candidate))
    .filter((candidate): candidate is LedgerMatchSuggestion => candidate != null && candidate.confidence >= RECONCILIATION_THRESHOLDS.flag)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export function isAmbiguousLedgerSuggestion(
  suggestion: LedgerMatchSuggestion,
  row: BankMovementForMatch,
  candidates: LedgerMovementForMatch[]
) {
  if (suggestion.confidence >= RECONCILIATION_THRESHOLDS.highConfidence) return false;
  const rowAmount = Math.abs(toNumber(row.amount));
  const sameAmountSameDirection = candidates.filter(
    (candidate) =>
      candidate.direction === row.direction &&
      Math.abs(Math.abs(toNumber(candidate.amount)) - rowAmount) < 0.01 &&
      row.transactionDate &&
      Math.abs(startOfDate(row.transactionDate).getTime() - startOfDate(candidate.date).getTime()) / 86400000 <= 3
  );

  return sameAmountSameDirection.length > 1 && suggestion.confidence < RECONCILIATION_THRESHOLDS.ambiguousAutoBlock;
}

export function findUnmatchedSystemMovements(
  rows: BankMovementForMatch[],
  candidates: LedgerMovementForMatch[],
  limit = 50
) {
  const matchedEntryIds = new Set(rows.filter(isApprovedBankMatch).map((row) => row.matchedCashLedgerEntryId).filter(Boolean));
  const suggestedEntryIds = new Set(
    rows
      .flatMap((row) => {
        const match = suggestLedgerMatch(row, candidates);
        return match && !isAmbiguousLedgerSuggestion(match, row, candidates) ? [match.ledgerEntryId] : [];
      })
  );

  return candidates
    .filter((entry) => !matchedEntryIds.has(entry.id) && !suggestedEntryIds.has(entry.id))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      date: dateInputValue(entry.date),
      description: entry.description ?? "-",
      direction: entry.direction,
      amount: Math.abs(toNumber(entry.amount)),
      incomeId: entry.incomeId,
      expenseId: entry.expenseId
    }));
}

function scoreLedgerMatch(row: BankMovementForMatch, candidate: LedgerMovementForMatch): LedgerMatchSuggestion | null {
  if (!row.transactionDate) return null;
  const rowAmount = Math.abs(toNumber(row.amount));
  const candidateAmount = Math.abs(toNumber(candidate.amount));
  const amountDiff = Math.abs(rowAmount - candidateAmount);
  const dayDiff = Math.abs(startOfDate(row.transactionDate).getTime() - startOfDate(candidate.date).getTime()) / 86400000;

  if (amountDiff > Math.max(1, rowAmount * 0.01) || dayDiff > 7) {
    return null;
  }

  let confidence = 0.18;
  const reasons: string[] = ["Yön aynı"];

  if (amountDiff < 0.01) {
    confidence += 0.42;
    reasons.push("Tutar birebir");
  } else if (amountDiff <= Math.max(1, rowAmount * 0.005)) {
    confidence += 0.32;
    reasons.push("Tutar çok yakın");
  } else {
    confidence += 0.2;
    reasons.push("Tutar yakın");
  }

  if (dayDiff === 0) {
    confidence += 0.22;
    reasons.push("Tarih aynı");
  } else if (dayDiff <= 3) {
    confidence += 0.14;
    reasons.push("Tarih yakın");
  } else {
    confidence += 0.06;
    reasons.push("Tarih tolerans içinde");
  }

  const similarity = descriptionSimilarity(row.description, candidate.description ?? "");
  if (similarity > 0.35) {
    confidence += Math.min(0.1, similarity * 0.12);
    reasons.push("Açıklama benzer");
  }

  if (row.importCashAccountId && candidate.cashAccountId && row.importCashAccountId === candidate.cashAccountId) {
    confidence += 0.08;
    reasons.push("Import hesabı aynı");
  }

  const clientSimilarity =
    row.clientSuggestionName && candidate.clientName ? descriptionSimilarity(row.clientSuggestionName, candidate.clientName) : 0;
  if (clientSimilarity >= 0.45) {
    confidence += 0.06;
    reasons.push("Müvekkil sinyali benzer");
  }

  const rowFileNumber = row.caseFileSuggestionFileNumber ?? "";
  if (rowFileNumber && candidate.caseFileNumber && normalizeText(rowFileNumber) === normalizeText(candidate.caseFileNumber)) {
    confidence += 0.06;
    reasons.push("Dosya numarası aynı");
  } else if (row.caseFileSuggestionTitle && candidate.caseFileTitle && descriptionSimilarity(row.caseFileSuggestionTitle, candidate.caseFileTitle) >= 0.45) {
    confidence += 0.04;
    reasons.push("Dosya sinyali benzer");
  }

  const rowIban = row.description.match(/\bTR\d{2}[A-Z0-9]{5,30}\b/i)?.[0]?.toUpperCase() ?? null;
  const candidateIban = (candidate.description ?? "").match(/\bTR\d{2}[A-Z0-9]{5,30}\b/i)?.[0]?.toUpperCase() ?? null;
  if (rowIban && candidateIban && rowIban === candidateIban) {
    confidence += 0.08;
    reasons.push("IBAN aynı");
  }

  const normalizedConfidence = Math.min(1, confidence);
  return {
    rowId: row.id,
    rowNumber: row.rowNumber,
    ledgerEntryId: candidate.id,
    incomeId: candidate.incomeId,
    expenseId: candidate.expenseId,
    confidence: round(normalizedConfidence),
    confidenceBand: confidenceBand(normalizedConfidence),
    reason: reasons.join(", "),
    reasons,
    dateDiffDays: Math.round(dayDiff),
    amountDiff: round(amountDiff),
    requiresUserApproval: true
  };
}

function confidenceBand(confidence: number): ReconciliationConfidenceBand {
  if (confidence >= RECONCILIATION_THRESHOLDS.highConfidence) return "HIGH";
  if (confidence >= RECONCILIATION_THRESHOLDS.suggest) return "MEDIUM";
  return "LOW";
}

function descriptionSimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .trim();
}

function startOfDate(value: Date) {
  return new Date(`${dateInputValue(value)}T00:00:00+03:00`);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
