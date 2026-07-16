import type { CaseStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { syncExpenseLedgerEntry, syncIncomeLedgerEntry } from "@/lib/cash-ledger";
import { restoreV3Record } from "@/lib/db/soft-delete";
import { prisma } from "@/lib/prisma";

type RestorableCaseStatus = Exclude<CaseStatus, "ARCHIVED">;

type RestoreCaseFileOptions = {
  status?: RestorableCaseStatus;
};

type ParentClientState = {
  archivedAt: Date | null;
  deletedAt: Date | null;
};

type ParentCaseFileState = {
  status: CaseStatus;
  archivedAt: Date | null;
  deletedAt: Date | null;
  client: ParentClientState;
};

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
}

export async function getDeletedRecords(userId: string) {
  const [
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    documents,
    bankStatementImports,
    cashAccounts,
    taskReminders,
    assetAccounts
  ] = await Promise.all([
    prisma.client.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        archivedAt: true,
        deletedAt: true,
        updatedAt: true
      }
    }),
    prisma.caseFile.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        fileNumber: true,
        status: true,
        archivedAt: true,
        deletedAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.income.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        category: true,
        deletedAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, archivedAt: true, deletedAt: true } },
        caseFile: { select: { id: true, title: true, status: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.expense.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        category: true,
        isClientExpense: true,
        deletedAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, archivedAt: true, deletedAt: true } },
        caseFile: { select: { id: true, title: true, status: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.invoiceOrReceipt.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        issueDate: true,
        netAmount: true,
        deletedAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, archivedAt: true, deletedAt: true } },
        caseFile: { select: { id: true, title: true, status: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.document.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        documentType: true,
        originalFileName: true,
        fileSize: true,
        documentDate: true,
        uploadedAt: true,
        deletedAt: true,
        linkedClient: { select: { id: true, name: true, archivedAt: true, deletedAt: true } },
        linkedCaseFile: { select: { id: true, title: true, status: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.bankStatementImport.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        bankName: true,
        originalFileName: true,
        sourceType: true,
        totalRows: true,
        successfulRows: true,
        deletedAt: true,
        cashAccount: { select: { id: true, name: true, deletedAt: true, isActive: true } }
      }
    }),
    prisma.cashAccount.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        isDefault: true,
        isActive: true,
        deletedAt: true
      }
    }),
    prisma.taskReminder.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        reminderType: true,
        status: true,
        priority: true,
        dueDate: true,
        amount: true,
        currency: true,
        deletedAt: true,
        relatedClient: { select: { id: true, name: true, archivedAt: true, deletedAt: true } },
        relatedCaseFile: { select: { id: true, title: true, status: true, archivedAt: true, deletedAt: true } }
      }
    }),
    prisma.assetAccount.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        assetType: true,
        symbol: true,
        currency: true,
        valuationCurrency: true,
        manualTotalValue: true,
        deletedAt: true,
        linkedCashAccount: { select: { id: true, name: true, deletedAt: true, isActive: true } }
      }
    })
  ]);

  return {
    clients,
    caseFiles,
    incomes,
    expenses,
    invoiceOrReceipts,
    documents,
    bankStatementImports,
    cashAccounts,
    taskReminders,
    assetAccounts
  };
}

export async function getDeletedRecordCounts(userId: string) {
  const [clients, caseFiles, incomes, expenses, invoiceOrReceipts] = await Promise.all([
    prisma.client.count({ where: { userId, deletedAt: { not: null } } }),
    prisma.caseFile.count({ where: { userId, deletedAt: { not: null } } }),
    prisma.income.count({ where: { userId, deletedAt: { not: null } } }),
    prisma.expense.count({ where: { userId, deletedAt: { not: null } } }),
    prisma.invoiceOrReceipt.count({ where: { userId, deletedAt: { not: null } } })
  ]);

  return { clients, caseFiles, incomes, expenses, invoiceOrReceipts };
}

export async function restoreClient(userId: string, id: string) {
  const client = await ensureDeletedRecordExists("Müvekkil", () =>
    prisma.client.findFirst({ where: { id, userId, deletedAt: { not: null } } })
  );

  const restored = await prisma.client.update({
    where: { id },
    data: { archivedAt: null, deletedAt: null }
  });
  await writeAuditLog({
    entityType: "CLIENT",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: client,
    newValue: restored,
    message: "Müvekkil geri alındı",
    userId
  });

  return restored;
}

