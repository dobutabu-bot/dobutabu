import { Prisma, type BankStatementDirection, type BankStatementMatchType, type CashLedgerDirection } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { normalizeTransactionText } from "@/lib/bank-analysis/categorize-transaction";
import {
  isAmbiguousLedgerSuggestion,
  RECONCILIATION_THRESHOLDS,
  suggestLedgerMatches
} from "@/lib/bank-analysis/reconciliation";
import { syncExpenseLedgerEntry, syncIncomeLedgerEntry } from "@/lib/cash-ledger";
import { getAllCashAccountBalances, getCashAccountBalance, resolveCashAccountId } from "@/lib/cash/cash-account-service";
import { validateOwnedClientAndCase } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { APPROVED_BANK_MATCH_TYPES, isApprovedBankMatch, isIgnoredBankMatch } from "@/lib/reconciliation/match-status";
import { dateInputValue, formatMoney, parseDateInput, toNumber } from "@/lib/utils";

export type ReconciliationScope = {
  userId: string;
  importId?: string | null;
  page?: number;
  pageSize?: number;
};

export type ReconciliationSuggestion = {
  bankRowId: string;
  bankRowNumber: number;
  bankDate: string | null;
  bankDescription: string;
  bankDirection: BankStatementDirection;
  bankAmount: number;
  systemEntryId: string;
  systemDate: string;
  systemDescription: string;
  systemDirection: CashLedgerDirection;
  systemAmount: number;
  systemType: string;
  incomeId: string | null;
  expenseId: string | null;
  dateDiffDays: number;
  confidence: number;
  confidenceLabel: "Yüksek" | "Orta" | "Düşük";
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  requiresUserApproval: true;
};

type BankRow = Prisma.BankStatementRowGetPayload<{
  include: {
    clientSuggestion: { select: { name: true } };
    caseFileSuggestion: { select: { title: true; fileNumber: true } };
    import: { select: { id: true; bankName: true; cashAccountId: true; closingBalance: true; currency: true } };
  };
}>;

type LedgerEntry = Prisma.CashLedgerEntryGetPayload<{
  include: {
    client: { select: { name: true } };
    caseFile: { select: { title: true; fileNumber: true } };
    cashAccount: { select: { name: true } };
  };
}>;

type CreateRecordFromBankRowInput = {
  userId: string;
  bankRowId: string;
  kind: "INCOME" | "EXPENSE" | "LEDGER";
  clientId?: string | null;
  caseFileId?: string | null;
  cashAccountId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  date?: string | null;
  description?: string | null;
  incomeCategory?: "LEGAL_FEE" | "ADVANCE" | "EXPENSE_REIMBURSEMENT" | "OTHER" | null;
  expenseCategory?: "COURT_FEE" | "NOTARY" | "TRAVEL" | "ACCOMMODATION" | "OFFICE" | "TAX" | "PERSONNEL" | "MEAL" | "OTHER" | null;
  isClientExpense?: boolean | null;
};

export async function getReconciliationData(scope: ReconciliationScope) {
  const page = Math.max(1, scope.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, scope.pageSize ?? 25));
  const [imports, bankRows, actionOptions] = await Promise.all([getImportOptions(scope.userId), getBankRows(scope), getActionOptions(scope.userId)]);
  const selectedImport = scope.importId ? imports.find((item) => item.id === scope.importId) ?? null : null;
  const systemEntries = await getSystemEntries(scope.userId, bankRows, selectedImport?.cashAccountId ?? undefined);
  const suggestions = buildSuggestions(bankRows, systemEntries);
  const matchedRows = bankRows.filter(isMatchedBankRow);
  const ignoredRows = bankRows.filter(isIgnoredBankMatch);
  const unmatchedBankRows = bankRows.filter((row) => !isMatchedBankRow(row) && !isIgnoredBankMatch(row));
  const suggestedBankIds = new Set(suggestions.map((suggestion) => suggestion.bankRowId));
  const unmatchedBankWithoutSuggestion = unmatchedBankRows.filter((row) => !suggestedBankIds.has(row.id));
  const matchedLedgerIds = new Set(bankRows.filter(isMatchedBankRow).map((row) => row.matchedCashLedgerEntryId).filter(Boolean));
  const suggestedLedgerIds = new Set(suggestions.filter((suggestion) => suggestion.confidence >= RECONCILIATION_THRESHOLDS.suggest).map((suggestion) => suggestion.systemEntryId));
  const unmatchedSystemMovements = systemEntries
    .filter((entry) => !matchedLedgerIds.has(entry.id) && !suggestedLedgerIds.has(entry.id))
    .map(serializeLedgerEntry);
  const balances = await getBalanceComparison(scope.userId, selectedImport ?? null, imports);
  const pagedUnmatchedBankRows = unmatchedBankWithoutSuggestion.slice((page - 1) * pageSize, page * pageSize);

  return {
    imports,
    selectedImport,
    balances,
    counts: {
      matched: matchedRows.length,
      unmatchedBank: unmatchedBankWithoutSuggestion.length,
      unmatchedSystem: unmatchedSystemMovements.length,
      suggestions: suggestions.length,
      ignored: ignoredRows.length
    },
    suggestions: suggestions.slice(0, 50),
    unmatchedBankRows: pagedUnmatchedBankRows.map(serializeBankRow),
    unmatchedSystemMovements: unmatchedSystemMovements.slice(0, 100),
    matchedRows: matchedRows.slice(0, 50).map(serializeBankRow),
    ignoredRows: ignoredRows.slice(0, 50).map(serializeBankRow),
    manualOptions: {
      bankRows: unmatchedBankRows.slice(0, 200).map(serializeBankRow),
      systemMovements: unmatchedSystemMovements.slice(0, 200)
    },
    actionOptions,
    pagination: {
      page,
      pageSize,
      totalRows: unmatchedBankWithoutSuggestion.length,
      totalPages: Math.max(1, Math.ceil(unmatchedBankWithoutSuggestion.length / pageSize))
    }
  };
}

