import { toNumber } from "@/lib/utils";

export type TransactionDirection = "IN" | "OUT" | "NEUTRAL";
export type TransactionGroup = "INCOME" | "EXPENSE" | "TRANSFER" | "NEUTRAL";

export type DeterministicTransactionRule = {
  id: string;
  name: string;
  keyword: string;
  matchType?: string | null;
  direction: string;
  category: string;
  targetGroup: string | null;
  amountMin?: unknown;
  amountMax?: unknown;
  confidence: unknown;
  clientId?: string | null;
  caseFileId?: string | null;
  cashAccountId?: string | null;
};

export type TransactionCategoryInput = {
  id?: string;
  name: string;
  slug?: string;
  group: string;
  direction: TransactionDirection | string;
  isActive?: boolean;
};

export type DeterministicCategorizeInput = {
  description: string;
  direction: TransactionDirection;
  amount?: unknown;
  iban?: string | null;
  counterparty?: string | null;
};

export type ClassificationCandidate = {
  category: string;
  group: TransactionGroup;
  confidence: number;
  reason: string;
  ruleId: string | null;
  ruleName: string | null;
  clientId: string | null;
  caseFileId: string | null;
  cashAccountId: string | null;
  matchedSignals: string[];
};

type RuleClassificationCandidate = ClassificationCandidate & {
  priorityIndex: number;
  sourceRank: 0;
};

type RankedClassificationCandidate = ClassificationCandidate & {
  priorityIndex?: number;
  sourceRank: 0 | 1 | 2;
};

export type DeterministicClassification = ClassificationCandidate & {
  iban: string | null;
  counterparty: string | null;
  isHighConfidence: boolean;
  candidates: ClassificationCandidate[];
};

export const HIGH_CONFIDENCE_LIMIT = 0.78;

type KeywordRule = {
  category: string;
  group: TransactionGroup;
  keywords: string[];
  confidence: number;
};

const transferRules: KeywordRule[] = [
  {
    category: "Kendi Hesapları Arası Transfer",
    group: "TRANSFER",
    confidence: 0.88,
    keywords: ["virman", "hesaplar arasi", "hesaplararası", "kendi hesab", "hesabimdan", "hesabima"]
  },
  {
    category: "Kredi Kartı Ödemesi",
    group: "TRANSFER",
    confidence: 0.84,
    keywords: ["kredi karti odeme", "kredi kartı ödeme", "kk odeme", "kart odeme", "card payment"]
  },
  {
    category: "Nakit Çekim/Yatırma",
    group: "TRANSFER",
    confidence: 0.8,
    keywords: ["atm para cekme", "atm para çekme", "nakit cekim", "nakit çekim", "para yatirma", "para yatırma"]
  }
];

const incomeRules: KeywordRule[] = [
  {
    category: "Müvekkil Ödemesi",
    group: "INCOME",
    confidence: 0.86,
    keywords: ["vekalet", "avukatlik", "avukatlık", "muvekkil", "müvekkil", "dava", "icra", "dosya", "hukuk"]
  },
  {
    category: "Havale/EFT Girişi",
    group: "INCOME",
    confidence: 0.78,
    keywords: ["gelen eft", "gelen havale", "fast gelen", "eft gelen", "havale gelen", "para transferi gelen"]
  },
  {
    category: "Maaş/Ücret",
    group: "INCOME",
    confidence: 0.82,
    keywords: ["maas", "maaş", "ucret", "ücret", "serbest meslek", "smm", "hak edis", "hakediş"]
  },
  {
    category: "İade",
    group: "INCOME",
    confidence: 0.8,
    keywords: ["iade", "refund", "geri odeme", "geri ödeme"]
  }
];