export async function restoreCaseFile(userId: string, id: string, options: RestoreCaseFileOptions = {}) {
  const caseFile = await ensureDeletedRecordExists("Dosya", () =>
    prisma.caseFile.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: {
        id: true,
        status: true,
        client: { select: { archivedAt: true, deletedAt: true } }
      }
    })
  );

  ensureActiveClient(caseFile.client, "Dosya");

  const restored = await prisma.caseFile.update({
    where: { id },
    data: {
      archivedAt: null,
      deletedAt: null,
      status: options.status ?? (caseFile.status === "ARCHIVED" ? "ACTIVE" : caseFile.status)
    }
  });
  await writeAuditLog({
    entityType: "CASE_FILE",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: caseFile,
    newValue: restored,
    message: "Dosya geri alındı",
    userId
  });

  return restored;
}

export async function restoreIncome(userId: string, id: string) {
  const income = await ensureDeletedRecordExists("Tahsilat", () =>
    prisma.income.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: {
        id: true,
        caseFileId: true,
        client: { select: { archivedAt: true, deletedAt: true } },
        caseFile: {
          select: {
            status: true,
            archivedAt: true,
            deletedAt: true,
            client: { select: { archivedAt: true, deletedAt: true } }
          }
        }
      }
    })
  );

  ensureActiveClient(income.client, "Tahsilat");
  ensureActiveCaseFile(income.caseFile, income.caseFileId, "Tahsilat");

  const existingLedger = await prisma.cashLedgerEntry.findUnique({ where: { incomeId: id } });
  const { restored, ledger } = await prisma.$transaction(async (tx) => {
    const restored = await tx.income.update({ where: { id }, data: { deletedAt: null } });
    const ledger = await syncIncomeLedgerEntry(userId, restored, tx);
    return { restored, ledger };
  });
  await writeAuditLog({
    entityType: "INCOME",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: income,
    newValue: restored,
    message: "Tahsilat geri alındı",
    userId
  });
  await writeAuditLog({
    entityType: "CASH_LEDGER_ENTRY",
    entityId: ledger.id,
    action: "RESTORE",
    oldValue: existingLedger,
    newValue: ledger,
    message: "Tahsilat kasa hareketi geri alındı",
    userId
  });

  return restored;
}

export async function restoreExpense(userId: string, id: string) {
  const expense = await ensureDeletedRecordExists("Gider", () =>
    prisma.expense.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: {
        id: true,
        clientId: true,
        caseFileId: true,
        client: { select: { archivedAt: true, deletedAt: true } },
        caseFile: {
          select: {
            status: true,
            archivedAt: true,
            deletedAt: true,
            client: { select: { archivedAt: true, deletedAt: true } }
          }
        }
      }
    })
  );

  if (expense.clientId) {
    ensureActiveClient(expense.client, "Gider");
  }
  ensureActiveCaseFile(expense.caseFile, expense.caseFileId, "Gider");

  const existingLedger = await prisma.cashLedgerEntry.findUnique({ where: { expenseId: id } });
  const { restored, ledger } = await prisma.$transaction(async (tx) => {
    const restored = await tx.expense.update({ where: { id }, data: { deletedAt: null } });
    const ledger = await syncExpenseLedgerEntry(userId, restored, tx);
    return { restored, ledger };
  });
  await writeAuditLog({
    entityType: "EXPENSE",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: expense,
    newValue: restored,
    message: "Gider geri alındı",
    userId
  });
  await writeAuditLog({
    entityType: "CASH_LEDGER_ENTRY",
    entityId: ledger.id,
    action: "RESTORE",
    oldValue: existingLedger,
    newValue: ledger,
    message: "Gider kasa hareketi geri alındı",
    userId
  });

  return restored;
}

export async function restoreInvoiceOrReceipt(userId: string, id: string) {
  const invoiceOrReceipt = await ensureDeletedRecordExists("Makbuz/fatura", () =>
    prisma.invoiceOrReceipt.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: {
        id: true,
        caseFileId: true,
        client: { select: { archivedAt: true, deletedAt: true } },
        caseFile: {
          select: {
            status: true,
            archivedAt: true,
            deletedAt: true,
            client: { select: { archivedAt: true, deletedAt: true } }
          }
        }
      }
    })
  );

  ensureActiveClient(invoiceOrReceipt.client, "Makbuz/fatura");
  ensureActiveCaseFile(invoiceOrReceipt.caseFile, invoiceOrReceipt.caseFileId, "Makbuz/fatura");

  const restored = await prisma.invoiceOrReceipt.update({ where: { id }, data: { deletedAt: null } });
  await writeAuditLog({
    entityType: "INVOICE_OR_RECEIPT",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: invoiceOrReceipt,
    newValue: restored,
    message: "Makbuz/fatura geri alındı",
    userId
  });

  return restored;
}