export async function matchBankStatementRow({
  userId,
  bankRowId,
  targetType,
  targetId,
  matchMode = "MANUALLY_MATCHED"
}: {
  userId: string;
  bankRowId: string;
  targetType: "LEDGER" | "INCOME" | "EXPENSE";
  targetId: string;
  matchMode?: "AUTO_MATCHED" | "MANUALLY_MATCHED";
}) {
  const [bankRow, target] = await Promise.all([
    prisma.bankStatementRow.findFirst({ where: { id: bankRowId, userId, deletedAt: null, import: { deletedAt: null } } }),
    resolveMatchTarget(userId, targetType, targetId)
  ]);

  if (!bankRow) {
    throw new ReconciliationError("Banka hareketi bulunamadı.");
  }

  if (!target) {
    throw new ReconciliationError("Eşleştirilecek sistem hareketi bulunamadı.");
  }

  if (isMatchedBankRow(bankRow)) {
    throw new ReconciliationError("Bu banka hareketi zaten eşleştirilmiş. Önce mevcut eşleşmeyi geri alın.");
  }

  validateDirection(bankRow.direction, target.direction);
  validateAmount(bankRow.amount, target.amount);
  await assertTargetNotAlreadyMatched(userId, bankRow.id, target);

  const updated = await prisma.bankStatementRow.update({
    where: { id: bankRow.id },
    data: {
      matchType: matchMode,
      matchedCashLedgerEntryId: target.ledgerEntryId,
      matchedIncomeId: target.incomeId,
      matchedExpenseId: target.expenseId
    }
  });

  await writeAuditLog({
    entityType: "BANK_STATEMENT_ROW",
    entityId: updated.id,
    action: "UPDATE",
    oldValue: bankRow,
    newValue: updated,
    message: matchMode === "AUTO_MATCHED" ? "Banka hareketi önerilen sistem kaydıyla onaylanarak eşleştirildi" : "Banka hareketi manuel sistem kaydıyla eşleştirildi",
    userId
  });

  return updated;
}