const expenseRules: KeywordRule[] = [
  { category: "Kira", group: "EXPENSE", confidence: 0.9, keywords: ["kira", "ofis kira", "isyeri kira", "işyeri kira"] },
  { category: "Vergi", group: "EXPENSE", confidence: 0.9, keywords: ["vergi", "kdv", "gelir vergisi", "muhtasar", "damga vergisi"] },
  { category: "SGK", group: "EXPENSE", confidence: 0.9, keywords: ["sgk", "sosyal guvenlik", "sosyal güvenlik", "bagkur", "bağkur"] },
  { category: "Personel", group: "EXPENSE", confidence: 0.84, keywords: ["personel", "maas odeme", "maaş ödeme", "bordro", "calisan", "çalışan"] },
  { category: "Ofis", group: "EXPENSE", confidence: 0.78, keywords: ["elektrik", "su faturasi", "su faturası", "internet", "telefon", "ofis", "kirtasiye", "kırtasiye"] },
  { category: "Ulaşım", group: "EXPENSE", confidence: 0.78, keywords: ["taksi", "otopark", "ulasim", "ulaşım", "yakit", "yakıt", "metro", "otobus", "otobüs"] },
  { category: "Yemek", group: "EXPENSE", confidence: 0.76, keywords: ["yemek", "restoran", "restaurant", "cafe", "kahve"] },
  { category: "Noter", group: "EXPENSE", confidence: 0.9, keywords: ["noter", "noterlik"] },
  { category: "Harç", group: "EXPENSE", confidence: 0.88, keywords: ["harc", "harç", "mahkeme", "icra dairesi", "uyap"] },
  { category: "POS/Komisyon", group: "EXPENSE", confidence: 0.82, keywords: ["pos komisyon", "komisyon", "masraf kesintisi", "islem ucreti", "işlem ücreti"] },
  { category: "Abonelik", group: "EXPENSE", confidence: 0.8, keywords: ["abonelik", "subscription", "aidat"] },
  { category: "Yazılım", group: "EXPENSE", confidence: 0.82, keywords: ["yazilim", "yazılım", "software", "google", "microsoft", "apple", "adobe", "uyap entegrasyon"] }
];

export function classifyTransactionDeterministically(
  input: DeterministicCategorizeInput,
  rules: DeterministicTransactionRule[] = [],
  categories: TransactionCategoryInput[] = []
): DeterministicClassification {
  const description = normalizeTransactionText(input.description);
  const iban = input.iban ?? extractIban(input.description);
  const counterparty = input.counterparty ?? extractCounterparty(input.description);
  const categoryMap = buildCategoryMap(categories);
  const userCandidates = rules
    .map((rule, index) => buildRuleCandidate(rule, input, description, iban, counterparty, categoryMap, index))
    .filter((candidate): candidate is RuleClassificationCandidate => candidate != null);
  const keywordCandidates = buildKeywordCandidates(input, description, iban, counterparty, categoryMap);
  const fallback = buildFallbackCandidate(input);
  const rankedKeywordCandidates: RankedClassificationCandidate[] = keywordCandidates.map((candidate) => ({
    ...candidate,
    sourceRank: 1
  }));
  const rankedFallback: RankedClassificationCandidate = { ...fallback, sourceRank: 2 };
  const candidatesWithPriority: RankedClassificationCandidate[] = [...userCandidates, ...rankedKeywordCandidates, rankedFallback];
  const candidates = candidatesWithPriority
    .sort((a, b) => a.sourceRank - b.sourceRank || (a.priorityIndex ?? 9999) - (b.priorityIndex ?? 9999) || b.confidence - a.confidence)
    .map((candidate) => stripPriority(candidate));
  const winner = candidates[0] ?? fallback;

  return {
    ...winner,
    iban,
    counterparty,
    isHighConfidence: winner.confidence >= HIGH_CONFIDENCE_LIMIT,
    candidates: candidates.slice(0, 5)
  };
}

export function normalizeTransactionText(value: string) {
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
    .replace(/\s+/g, " ")
    .trim();
}

export function extractIban(description: string) {
  return description.match(/\bTR\d{2}[A-Z0-9]{5,30}\b/i)?.[0]?.toUpperCase() ?? null;
}