export async function restoreDocument(userId: string, id: string) {
  const restored = await restoreV3Record(userId, "document", id);
  if (!restored) {
    throw new RestoreError("Belge bulunamadı veya zaten aktif durumda.");
  }

  return restored;
}

export async function restoreBankStatementImport(userId: string, id: string) {
  const restored = await restoreV3Record(userId, "bankStatementImport", id);
  if (!restored) {
    throw new RestoreError("Banka ekstresi bulunamadı veya zaten aktif durumda.");
  }

  return restored;
}

export async function restoreAssetAccount(userId: string, id: string) {
  const restored = await restoreV3Record(userId, "assetAccount", id);
  if (!restored) {
    throw new RestoreError("Varlık hesabı bulunamadı veya zaten aktif durumda.");
  }

  return restored;
}

export async function restoreCashAccount(userId: string, id: string) {
  const existing = await ensureDeletedRecordExists("Kasa hesabı", () =>
    prisma.cashAccount.findFirst({ where: { id, userId, deletedAt: { not: null } } })
  );

  const restored = await prisma.cashAccount.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  await writeAuditLog({
    entityType: "CASH_ACCOUNT",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: existing,
    newValue: restored,
    message: "Kasa hesabı geri alındı",
    userId
  });

  return restored;
}

export async function restoreReminder(userId: string, id: string) {
  const reminder = await ensureDeletedRecordExists("Hatırlatma", () =>
    prisma.taskReminder.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: {
        id: true,
        relatedClientId: true,
        relatedCaseFileId: true,
        relatedClient: { select: { archivedAt: true, deletedAt: true } },
        relatedCaseFile: {
          select: {
            status: true,
            archivedAt: true,
            deletedAt: true,
            client: { select: { archivedAt: true, deletedAt: true } }
          }
        }
      }
    })
  );

  if (reminder.relatedClientId) {
    ensureActiveClient(reminder.relatedClient, "Hatırlatma");
  }
  ensureActiveCaseFile(reminder.relatedCaseFile, reminder.relatedCaseFileId, "Hatırlatma");

  const restored = await prisma.taskReminder.update({ where: { id }, data: { deletedAt: null } });
  await writeAuditLog({
    entityType: "TASK_REMINDER",
    entityId: restored.id,
    action: "RESTORE",
    oldValue: reminder,
    newValue: restored,
    message: "Hatırlatma geri alındı",
    userId
  });

  return restored;
}

async function ensureDeletedRecordExists<T>(label: string, finder: () => Promise<T | null>) {
  const record = await finder();

  if (!record) {
    throw new RestoreError(`${label} bulunamadı veya zaten aktif durumda.`);
  }

  return record;
}

function ensureActiveClient(client: ParentClientState | null, childLabel: string) {
  if (!client) {
    throw new RestoreError(`${childLabel} geri alınamadı. Bağlı müvekkil bulunamadı.`);
  }

  if (client.deletedAt) {
    throw new RestoreError(`${childLabel} geri alınamadı. Önce bağlı müvekkili geri alın.`);
  }

  if (client.archivedAt) {
    throw new RestoreError(`${childLabel} geri alınamadı. Önce bağlı müvekkili aktif hale getirin.`);
  }
}

function ensureActiveCaseFile(caseFile: ParentCaseFileState | null, caseFileId: string | null, childLabel: string) {
  if (!caseFileId) {
    return;
  }

  if (!caseFile) {
    throw new RestoreError(`${childLabel} geri alınamadı. Bağlı dosya bulunamadı.`);
  }

  if (caseFile.deletedAt) {
    throw new RestoreError(`${childLabel} geri alınamadı. Önce bağlı dosyayı geri alın.`);
  }

  if (caseFile.archivedAt || caseFile.status === "ARCHIVED") {
    throw new RestoreError(`${childLabel} geri alınamadı. Önce bağlı dosyayı aktif hale getirin.`);
  }

  ensureActiveClient(caseFile.client, childLabel);
}