export async function unmatchBankStatementRow(userId: string, bankRowId: string) {
  const existing = await prisma.bankStatementRow.findFirst({ where: { id: bankRowId, userId, deletedAt: null } });
  if (!existing) throw new ReconciliationError("Banka hareketi bulunamadı.");

  const [createdIncome, createdExpense, createdLedger] =
    existing.matchType === "CREATED_FROM_BANK"
      ? await Promise.all([
          existing.matchedIncomeId ? prisma.income.findFirst({ where: { id: existing.matchedIncomeId, userId } }) : null,
          existing.matchedExpenseId ? prisma.expense.findFirst({ where: { id: existing.matchedExpenseId, userId } }) : null,
          existing.matchedCashLedgerEntryId ? prisma.cashLedgerEntry.findFirst({ where: { id: existing.matchedCashLedgerEntryId, userId } }) : null
        ])
      : [null, null, null];

  const updated = await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();

    if (existing.matchType === "CREATED_FROM_BANK") {
      if (existing.matchedIncomeId) {
        await tx.income.updateMany({ where: { id: existing.matchedIncomeId, userId, deletedAt: null }, data: { deletedAt } });
        await tx.document.updateMany({ where: { userId, linkedIncomeId: existing.matchedIncomeId }, data: { linkedIncomeId: null } });
      }

      if (existing.matchedExpenseId) {
        await tx.expense.updateMany({ where: { id: existing.matchedExpenseId, userId, deletedAt: null }, data: { deletedAt } });
        await tx.document.updateMany({ where: { userId, linkedExpenseId: existing.matchedExpenseId }, data: { linkedExpenseId: null } });
      }

      if (existing.matchedCashLedgerEntryId) {
        await tx.cashLedgerEntry.updateMany({
          where: { id: existing.matchedCashLedgerEntryId, userId, deletedAt: null },
          data: { deletedAt }
        });
        await tx.document.updateMany({ where: { userId, linkedCashLedgerEntryId: existing.matchedCashLedgerEntryId }, data: { linkedCashLedgerEntryId: null } });
      }
    }

    return tx.bankStatementRow.update({
      where: { id: existing.id },
      data: {
        matchType: "NONE",
        matchedCashLedgerEntryId: null,
        matchedIncomeId: null,
        matchedExpenseId: null
      }
    });
  });

  await writeAuditLog({
    entityType: "BANK_STATEMENT_ROW",
    entityId: updated.id,
    action: "UPDATE",
    oldValue: existing,
    newValue: updated,
    message:
      existing.matchType === "CREATED_FROM_BANK"
        ? "Bankadan oluşturulan kayıt geri alındı"
        : existing.matchType === "IGNORED"
          ? "Banka hareketinin yoksayma durumu geri alındı"
          : "Banka hareketi eşleşmesi geri alındı",
    userId
  });
  await Promise.all([
    createdIncome
      ? writeAuditLog({
          entityType: "INCOME",
          entityId: createdIncome.id,
          action: "DELETE",
          oldValue: createdIncome,
          message: "Bankadan oluşturulan tahsilat geri alındı",
          userId
        })
      : null,
    createdExpense
      ? writeAuditLog({
          entityType: "EXPENSE",
          entityId: createdExpense.id,
          action: "DELETE",
          oldValue: createdExpense,
          message: "Bankadan oluşturulan gider geri alındı",
          userId
        })
      : null,
    createdLedger
      ? writeAuditLog({
          entityType: "CASH_LEDGER_ENTRY",
          entityId: createdLedger.id,
          action: "DELETE",
          oldValue: createdLedger,
          message: "Bankadan oluşturulan kasa hareketi geri alındı",
          userId
        })
      : null
  ]);

  return updated;
}

export async function ignoreBankStatementRow(userId: string, bankRowId: string) {
  const existing = await prisma.bankStatementRow.findFirst({ where: { id: bankRowId, userId, deletedAt: null } });
  if (!existing) throw new ReconciliationError("Banka hareketi bulunamadı.");

  const updated = await prisma.bankStatementRow.update({
    where: { id: existing.id },
    data: {
      matchType: "IGNORED",
      matchedCashLedgerEntryId: null,
      matchedIncomeId: null,
      matchedExpenseId: null
    }
  });

  await writeAuditLog({
    entityType: "BANK_STATEMENT_ROW",
    entityId: updated.id,
    action: "CANCEL",
    oldValue: existing,
    newValue: updated,
    message: "Banka hareketi mutabakatta yoksayıldı",
    userId
  });

  return updated;
}

