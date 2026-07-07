import { Prisma } from "@prisma/client";
import type { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { categorizeTransaction, type TransactionDirection } from "@/lib/bank-analysis/categorize-transaction";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { transactionRuleInputSchema, transactionRuleTestSchema } from "@/lib/validations";

export type TransactionRuleInput = z.infer<typeof transactionRuleInputSchema>;
export type TransactionRuleTestInput = z.infer<typeof transactionRuleTestSchema>;

export class TransactionRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionRuleError";
  }
}

export async function getTransactionRules(userId: string) {
  const rules = await prisma.transactionRule.findMany({
    where: { userId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      caseFile: { select: { id: true, title: true, fileNumber: true } },
      cashAccount: { select: { id: true, name: true, type: true } }
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });

  return rules.map(serializeRule);
}

export async function createTransactionRule(userId: string, input: TransactionRuleInput) {
  const data = await normalizeRuleInput(userId, input);
  const rule = await prisma.transactionRule.create({ data });

  await writeAuditLog({
    entityType: "TRANSACTION_RULE",
    entityId: rule.id,
    action: "CREATE",
    newValue: rule,
    message: "Akıllı sınıflandırma kuralı oluşturuldu",
    userId
  });

  return serializeRule(rule);
}

export async function updateTransactionRule(userId: string, id: string, input: TransactionRuleInput) {
  const existing = await prisma.transactionRule.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new TransactionRuleError("Kural bulunamadı.");

  const data = await normalizeRuleInput(userId, input);
  const rule = await prisma.transactionRule.update({ where: { id: existing.id }, data });

  await writeAuditLog({
    entityType: "TRANSACTION_RULE",
    entityId: rule.id,
    action: "UPDATE",
    oldValue: existing,
    newValue: rule,
    message: "Akıllı sınıflandırma kuralı güncellendi",
    userId
  });

  return serializeRule(rule);
}

export async function softDeleteTransactionRule(userId: string, id: string) {
  const existing = await prisma.transactionRule.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new TransactionRuleError("Kural bulunamadı.");

  const rule = await prisma.transactionRule.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), isActive: false }
  });

  await writeAuditLog({
    entityType: "TRANSACTION_RULE",
    entityId: rule.id,
    action: "DELETE",
    oldValue: existing,
    newValue: rule,
    message: "Akıllı sınıflandırma kuralı silindi",
    userId
  });

  return serializeRule(rule);
}

export async function testTransactionRules(userId: string, input: TransactionRuleTestInput) {
  const rules = await prisma.transactionRule.findMany({
    where: { userId, isActive: true, deletedAt: null },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      keyword: true,
      matchType: true,
      direction: true,
      category: true,
      targetGroup: true,
      amountMin: true,
      amountMax: true,
      confidence: true,
      clientId: true,
      caseFileId: true,
      cashAccountId: true
    }
  });
  const suggestion = categorizeTransaction(
    {
      description: input.description,
      direction: input.direction as TransactionDirection,
      amount: input.amount,
      iban: input.iban,
      counterparty: input.counterparty
    },
    rules
  );
  const matchedRule = suggestion.ruleId
    ? await prisma.transactionRule.findFirst({
        where: { id: suggestion.ruleId, userId },
        include: {
          client: { select: { id: true, name: true } },
          caseFile: { select: { id: true, title: true, fileNumber: true } },
          cashAccount: { select: { id: true, name: true, type: true } }
        }
      })
    : null;

  return {
    matched: Boolean(suggestion.ruleId),
    suggestion: {
      category: suggestion.category,
      group: suggestion.group,
      confidence: suggestion.confidence,
      confidenceLabel: `%${Math.round(suggestion.confidence * 100)}`,
      reason: suggestion.reason,
      ruleId: suggestion.ruleId,
      ruleName: suggestion.ruleName,
      clientId: suggestion.clientId,
      caseFileId: suggestion.caseFileId,
      cashAccountId: suggestion.cashAccountId,
      iban: suggestion.iban,
      counterparty: suggestion.counterparty,
      isHighConfidence: suggestion.isHighConfidence
    },
    rule: matchedRule ? serializeRule(matchedRule) : null
  };
}