export function extractCounterparty(description: string) {
  const clean = description
    .replace(/\bTR\d{2}[A-Z0-9]{5,30}\b/gi, "")
    .replace(/\b(EFT|FAST|HAVALE|POS|ATM|IBAN|REF|NO)\b/gi, "")
    .replace(/[0-9]{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length >= 3 ? clean.slice(0, 120) : null;
}

function buildRuleCandidate(
  rule: DeterministicTransactionRule,
  input: DeterministicCategorizeInput,
  description: string,
  iban: string | null,
  counterparty: string | null,
  categoryMap: Map<string, TransactionCategoryInput>,
  priorityIndex: number
): RuleClassificationCandidate | null {
  const ruleDirection = rule.direction.toUpperCase();
  if (ruleDirection !== "ANY" && ruleDirection !== input.direction) return null;

  const signals = ["yön eşleşti"];
  const amount = Math.abs(toNumber(input.amount));
  const amountMin = toNumber(rule.amountMin);
  const amountMax = toNumber(rule.amountMax);
  const hasAmountRange = amountMin > 0 || amountMax > 0;

  if (amountMin > 0 && amount < amountMin) return null;
  if (amountMax > 0 && amount > amountMax) return null;
  if (hasAmountRange) signals.push("tutar aralığı eşleşti");

  const keyword = rule.keyword.trim();
  const normalizedKeyword = normalizeTransactionText(keyword);
  const matchType = (rule.matchType || "DESCRIPTION_CONTAINS").toUpperCase();
  const matchSignal = ruleMatchSignal({ matchType, keyword, normalizedKeyword, description, iban, counterparty, amount });
  if (!matchSignal) return null;
  signals.push(matchSignal);

  const category = resolveCategory(rule.category, normalizeGroup(rule.targetGroup, input.direction), categoryMap);
  const confidence = scoreRuleConfidence(rule, signals, matchType);

  return {
    category: category.name,
    group: category.group,
    confidence,
    reason: `Kullanıcı kuralı: ${rule.name}. Eşleşen sinyaller: ${signals.join(", ")}.`,
    ruleId: rule.id,
    ruleName: rule.name,
    clientId: rule.clientId ?? null,
    caseFileId: rule.caseFileId ?? null,
    cashAccountId: rule.cashAccountId ?? null,
    matchedSignals: signals,
    priorityIndex,
    sourceRank: 0
  };
}

function ruleMatchSignal(input: {
  matchType: string;
  keyword: string;
  normalizedKeyword: string;
  description: string;
  iban: string | null;
  counterparty: string | null;
  amount: number;
}) {
  if (input.matchType === "AMOUNT_RANGE") return input.amount > 0 ? "tutar kriteri eşleşti" : null;
  if (!input.normalizedKeyword) return null;
  if (input.matchType === "COUNTERPARTY_MATCHES") {
    return normalizeTransactionText(input.counterparty ?? "").includes(input.normalizedKeyword) ? "karşı taraf eşleşti" : null;
  }
  if (input.matchType === "IBAN_MATCHES") {
    return normalizeIban(input.iban).includes(normalizeIban(input.keyword)) ? "IBAN eşleşti" : null;
  }
  if (input.matchType === "REGEX") {
    return regexMatches(input.keyword, input.description) ? "regex eşleşti" : null;
  }
  return input.description.includes(input.normalizedKeyword) ? "açıklama anahtar kelimesi eşleşti" : null;
}

function scoreRuleConfidence(rule: DeterministicTransactionRule, signals: string[], matchType: string) {
  const base = clampConfidence(toNumber(rule.confidence) || 0.9);
  const signalBonus = Math.min(0.12, Math.max(0, signals.length - 1) * 0.035);
  const matchBonus = matchType === "IBAN_MATCHES" ? 0.08 : matchType === "COUNTERPARTY_MATCHES" ? 0.06 : matchType === "REGEX" ? 0.04 : 0;
  return clampConfidence(roundConfidence(base + signalBonus + matchBonus));
}

function buildKeywordCandidates(
  input: DeterministicCategorizeInput,
  description: string,
  iban: string | null,
  counterparty: string | null,
  categoryMap: Map<string, TransactionCategoryInput>
): ClassificationCandidate[] {
  const keywordRules = [...transferRules, ...(input.direction === "IN" ? incomeRules : input.direction === "OUT" ? expenseRules : [])];

  return keywordRules
    .filter((rule) => rule.keywords.some((keyword) => description.includes(normalizeTransactionText(keyword))))
    .map((rule) => {
      const category = resolveCategory(rule.category, rule.group, categoryMap);
      return {
        category: category.name,
        group: category.group,
        confidence: rule.confidence,
        reason:
          rule.group === "TRANSFER"
            ? "Açıklama transfer/kredi kartı/nakit hareketi gibi görünüyor."
            : input.direction === "IN"
              ? "Açıklamadaki anahtar kelimeler gelir karakteri taşıyor."
              : "Açıklamadaki anahtar kelimeler gider kategorisiyle eşleşti.",
        ruleId: null,
        ruleName: null,
        clientId: null,
        caseFileId: null,
        cashAccountId: null,
        matchedSignals: ["sistem anahtar kelimesi"]
      };
    });
}

function buildFallbackCandidate(input: DeterministicCategorizeInput): ClassificationCandidate {
  const amount = Math.abs(toNumber(input.amount));
  if (input.direction === "IN") {
    return {
      category: amount > 0 ? "Diğer Gelir" : "Belirsiz Gelir",
      group: "INCOME",
      confidence: amount > 0 ? 0.58 : 0.4,
      reason: "Giriş yönü nedeniyle gelir adayı.",
      ruleId: null,
      ruleName: null,
      clientId: null,
      caseFileId: null,
      cashAccountId: null,
      matchedSignals: ["banka yönü giriş"]
    };
  }

  if (input.direction === "OUT") {
    return {
      category: amount > 0 ? "Diğer Gider" : "Belirsiz Gider",
      group: "EXPENSE",
      confidence: amount > 0 ? 0.56 : 0.4,
      reason: "Çıkış yönü nedeniyle gider adayı.",
      ruleId: null,
      ruleName: null,
      clientId: null,
      caseFileId: null,
      cashAccountId: null,
      matchedSignals: ["banka yönü çıkış"]
    };
  }

  return {
    category: "Nötr/Bilinmiyor",
    group: "NEUTRAL",
    confidence: 0.3,
    reason: "Tutar yönü belirgin değil.",
    ruleId: null,
    ruleName: null,
    clientId: null,
    caseFileId: null,
    cashAccountId: null,
    matchedSignals: ["nötr yön"]
  };
}

function stripPriority(candidate: RankedClassificationCandidate): ClassificationCandidate {
  const { priorityIndex, sourceRank, ...rest } = candidate;
  void priorityIndex;
  void sourceRank;
  return rest;
}

function buildCategoryMap(categories: TransactionCategoryInput[]) {
  const active = categories.filter((category) => category.isActive !== false);
  const entries = active.flatMap((category) => [
    [normalizeTransactionText(category.name), category] as const,
    [normalizeTransactionText(category.slug ?? ""), category] as const
  ]);
  return new Map(entries.filter(([key]) => Boolean(key)));
}

function resolveCategory(categoryName: string, fallbackGroup: TransactionGroup, categoryMap: Map<string, TransactionCategoryInput>) {
  const category = categoryMap.get(normalizeTransactionText(categoryName));
  if (!category) return { name: categoryName, group: fallbackGroup };
  return {
    name: category.name,
    group: normalizeGroup(category.group, normalizeDirection(category.direction))
  };
}

function normalizeDirection(value: string): TransactionDirection {
  const direction = value.toUpperCase();
  if (direction === "IN" || direction === "OUT" || direction === "NEUTRAL") return direction;
  return "NEUTRAL";
}

function normalizeIban(value: string | null) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function regexMatches(pattern: string, description: string) {
  try {
    return new RegExp(pattern, "i").test(description);
  } catch {
    return false;
  }
}

function normalizeGroup(value: string | null | undefined, direction: TransactionDirection): TransactionGroup {
  const group = value?.toUpperCase();
  if (group === "INCOME" || group === "EXPENSE" || group === "TRANSFER" || group === "NEUTRAL") return group;
  if (direction === "IN") return "INCOME";
  if (direction === "OUT") return "EXPENSE";
  return "NEUTRAL";
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}