export async function createRecordFromBankRow({
  userId,
  bankRowId,
  kind,
  clientId,
  caseFileId,
  cashAccountId: inputCashAccountId,
  amount: inputAmount,
  currency: inputCurrency,
  date: inputDate,
  description: inputDescription,
  incomeCategory,
  expenseCategory,
  isClientExpense
}: CreateRecordFromBankRowInput) {
  const row = await prisma.bankStatementRow.findFirst({
    where: { id: bankRowId, userId, deletedAt: null, import: { deletedAt: null } },
    include: { import: { select: { cashAccountId: true, documentId: true } } }
  });

  if (!row) throw new ReconciliationError("Banka hareketi bulunamadı.");
  if (isMatchedBankRow(row)) throw new ReconciliationError("Bu banka hareketi zaten eşleştirilmiş.");
  if (row.matchType === "IGNORED") throw new ReconciliationError("Yoksayılan banka hareketinden kayıt oluşturulamaz. Önce yoksayma durumunu kaldırın.");
  if ((kind === "INCOME" && row.direction !== "IN") || (kind === "EXPENSE" && row.direction !== "OUT") || (kind === "LEDGER" && row.direction === "NEUTRAL")) {
    throw new ReconciliationError("Banka hareketi yönü oluşturulacak kayıt tipiyle uyumlu değil.");
  }

  const amount = normalizeBankRowAmount(inputAmount, row.amount);
  const entryDate = normalizeBankRowDate(inputDate, row.transactionDate);
  const currency = (inputCurrency || row.currency || "TRY").toUpperCase();
  const description = cleanText(inputDescription) ?? row.description;
  const cashAccountId = await resolveCashAccountId(userId, inputCashAccountId ?? row.cashAccountId ?? row.import.cashAccountId);
  const existingCandidate = await findDuplicateLedgerCandidate(userId, { amount, direction: row.direction, transactionDate: entryDate, cashAccountId });
  if (existingCandidate) {
    throw new ReconciliationError("Aynı tutar ve tarihe yakın bir kasa hareketi zaten var. Yeni kayıt yerine mevcut kayıtla eşleştirin.");
  }

  if (kind === "INCOME") {
    const requestedClientId = clientId ?? row.clientSuggestionId;
    const requestedCaseFileId = caseFileId ?? row.caseFileSuggestionId;
    if (!requestedClientId && !requestedCaseFileId) {
      throw new ReconciliationError("Tahsilat oluşturmak için önce müvekkil seçin veya hareketi bir müvekkile bağlayın.");
    }

    const ownership = await validateOwnedClientAndCase(userId, requestedClientId, requestedCaseFileId);
    if (!ownership.ok) throw new ReconciliationError(ownership.message);
    const resolvedIncomeClientId = ownership.clientId;
    if (!resolvedIncomeClientId) throw new ReconciliationError("Tahsilat oluşturmak için müvekkil bilgisi çözülemedi.");

    const result = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          userId,
          clientId: resolvedIncomeClientId,
          caseFileId: requestedCaseFileId ?? undefined,
          cashAccountId,
          amount,
          currency,
          date: entryDate,
          paymentMethod: "BANK_TRANSFER",
          category: incomeCategory ?? "LEGAL_FEE",
          description,
          receiptIssued: false
        }
      });
      const ledger = await syncIncomeLedgerEntry(userId, income, tx);
      await linkImportDocumentToCreatedRecord(tx, userId, row.import.documentId, { incomeId: income.id, ledgerId: ledger.id });
      const updatedRow = await tx.bankStatementRow.update({
        where: { id: row.id },
        data: {
          matchType: "CREATED_FROM_BANK",
          matchedIncomeId: income.id,
          matchedCashLedgerEntryId: ledger.id
        }
      });
      return { income, ledger, updatedRow };
    });

    await auditCreatedRecord(userId, row, result.updatedRow, result.income, result.ledger, "Tahsilat");
    return result.updatedRow;
  }

  if (kind === "EXPENSE") {
    const expenseClientId = clientId ?? row.clientSuggestionId;
    const expenseCaseFileId = caseFileId ?? row.caseFileSuggestionId;
    const ownership = await validateOwnedClientAndCase(userId, expenseClientId, expenseCaseFileId);
    if (!ownership.ok) throw new ReconciliationError(ownership.message);

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          userId,
          clientId: ownership.clientId ?? undefined,
          caseFileId: expenseCaseFileId ?? undefined,
          cashAccountId,
          amount,
          currency,
          date: entryDate,
          paymentMethod: "BANK_TRANSFER",
          category: expenseCategory ?? mapExpenseCategory(row.categorySuggestion),
          isClientExpense: isClientExpense ?? Boolean(ownership.clientId ?? expenseCaseFileId),
          description
        }
      });
      const ledger = await syncExpenseLedgerEntry(userId, expense, tx);
      await linkImportDocumentToCreatedRecord(tx, userId, row.import.documentId, { expenseId: expense.id, ledgerId: ledger.id });
      const updatedRow = await tx.bankStatementRow.update({
        where: { id: row.id },
        data: {
          matchType: "CREATED_FROM_BANK",
          matchedExpenseId: expense.id,
          matchedCashLedgerEntryId: ledger.id
        }
      });
      return { expense, ledger, updatedRow };
    });

    await auditCreatedRecord(userId, row, result.updatedRow, result.expense, result.ledger, "Gider");
    return result.updatedRow;
  }

  const ledgerClientId = clientId ?? row.clientSuggestionId;
  const ledgerCaseFileId = caseFileId ?? row.caseFileSuggestionId;
  const ownership = await validateOwnedClientAndCase(userId, ledgerClientId, ledgerCaseFileId);
  if (!ownership.ok) throw new ReconciliationError(ownership.message);

  const result = await prisma.$transaction(async (tx) => {
    const ledger = await tx.cashLedgerEntry.create({
      data: {
        userId,
        cashAccountId,
        direction: row.direction as CashLedgerDirection,
        entryType: "ADJUSTMENT",
        amount,
        currency,
        date: entryDate,
        description,
        referenceNo: `BANK:${row.id}`,
        clientId: ownership.clientId ?? undefined,
        caseFileId: ledgerCaseFileId ?? undefined
      }
    });
    await linkImportDocumentToCreatedRecord(tx, userId, row.import.documentId, { ledgerId: ledger.id });
    const updatedRow = await tx.bankStatementRow.update({
      where: { id: row.id },
      data: {
        matchType: "CREATED_FROM_BANK",
        matchedIncomeId: null,
        matchedExpenseId: null,
        matchedCashLedgerEntryId: ledger.id
      }
    });
    return { ledger, updatedRow };
  });

  await auditCreatedRecord(userId, row, result.updatedRow, { id: result.ledger.id }, result.ledger, "Kasa hareketi");
  return result.updatedRow;
}

