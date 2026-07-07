import {
  classifyTransactionDeterministically,
  extractCounterparty,
  extractIban,
  normalizeTransactionText,
  type ClassificationCandidate,
  type DeterministicCategorizeInput,
  type DeterministicTransactionRule,
  type TransactionCategoryInput,
  type TransactionDirection,
  type TransactionGroup
} from "@/lib/bank-analysis/rule-engine";

export type { TransactionDirection, TransactionGroup, TransactionCategoryInput };

export type TransactionRuleInput = DeterministicTransactionRule;

export type CategorizeTransactionInput = DeterministicCategorizeInput;

export type TransactionCategorySuggestion = {
  category: string;
  group: TransactionGroup;
  confidence: number;
  reason: string;
  ruleId: string | null;
  ruleName: string | null;
  clientId: string | null;
  caseFileId: string | null;
  cashAccountId: string | null;
  iban: string | null;
  counterparty: string | null;
  isHighConfidence: boolean;
  matchedSignals: string[];
  candidates: ClassificationCandidate[];
};

export function categorizeTransaction(
  input: CategorizeTransactionInput,
  rules: TransactionRuleInput[] = [],
  categories: TransactionCategoryInput[] = []
): TransactionCategorySuggestion {
  return classifyTransactionDeterministically(input, rules, categories);
}

export { extractCounterparty, extractIban, normalizeTransactionText };