async function normalizeRuleInput(userId: string, input: TransactionRuleInput): Promise<Prisma.TransactionRuleUncheckedCreateInput> {
  const [clientId, caseFileId, cashAccountId] = await Promise.all([
    resolveClientId(userId, input.clientId),
    resolveCaseFileId(userId, input.caseFileId),
    resolveCashAccountId(userId, input.cashAccountId)
  ]);

  if (clientId && caseFileId) {
    const caseFile = await prisma.caseFile.findFirst({ where: { id: caseFileId, userId, clientId, deletedAt: null }, select: { id: true } });
    if (!caseFile) throw new TransactionRuleError("Seçilen dosya seçilen müvekkile bağlı değil.");
  }

  return {
    userId,
    name: input.name.trim(),
    keyword: input.keyword?.trim() ?? "",
    matchType: input.matchType,
    direction: input.direction,
    category: input.category.trim(),
    targetGroup: input.targetGroup || null,
    amountMin: optionalDecimal(input.amountMin),
    amountMax: optionalDecimal(input.amountMax),
    priority: input.priority,
    confidence: new Prisma.Decimal(input.confidence),
    clientId,
    caseFileId,
    cashAccountId,
    isActive: input.isActive
  };
}

async function resolveClientId(userId: string, clientId?: string | null) {
  if (!clientId) return null;
  const client = await prisma.client.findFirst({ where: { id: clientId, userId, deletedAt: null, archivedAt: null }, select: { id: true } });
  if (!client) throw new TransactionRuleError("Seçilen müvekkil bulunamadı.");
  return client.id;
}

async function resolveCaseFileId(userId: string, caseFileId?: string | null) {
  if (!caseFileId) return null;
  const caseFile = await prisma.caseFile.findFirst({ where: { id: caseFileId, userId, deletedAt: null, archivedAt: null }, select: { id: true } });
  if (!caseFile) throw new TransactionRuleError("Seçilen dosya bulunamadı.");
  return caseFile.id;
}

async function resolveCashAccountId(userId: string, cashAccountId?: string | null) {
  if (!cashAccountId) return null;
  const account = await prisma.cashAccount.findFirst({ where: { id: cashAccountId, userId, deletedAt: null, isActive: true }, select: { id: true } });
  if (!account) throw new TransactionRuleError("Seçilen kasa hesabı bulunamadı.");
  return account.id;
}

function optionalDecimal(value?: string | null) {
  if (!value) return null;
  return new Prisma.Decimal(value);
}

function serializeRule(rule: {
  id: string;
  name: string;
  keyword: string;
  matchType?: string | null;
  direction: string;
  category: string;
  targetGroup: string | null;
  amountMin?: Prisma.Decimal | null;
  amountMax?: Prisma.Decimal | null;
  priority: number;
  confidence: Prisma.Decimal;
  clientId: string | null;
  caseFileId: string | null;
  cashAccountId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  client?: { id: string; name: string } | null;
  caseFile?: { id: string; title: string; fileNumber: string | null } | null;
  cashAccount?: { id: string; name: string; type: string } | null;
}) {
  return {
    id: rule.id,
    name: rule.name,
    keyword: rule.keyword,
    matchType: rule.matchType ?? "DESCRIPTION_CONTAINS",
    direction: rule.direction,
    category: rule.category,
    targetGroup: rule.targetGroup ?? "",
    amountMin: rule.amountMin ? toNumber(rule.amountMin) : null,
    amountMax: rule.amountMax ? toNumber(rule.amountMax) : null,
    priority: rule.priority,
    confidence: toNumber(rule.confidence),
    clientId: rule.clientId,
    caseFileId: rule.caseFileId,
    cashAccountId: rule.cashAccountId ?? null,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    deletedAt: rule.deletedAt?.toISOString() ?? null,
    clientName: rule.client?.name ?? null,
    caseFileTitle: rule.caseFile ? `${rule.caseFile.title}${rule.caseFile.fileNumber ? ` · ${rule.caseFile.fileNumber}` : ""}` : null,
    cashAccountName: rule.cashAccount?.name ?? null
  };
}