async function getActionOptions(userId: string) {
  const [clients, caseFiles, cashAccounts] = await Promise.all([
    prisma.client.findMany({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.caseFile.findMany({
      where: { userId, deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      select: { id: true, clientId: true, title: true, fileNumber: true, client: { select: { name: true } } }
    }),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, currency: true, isDefault: true }
    })
  ]);

  return {
    clients,
    caseFiles: caseFiles.map((item) => ({
      id: item.id,
      clientId: item.clientId,
      title: item.fileNumber ? `${item.title} · ${item.fileNumber}` : item.title,
      clientName: item.client.name
    })),
    cashAccounts
  };
}

async function getImportOptions(userId: string) {
  return prisma.bankStatementImport.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      originalFileName: true,
      periodStart: true,
      periodEnd: true,
      cashAccountId: true,
      closingBalance: true,
      currency: true,
      cashAccount: { select: { name: true } }
    },
    take: 100
  });
}

async function getBankRows(scope: ReconciliationScope): Promise<BankRow[]> {
  return prisma.bankStatementRow.findMany({
    where: {
      userId: scope.userId,
      deletedAt: null,
      status: "SUCCESS",
      transactionDate: { not: null },
      import: { deletedAt: null, ...(scope.importId ? { id: scope.importId } : {}) }
    },
    orderBy: [{ transactionDate: "desc" }, { rowNumber: "desc" }],
    include: {
      clientSuggestion: { select: { name: true } },
      caseFileSuggestion: { select: { title: true, fileNumber: true } },
      import: { select: { id: true, bankName: true, cashAccountId: true, closingBalance: true, currency: true } }
    },
    take: 10000
  });
}

async function getSystemEntries(userId: string, bankRows: BankRow[], cashAccountId?: string | null): Promise<LedgerEntry[]> {
  const sortedDates = bankRows
    .map((row) => row.transactionDate)
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const startDate = sortedDates[0] ? new Date(sortedDates[0].getTime() - 7 * 86400000) : undefined;
  const endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1].getTime() + 7 * 86400000) : undefined;

  return prisma.cashLedgerEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {})
    },
    orderBy: { date: "desc" },
    include: {
      client: { select: { name: true } },
      caseFile: { select: { title: true, fileNumber: true } },
      cashAccount: { select: { name: true } }
    },
    take: 3000
  });
}

function buildSuggestions(bankRows: BankRow[], systemEntries: LedgerEntry[]) {
  const usedSystemEntries = new Set(bankRows.filter(isMatchedBankRow).map((row) => row.matchedCashLedgerEntryId).filter(Boolean));

  return bankRows
    .filter((row) => !isMatchedBankRow(row) && !isIgnoredBankMatch(row))
    .flatMap((row) => {
      const bankMovement = toBankMovementForEngine(row);
      const ledgerCandidates = systemEntries.filter((entry) => !usedSystemEntries.has(entry.id)).map(toLedgerMovementForEngine);
      return suggestLedgerMatches(bankMovement, ledgerCandidates, 3)
        .filter((suggestion) => !isAmbiguousLedgerSuggestion(suggestion, bankMovement, ledgerCandidates))
        .map((suggestion) => toReconciliationSuggestion(row, systemEntries, suggestion))
        .filter((suggestion): suggestion is ReconciliationSuggestion => suggestion != null);
    })
    .filter((suggestion) => suggestion.confidence >= RECONCILIATION_THRESHOLDS.suggest)
    .sort((a, b) => b.confidence - a.confidence);
}

function toBankMovementForEngine(row: BankRow) {
  return {
    id: row.id,
    rowNumber: row.rowNumber,
    transactionDate: row.transactionDate,
    description: row.description,
    amount: row.amount,
    direction: row.direction,
    cashAccountId: row.cashAccountId,
    importCashAccountId: row.import.cashAccountId,
    clientSuggestionName: row.clientSuggestion?.name ?? null,
    caseFileSuggestionTitle: row.caseFileSuggestion?.title ?? null,
    caseFileSuggestionFileNumber: row.caseFileSuggestion?.fileNumber ?? null,
    matchType: row.matchType,
    matchedCashLedgerEntryId: row.matchedCashLedgerEntryId,
    matchedIncomeId: row.matchedIncomeId,
    matchedExpenseId: row.matchedExpenseId
  };
}

function toLedgerMovementForEngine(entry: LedgerEntry) {
  return {
    id: entry.id,
    incomeId: entry.incomeId,
    expenseId: entry.expenseId,
    direction: entry.direction,
    amount: entry.amount,
    date: entry.date,
    description: entry.description,
    clientId: entry.clientId,
    clientName: entry.client?.name ?? null,
    caseFileId: entry.caseFileId,
    caseFileTitle: entry.caseFile?.title ?? null,
    caseFileNumber: entry.caseFile?.fileNumber ?? null,
    cashAccountId: entry.cashAccountId
  };
}

function toReconciliationSuggestion(
  row: BankRow,
  systemEntries: LedgerEntry[],
  suggestion: ReturnType<typeof suggestLedgerMatches>[number]
): ReconciliationSuggestion | null {
  const entry = systemEntries.find((item) => item.id === suggestion.ledgerEntryId);
  if (!entry || !row.transactionDate) return null;
  const normalizedConfidence = suggestion.confidence;

  return {
    bankRowId: row.id,
    bankRowNumber: row.rowNumber,
    bankDate: dateInputValue(row.transactionDate),
    bankDescription: row.description,
    bankDirection: row.direction,
    bankAmount: Math.abs(toNumber(row.amount)),
    systemEntryId: entry.id,
    systemDate: dateInputValue(entry.date),
    systemDescription: entry.description ?? "-",
    systemDirection: entry.direction,
    systemAmount: Math.abs(toNumber(entry.amount)),
    systemType: entry.entryType,
    incomeId: entry.incomeId,
    expenseId: entry.expenseId,
    dateDiffDays: suggestion.dateDiffDays,
    confidence: normalizedConfidence,
    confidenceLabel: confidenceLabel(normalizedConfidence),
    confidenceBand: suggestion.confidenceBand,
    reasons: suggestion.reasons,
    requiresUserApproval: true
  };
}

async function getBalanceComparison(
  userId: string,
  selectedImport: Awaited<ReturnType<typeof getImportOptions>>[number] | null,
  imports: Awaited<ReturnType<typeof getImportOptions>>
) {
  const bankBalance = selectedImport ? toNumber(selectedImport.closingBalance) : sumLatestImportBalances(imports);
  const systemBalance = selectedImport?.cashAccountId
    ? (await getCashAccountBalance(userId, selectedImport.cashAccountId)).balance
    : (await getAllCashAccountBalances(userId)).reduce((total, account) => total + account.balance, 0);
  const difference = round(bankBalance - systemBalance);
  const currency = selectedImport?.currency ?? imports[0]?.currency ?? "TRY";

  return {
    bankBalance,
    bankBalanceLabel: formatMoney(bankBalance, currency),
    systemBalance,
    systemBalanceLabel: formatMoney(systemBalance, currency),
    difference,
    differenceLabel: formatMoney(difference, currency),
    currency,
    tone: (difference > 0 ? "green" : difference < 0 ? "rose" : "neutral") as "green" | "rose" | "neutral"
  };
}

function sumLatestImportBalances(imports: Awaited<ReturnType<typeof getImportOptions>>) {
  const byAccount = new Map<string, (typeof imports)[number]>();

  for (const item of imports) {
    const key = item.cashAccountId ?? item.id;
    const current = byAccount.get(key);
    if (!current || Number(item.periodEnd ?? 0) > Number(current.periodEnd ?? 0)) {
      byAccount.set(key, item);
    }
  }

  return round([...byAccount.values()].reduce((total, item) => total + toNumber(item.closingBalance), 0));
}

function serializeBankRow(row: BankRow) {
  return {
    id: row.id,
    rowNumber: row.rowNumber,
    date: row.transactionDate ? dateInputValue(row.transactionDate) : null,
    description: row.description,
    direction: row.direction,
    amount: Math.abs(toNumber(row.amount)),
    currency: row.currency,
    amountLabel: formatMoney(Math.abs(toNumber(row.amount)), row.currency),
    signedAmount: row.direction === "OUT" ? -Math.abs(toNumber(row.amount)) : Math.abs(toNumber(row.amount)),
    category: row.categorySuggestion ?? "-",
    matchType: row.matchType,
    cashAccountId: row.cashAccountId ?? row.import.cashAccountId,
    clientSuggestionId: row.clientSuggestionId,
    caseFileSuggestionId: row.caseFileSuggestionId,
    bankName: row.import.bankName,
    clientSuggestion: row.clientSuggestion?.name ?? "-",
    caseFileSuggestion: row.caseFileSuggestion?.title ?? "-"
  };
}

function serializeLedgerEntry(entry: LedgerEntry) {
  return {
    id: entry.id,
    date: dateInputValue(entry.date),
    description: entry.description ?? "-",
    direction: entry.direction,
    entryType: entry.entryType,
    amount: Math.abs(toNumber(entry.amount)),
    signedAmount: entry.direction === "OUT" ? -Math.abs(toNumber(entry.amount)) : Math.abs(toNumber(entry.amount)),
    currency: entry.currency,
    amountLabel: formatMoney(entry.amount, entry.currency),
    clientName: entry.client?.name ?? "-",
    caseFileTitle: entry.caseFile?.title ?? "-",
    cashAccountName: entry.cashAccount.name,
    incomeId: entry.incomeId,
    expenseId: entry.expenseId
  };
}

async function resolveMatchTarget(userId: string, targetType: "LEDGER" | "INCOME" | "EXPENSE", targetId: string) {
  if (targetType === "LEDGER") {
    const entry = await prisma.cashLedgerEntry.findFirst({ where: { id: targetId, userId, deletedAt: null } });
    return entry
      ? {
          ledgerEntryId: entry.id,
          incomeId: entry.incomeId,
          expenseId: entry.expenseId,
          direction: entry.direction,
          amount: entry.amount
        }
      : null;
  }

  if (targetType === "INCOME") {
    const [income, ledger] = await Promise.all([
      prisma.income.findFirst({ where: { id: targetId, userId, deletedAt: null } }),
      prisma.cashLedgerEntry.findUnique({ where: { incomeId: targetId } })
    ]);
    return income
      ? {
          ledgerEntryId: ledger?.id ?? null,
          incomeId: income.id,
          expenseId: null,
          direction: "IN" as const,
          amount: income.amount
        }
      : null;
  }

  const [expense, ledger] = await Promise.all([
    prisma.expense.findFirst({ where: { id: targetId, userId, deletedAt: null } }),
    prisma.cashLedgerEntry.findUnique({ where: { expenseId: targetId } })
  ]);
  return expense
    ? {
        ledgerEntryId: ledger?.id ?? null,
        incomeId: null,
        expenseId: expense.id,
        direction: "OUT" as const,
        amount: expense.amount
      }
    : null;
}

async function assertTargetNotAlreadyMatched(
  userId: string,
  currentBankRowId: string,
  target: { ledgerEntryId: string | null; incomeId: string | null; expenseId: string | null }
) {
  const or: Prisma.BankStatementRowWhereInput[] = [];
  if (target.ledgerEntryId) or.push({ matchedCashLedgerEntryId: target.ledgerEntryId });
  if (target.incomeId) or.push({ matchedIncomeId: target.incomeId });
  if (target.expenseId) or.push({ matchedExpenseId: target.expenseId });
  if (or.length === 0) return;

  const existing = await prisma.bankStatementRow.findFirst({
    where: {
      userId,
      id: { not: currentBankRowId },
      deletedAt: null,
      matchType: { in: [...APPROVED_BANK_MATCH_TYPES] },
      OR: or
    },
    select: { id: true }
  });

  if (existing) {
    throw new ReconciliationError("Bu sistem hareketi başka bir banka hareketiyle eşleştirilmiş. Duplicate eşleşme oluşturulmadı.");
  }
}

async function findDuplicateLedgerCandidate(
  userId: string,
  row: { amount: Prisma.Decimal | null; direction: BankStatementDirection; transactionDate: Date | null; cashAccountId: string }
) {
  if (!row.amount || !row.transactionDate || row.direction === "NEUTRAL") return null;
  const start = new Date(row.transactionDate.getTime() - 3 * 86400000);
  const end = new Date(row.transactionDate.getTime() + 3 * 86400000);
  const entries = await prisma.cashLedgerEntry.findMany({
    where: { userId, cashAccountId: row.cashAccountId, deletedAt: null, direction: row.direction, date: { gte: start, lte: end } },
    select: { id: true, amount: true },
    take: 20
  });
  const amount = Math.abs(toNumber(row.amount));
  return entries.find((entry) => Math.abs(Math.abs(toNumber(entry.amount)) - amount) < 0.01) ?? null;
}

function validateDirection(bankDirection: BankStatementDirection, systemDirection: CashLedgerDirection) {
  if (bankDirection === "NEUTRAL" || bankDirection !== systemDirection) {
    throw new ReconciliationError("Banka hareketi ve sistem hareketi yönü uyumlu değil.");
  }
}

function validateAmount(bankAmount: Prisma.Decimal | null, systemAmount: Prisma.Decimal) {
  if (!bankAmount || Math.abs(Math.abs(toNumber(bankAmount)) - Math.abs(toNumber(systemAmount))) > Math.max(1, Math.abs(toNumber(bankAmount)) * 0.01)) {
    throw new ReconciliationError("Banka hareketi ve sistem hareketi tutarı uyumlu değil.");
  }
}

function isMatchedBankRow(row: { matchType: BankStatementMatchType; matchedCashLedgerEntryId?: string | null; matchedIncomeId?: string | null; matchedExpenseId?: string | null }) {
  return isApprovedBankMatch(row);
}

function confidenceLabel(confidence: number): "Yüksek" | "Orta" | "Düşük" {
  if (confidence >= 0.9) return "Yüksek";
  if (confidence >= 0.6) return "Orta";
  return "Düşük";
}

function mapExpenseCategory(category: string | null) {
  const text = normalizeTransactionText(category ?? "");
  if (text.includes("noter")) return "NOTARY";
  if (text.includes("harc")) return "COURT_FEE";
  if (text.includes("ulasim")) return "TRAVEL";
  if (text.includes("vergi") || text.includes("sgk")) return "TAX";
  if (text.includes("personel")) return "PERSONNEL";
  if (text.includes("yemek")) return "MEAL";
  if (text.includes("ofis") || text.includes("kira") || text.includes("yazilim") || text.includes("abonelik")) return "OFFICE";
  return "OTHER";
}

async function linkImportDocumentToCreatedRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  documentId: string | null,
  links: { incomeId?: string; expenseId?: string; ledgerId?: string }
) {
  if (!documentId) return;

  const data: Prisma.DocumentUncheckedUpdateManyInput = {};
  if (links.incomeId) data.linkedIncomeId = links.incomeId;
  if (links.expenseId) data.linkedExpenseId = links.expenseId;
  if (links.ledgerId) data.linkedCashLedgerEntryId = links.ledgerId;

  await tx.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      linkedIncomeId: null,
      linkedExpenseId: null,
      linkedCashLedgerEntryId: null
    },
    data
  });
}

function normalizeBankRowAmount(input: string | number | null | undefined, fallback: Prisma.Decimal | null) {
  const rawValue = input == null || String(input).trim() === "" ? fallback : String(input).trim().replace(",", ".");

  if (!rawValue) {
    throw new ReconciliationError("Banka hareketinden kayıt oluşturmak için tutar okunabilir olmalı.");
  }

  try {
    const amount = new Prisma.Decimal(rawValue).abs();
    if (amount.lessThanOrEqualTo(0)) {
      throw new ReconciliationError("Tutar sıfırdan büyük olmalı.");
    }
    return amount;
  } catch (error) {
    if (error instanceof ReconciliationError) throw error;
    throw new ReconciliationError("Tutar geçerli bir sayı olmalı.");
  }
}

function normalizeBankRowDate(input: string | null | undefined, fallback: Date | null) {
  const date = input ? parseDateInput(input) : fallback;
  if (!date || Number.isNaN(date.getTime())) {
    throw new ReconciliationError("Banka hareketinden kayıt oluşturmak için tarih okunabilir olmalı.");
  }

  return date;
}

function cleanText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

async function auditCreatedRecord(
  userId: string,
  oldRow: unknown,
  newRow: unknown,
  record: { id: string },
  ledger: { id: string },
  label: "Tahsilat" | "Gider" | "Kasa hareketi"
) {
  const recordLog =
    label === "Kasa hareketi"
      ? null
      : writeAuditLog({
          entityType: label === "Tahsilat" ? "INCOME" : "EXPENSE",
          entityId: record.id,
          action: "CREATE",
          newValue: record,
          message: `Banka hareketinden ${label.toLocaleLowerCase("tr-TR")} oluşturuldu`,
          userId
        });

  await Promise.all([
    recordLog,
    writeAuditLog({
      entityType: "CASH_LEDGER_ENTRY",
      entityId: ledger.id,
      action: "CREATE",
      newValue: ledger,
      message: label === "Kasa hareketi" ? "Banka hareketinden kasa hareketi oluşturuldu" : `Banka hareketinden ${label.toLocaleLowerCase("tr-TR")} kasa hareketi oluşturuldu`,
      userId
    }),
    writeAuditLog({
      entityType: "BANK_STATEMENT_ROW",
      entityId: (newRow as { id: string }).id,
      action: "UPDATE",
      oldValue: oldRow,
      newValue: newRow,
      message: `Banka hareketi yeni ${label.toLocaleLowerCase("tr-TR")} kaydıyla eşleştirildi`,
      userId
    })
  ]);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export class ReconciliationError extends Error {}
