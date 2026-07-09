import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient();
const PREFIX = "V3RC1-REALISTIC";
const MARKER = "V3-RC1 Gerçekçi Test Verisi";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);

type SeedContext = {
  userId: string;
  clients: Awaited<ReturnType<typeof prisma.client.findMany>>;
  caseFiles: Awaited<ReturnType<typeof prisma.caseFile.findMany>>;
  cashAccounts: Awaited<ReturnType<typeof prisma.cashAccount.findMany>>;
  incomes: Awaited<ReturnType<typeof prisma.income.findMany>>;
  expenses: Awaited<ReturnType<typeof prisma.expense.findMany>>;
  ledgerEntries: Awaited<ReturnType<typeof prisma.cashLedgerEntry.findMany>>;
  invoices: Awaited<ReturnType<typeof prisma.invoiceOrReceipt.findMany>>;
  documents: Awaited<ReturnType<typeof prisma.document.findMany>>;
  bankImports: Awaited<ReturnType<typeof prisma.bankStatementImport.findMany>>;
  bankRows: Awaited<ReturnType<typeof prisma.bankStatementRow.findMany>>;
  assets: Awaited<ReturnType<typeof prisma.assetAccount.findMany>>;
};

async function main() {
  const user = await ensureUser();
  console.log(`V3 gerçekçi test veri seti hazırlanıyor: ${user.email}`);
  await cleanupRealisticDataset(user.id);

  const clients = await seedClients(user.id);
  const caseFiles = await seedCaseFiles(user.id, clients);
  const cashAccounts = await seedCashAccounts(user.id);
  const incomes = await seedIncomes(user.id, clients, caseFiles, cashAccounts);
  const expenses = await seedExpenses(user.id, clients, caseFiles, cashAccounts);
  const ledgerEntries = await seedLedgerEntries(user.id, incomes, expenses, cashAccounts);
  const invoices = await seedInvoices(user.id, clients, caseFiles, incomes);
  const { documents } = await seedDocuments(user.id, clients, caseFiles, incomes, expenses, invoices, ledgerEntries);
  const { bankImports, bankRows } = await seedBankStatements(user.id, documents, cashAccounts, clients, caseFiles, ledgerEntries);
  const assets = await seedCapital(user.id, cashAccounts, documents);
  await seedReminders(user.id, clients, caseFiles, cashAccounts);
  await seedRules(user.id, clients, caseFiles, cashAccounts);
  await seedAuditLogs({
    userId: user.id,
    clients,
    caseFiles,
    cashAccounts,
    incomes,
    expenses,
    ledgerEntries,
    invoices,
    documents,
    bankImports,
    bankRows,
    assets
  });

  const summary = await collectSummary(user.id);
  console.table(summary);
  console.log("V3-RC1 gerçekçi anonim test veri seti hazır.");
}

async function ensureUser() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: "Anonim Test Avukatı",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD)
    }
  });
}

async function cleanupRealisticDataset(userId: string) {
  const [
    clients,
    caseFiles,
    cashAccounts,
    incomes,
    expenses,
    invoices,
    documents,
    bankImports,
    assets,
    reminders,
    tags,
    categories,
    rules
  ] = await Promise.all([
    prisma.client.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.caseFile.findMany({ where: { userId, title: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.cashAccount.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.income.findMany({ where: { userId, description: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.expense.findMany({ where: { userId, description: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.invoiceOrReceipt.findMany({ where: { userId, number: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.document.findMany({ where: { userId, title: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.bankStatementImport.findMany({ where: { userId, bankName: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.assetAccount.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.taskReminder.findMany({ where: { userId, title: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.documentTag.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.transactionCategory.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } }),
    prisma.transactionRule.findMany({ where: { userId, name: { startsWith: PREFIX } }, select: { id: true } })
  ]);

  const clientIds = ids(clients);
  const caseFileIds = ids(caseFiles);
  const cashAccountIds = ids(cashAccounts);
  const incomeIds = ids(incomes);
  const expenseIds = ids(expenses);
  const invoiceIds = ids(invoices);
  const documentIds = ids(documents);
  const bankImportIds = ids(bankImports);
  const assetIds = ids(assets);
  const reminderIds = ids(reminders);
  const tagIds = ids(tags);
  const categoryIds = ids(categories);
  const ruleIds = ids(rules);

  const bankRowIds = ids(await prisma.bankStatementRow.findMany({ where: { userId, importId: { in: bankImportIds } }, select: { id: true } }));
  const ledgerIds = ids(
    await prisma.cashLedgerEntry.findMany({
      where: {
        userId,
        OR: [
          { description: { startsWith: PREFIX } },
          { referenceNo: { startsWith: PREFIX } },
          { cashAccountId: { in: cashAccountIds } },
          { incomeId: { in: incomeIds } },
          { expenseId: { in: expenseIds } }
        ]
      },
      select: { id: true }
    })
  );
  const cashTransferIds = ids(
    await prisma.cashTransfer.findMany({
      where: {
        userId,
        OR: [{ description: { startsWith: PREFIX } }, { fromAccountId: { in: cashAccountIds } }, { toAccountId: { in: cashAccountIds } }]
      },
      select: { id: true }
    })
  );

  const entityIds = [
    ...clientIds,
    ...caseFileIds,
    ...cashAccountIds,
    ...incomeIds,
    ...expenseIds,
    ...invoiceIds,
    ...documentIds,
    ...bankImportIds,
    ...bankRowIds,
    ...ledgerIds,
    ...cashTransferIds,
    ...assetIds,
    ...reminderIds,
    ...tagIds,
    ...categoryIds,
    ...ruleIds
  ];

  await prisma.auditLog.deleteMany({
    where: {
      userId,
      OR: [{ message: { contains: MARKER } }, entityIds.length ? { entityId: { in: entityIds } } : { entityId: "__none__" }]
    }
  });
  await prisma.documentTagOnDocument.deleteMany({ where: { OR: [{ documentId: { in: documentIds } }, { tagId: { in: tagIds } }] } });
  await prisma.documentProcessingLog.deleteMany({ where: { userId, documentId: { in: documentIds } } });
  await prisma.bankStatementRow.deleteMany({ where: { userId, id: { in: bankRowIds } } });
  await prisma.bankStatementImport.deleteMany({ where: { userId, id: { in: bankImportIds } } });
  await prisma.assetTransaction.deleteMany({ where: { userId, assetAccountId: { in: assetIds } } });
  await prisma.assetValuation.deleteMany({ where: { userId, assetAccountId: { in: assetIds } } });
  await prisma.assetAccount.deleteMany({ where: { userId, id: { in: assetIds } } });
  await prisma.cashLedgerEntry.deleteMany({ where: { userId, id: { in: ledgerIds } } });
  await prisma.cashTransfer.deleteMany({ where: { userId, id: { in: cashTransferIds } } });
  await prisma.document.deleteMany({ where: { userId, id: { in: documentIds } } });
  await prisma.invoiceOrReceipt.deleteMany({ where: { userId, id: { in: invoiceIds } } });
  await prisma.taskReminder.deleteMany({ where: { userId, id: { in: reminderIds } } });
  await prisma.income.deleteMany({ where: { userId, id: { in: incomeIds } } });
  await prisma.expense.deleteMany({ where: { userId, id: { in: expenseIds } } });
  await prisma.caseFile.deleteMany({ where: { userId, id: { in: caseFileIds } } });
  await prisma.client.deleteMany({ where: { userId, id: { in: clientIds } } });
  await prisma.cashAccount.deleteMany({ where: { userId, id: { in: cashAccountIds } } });
  await prisma.transactionRule.deleteMany({ where: { userId, id: { in: ruleIds } } });
  await prisma.transactionCategory.deleteMany({ where: { userId, id: { in: categoryIds } } });
  await prisma.documentTag.deleteMany({ where: { userId, id: { in: tagIds } } });
}

async function seedClients(userId: string) {
  const sectors = ["Lojistik", "Teknoloji", "İnşaat", "Danışmanlık", "Sağlık", "Gıda", "Enerji", "Tekstil", "Tasarım", "Eğitim"];
  const people = ["Ada", "Deniz", "Ekin", "Duru", "Mert", "Selin", "Baran", "İdil", "Aras", "Mina"];
  await prisma.client.createMany({
    data: range(50).map((index) => {
      const isCompany = index % 3 !== 0;
      return {
        userId,
        name: isCompany ? `${PREFIX} ${pick(sectors, index)} ${String(index + 1).padStart(2, "0")} Ltd.` : `${PREFIX} ${pick(people, index)} Test Müvekkil ${index + 1}`,
        type: isCompany ? "COMPANY" : "INDIVIDUAL",
        tcNo: isCompany ? null : `900000${String(index).padStart(5, "0")}`,
        taxNo: isCompany ? `80000${String(index).padStart(5, "0")}` : null,
        phone: `+90 555 10${String(index).padStart(2, "0")} ${String(1000 + index).slice(0, 4)}`,
        email: `anonim.muvekkil.${index + 1}@example.test`,
        address: `Anonim İş Merkezi No:${index + 1}, Test Mahallesi, İstanbul`,
        notes: `${MARKER}. Tamamen sahte ve anonim müvekkil kaydı.`
      };
    })
  });

  return prisma.client.findMany({ where: { userId, name: { startsWith: PREFIX } }, orderBy: { name: "asc" } });
}

async function seedCaseFiles(userId: string, clients: Awaited<ReturnType<typeof seedClients>>) {
  const caseTypes = ["İcra takibi", "Alacak davası", "İş davası", "Ticari dava", "Sözleşme inceleme", "Arabuluculuk", "Vergi itirazı", "Tüketici uyuşmazlığı"];
  const offices = ["İstanbul 19. İcra Dairesi", "İstanbul Anadolu 5. Asliye Ticaret", "Bakırköy 12. İş Mahkemesi", "İstanbul 8. Sulh Hukuk", "İzmir 3. İcra Dairesi"];
  await prisma.caseFile.createMany({
    data: range(80).map((index) => ({
      userId,
      clientId: clients[index % clients.length].id,
      title: `${PREFIX} ${pick(caseTypes, index)} Dosyası ${index + 1}`,
      courtOrOffice: pick(offices, index),
      fileNumber: `${2024 + (index % 3)}/${300 + index} ${index % 2 === 0 ? "E." : "K."}`,
      caseType: pick(caseTypes, index),
      status: index % 13 === 0 ? "CLOSED" : index % 17 === 0 ? "ARCHIVED" : "ACTIVE",
      notes: `${MARKER}. Anonim dosya notu.`
    }))
  });

  return prisma.caseFile.findMany({ where: { userId, title: { startsWith: PREFIX } }, orderBy: { createdAt: "asc" } });
}

async function seedCashAccounts(userId: string) {
  const accounts = [
    ["Ana Kasa", "CASH", "TRY", "27500.00", "#0f172a", "wallet"],
    ["Banka TL", "BANK", "TRY", "184250.00", "#1d4ed8", "landmark"],
    ["Banka USD", "BANK", "USD", "6200.00", "#059669", "dollar-sign"],
    ["Banka EUR", "BANK", "EUR", "4100.00", "#2563eb", "euro"],
    ["Kredi Kartı", "CREDIT_CARD", "TRY", "-38500.00", "#be123c", "credit-card"],
    ["UYAP Avans Sanal", "VIRTUAL", "TRY", "9500.00", "#7c3aed", "scale"],
    ["Masraf Avans Havuzu", "VIRTUAL", "TRY", "21500.00", "#0e7490", "banknote"],
    ["Yatırım İzleme", "OTHER", "TRY", "50000.00", "#4b5563", "line-chart"]
  ] as const;

  await prisma.cashAccount.createMany({
    data: accounts.map(([label, type, currency, openingBalance, color, icon], index) => ({
      userId,
      name: `${PREFIX} ${label}`,
      type,
      currency,
      openingBalance: decimal(openingBalance),
      description: `${MARKER}. ${label} hesabı.`,
      color,
      icon,
      isDefault: index === 0,
      isActive: true
    }))
  });

  return prisma.cashAccount.findMany({ where: { userId, name: { startsWith: PREFIX } }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
}

async function seedIncomes(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>
) {
  const categories = ["LEGAL_FEE", "ADVANCE", "EXPENSE_REIMBURSEMENT", "OTHER"] as const;
  const methods = ["BANK_TRANSFER", "CASH", "CREDIT_CARD", "OTHER"] as const;
  await prisma.income.createMany({
    data: range(250).map((index) => {
      const caseFile = caseFiles[index % caseFiles.length];
      const client = clients.find((item) => item.id === caseFile.clientId) ?? clients[index % clients.length];
      const amount = index % 37 === 0 ? "2500.00" : money(1200, 65000, index);
      return {
        userId,
        clientId: client.id,
        caseFileId: index % 7 === 0 ? null : caseFile.id,
        cashAccountId: cashAccounts[index % 4].id,
        amount: decimal(amount),
        currency: "TRY",
        date: daysAgo(index % 360),
        paymentMethod: pick(methods, index),
        category: pick(categories, index),
        description: `${PREFIX} Tahsilat ${index + 1}: ${incomeDescription(index)}`,
        receiptIssued: index % 4 !== 0,
        receiptNumber: index % 4 !== 0 ? `${PREFIX}-THS-${String(index + 1).padStart(4, "0")}` : null,
        documentNotRequired: index % 23 === 0
      };
    })
  });

  return prisma.income.findMany({ where: { userId, description: { startsWith: PREFIX } }, orderBy: { date: "desc" } });
}

async function seedExpenses(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>
) {
  const categories = ["COURT_FEE", "NOTARY", "TRAVEL", "ACCOMMODATION", "OFFICE", "TAX", "PERSONNEL", "MEAL", "OTHER"] as const;
  const methods = ["BANK_TRANSFER", "CASH", "CREDIT_CARD", "OTHER"] as const;
  await prisma.expense.createMany({
    data: range(300).map((index) => {
      const caseFile = index % 5 === 0 ? null : caseFiles[(index * 3) % caseFiles.length];
      const client = caseFile ? clients.find((item) => item.id === caseFile.clientId) : index % 6 === 0 ? null : clients[index % clients.length];
      const hasCashLedger = index < 250;
      return {
        userId,
        clientId: client?.id ?? null,
        caseFileId: caseFile?.id ?? null,
        cashAccountId: hasCashLedger ? cashAccounts[index % cashAccounts.length].id : null,
        amount: decimal(index % 41 === 0 ? "2500.00" : money(180, 42000, index + 800)),
        currency: "TRY",
        date: daysAgo(index % 360),
        paymentMethod: pick(methods, index),
        category: pick(categories, index),
        isClientExpense: Boolean(caseFile) && index % 3 !== 0,
        description: `${PREFIX} Gider ${index + 1}: ${expenseDescription(index)}`,
        documentNotRequired: index % 19 === 0
      };
    })
  });

  return prisma.expense.findMany({ where: { userId, description: { startsWith: PREFIX } }, orderBy: { date: "desc" } });
}

async function seedLedgerEntries(
  userId: string,
  incomes: Awaited<ReturnType<typeof seedIncomes>>,
  expenses: Awaited<ReturnType<typeof seedExpenses>>,
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>
) {
  const incomeEntries = incomes.map((income, index) => ({
    userId,
    cashAccountId: income.cashAccountId ?? cashAccounts[index % cashAccounts.length].id,
    direction: "IN" as const,
    entryType: "INCOME" as const,
    amount: income.amount,
    currency: income.currency,
    date: income.date,
    description: `${PREFIX} Kasa girişi: ${income.description}`,
    referenceNo: `${PREFIX}-LED-IN-${String(index + 1).padStart(4, "0")}`,
    incomeId: income.id,
    clientId: income.clientId,
    caseFileId: income.caseFileId
  }));
  const expenseEntries = expenses.slice(0, 250).map((expense, index) => ({
    userId,
    cashAccountId: expense.cashAccountId ?? cashAccounts[index % cashAccounts.length].id,
    direction: "OUT" as const,
    entryType: "EXPENSE" as const,
    amount: expense.amount,
    currency: expense.currency,
    date: expense.date,
    description: `${PREFIX} Kasa çıkışı: ${expense.description}`,
    referenceNo: `${PREFIX}-LED-OUT-${String(index + 1).padStart(4, "0")}`,
    expenseId: expense.id,
    clientId: expense.clientId,
    caseFileId: expense.caseFileId
  }));

  await prisma.cashLedgerEntry.createMany({ data: [...incomeEntries, ...expenseEntries] });
  return prisma.cashLedgerEntry.findMany({ where: { userId, description: { startsWith: PREFIX } }, orderBy: { date: "desc" } });
}

async function seedInvoices(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  incomes: Awaited<ReturnType<typeof seedIncomes>>
) {
  const types = ["E_SMM", "INVOICE", "ARCHIVE_INVOICE", "OTHER"] as const;
  const statuses = ["DRAFT", "ISSUED", "PAID", "UNPAID", "CANCELLED"] as const;
  await prisma.invoiceOrReceipt.createMany({
    data: range(120).map((index) => {
      const income = incomes[index % incomes.length];
      const client = clients[index % clients.length];
      const caseFile = caseFiles[index % caseFiles.length];
      const net = decimal(money(1500, 72000, index + 1500));
      const vat = net.mul("0.20");
      const withholding = index % 4 === 0 ? net.mul("0.10") : decimal("0");
      return {
        userId,
        clientId: index % 3 === 0 ? income.clientId : client.id,
        caseFileId: index % 5 === 0 ? null : caseFile.id,
        relatedIncomeId: index % 2 === 0 ? income.id : null,
        type: pick(types, index),
        number: `${PREFIX}-BEL-${String(index + 1).padStart(4, "0")}`,
        issueDate: daysAgo(index % 330),
        grossAmount: net.plus(vat),
        vatAmount: vat,
        withholdingAmount: withholding,
        netAmount: net,
        status: pick(statuses, index),
        notes: `${MARKER}. Anonim makbuz/fatura takip kaydı.`,
        documentNotRequired: index % 29 === 0
      };
    })
  });

  return prisma.invoiceOrReceipt.findMany({ where: { userId, number: { startsWith: PREFIX } }, orderBy: { issueDate: "desc" } });
}

async function seedDocuments(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  incomes: Awaited<ReturnType<typeof seedIncomes>>,
  expenses: Awaited<ReturnType<typeof seedExpenses>>,
  invoices: Awaited<ReturnType<typeof seedInvoices>>,
  ledgerEntries: Awaited<ReturnType<typeof seedLedgerEntries>>
) {
  const tagNames = ["Dekont", "Fiş", "Makbuz", "Ekstre", "UYAP", "Vergi", "Sözleşme", "Belgesiz Kontrol"];
  await prisma.documentTag.createMany({
    data: tagNames.map((name, index) => ({
      userId,
      name: `${PREFIX} ${name}`,
      color: pick(["#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#be123c"], index)
    }))
  });
  const tags = await prisma.documentTag.findMany({ where: { userId, name: { startsWith: PREFIX } }, orderBy: { name: "asc" } });
  const types = ["BANK_STATEMENT", "BANK_RECEIPT", "RECEIPT", "EXPENSE_RECEIPT", "INVOICE", "CONTRACT", "TAX_DOCUMENT", "OTHER"] as const;
  const mimes = [
    ["application/pdf", ".pdf"],
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["text/csv", ".csv"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"]
  ] as const;

  await prisma.document.createMany({
    data: range(80).map((index) => {
      const [mimeType, extension] = pick(mimes, index);
      const type = index < 3 ? "BANK_STATEMENT" : pick(types, index);
      const income = index % 4 === 0 ? incomes[index % incomes.length] : null;
      const expense = index % 4 === 1 ? expenses[index % expenses.length] : null;
      const invoice = index % 8 === 0 ? invoices[index % invoices.length] : null;
      const ledger = index % 5 === 0 ? ledgerEntries[index % ledgerEntries.length] : null;
      const client = clients[index % clients.length];
      const caseFile = caseFiles[index % caseFiles.length];
      return {
        userId,
        title: `${PREFIX} Belge ${String(index + 1).padStart(3, "0")} - ${documentTitle(index)}`,
        description: `${MARKER}. Metadata amaçlı anonim belge kaydı; fiziksel dosya üretmez.`,
        documentType: type,
        fileName: `${PREFIX.toLowerCase()}-${String(index + 1).padStart(3, "0")}${extension}`,
        originalFileName: `anonim-${documentTitle(index).toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}-${index + 1}${extension}`,
        mimeType,
        fileSize: 42_000 + index * 917,
        storagePath: `documents/${PREFIX.toLowerCase()}-${String(index + 1).padStart(3, "0")}${extension}`,
        fileHash: sha256(`${PREFIX}:document:${index}`),
        uploadedAt: daysAgo(index % 240),
        documentDate: daysAgo(index % 240),
        amount: index % 3 === 0 ? decimal(money(300, 38000, index + 2200)) : null,
        currency: "TRY",
        extractedText:
          index % 2 === 0
            ? `Anonim belge metni. ${documentTitle(index)}. UYAP, harç, noter, avukatlık ücreti ve banka dekontu arama test içeriği.`
            : null,
        extractionStatus: index % 9 === 0 ? "FAILED" : index % 2 === 0 ? "COMPLETED" : "NOT_PROCESSED",
        linkedClientId: index % 6 === 0 ? null : client.id,
        linkedCaseFileId: index % 7 === 0 ? null : caseFile.id,
        linkedIncomeId: income?.id ?? null,
        linkedExpenseId: expense?.id ?? null,
        linkedInvoiceOrReceiptId: invoice?.id ?? null,
        linkedCashLedgerEntryId: ledger?.id ?? null
      };
    })
  });

  const documents = await prisma.document.findMany({ where: { userId, title: { startsWith: PREFIX } }, orderBy: { uploadedAt: "desc" } });
  await prisma.documentProcessingLog.createMany({
    data: documents.map((document, index) => ({
      userId,
      documentId: document.id,
      status: document.extractionStatus,
      message: `${MARKER}. Belge işleme logu ${index + 1}.`
    }))
  });
  await prisma.documentTagOnDocument.createMany({
    data: documents.flatMap((document, index) => [
      { documentId: document.id, tagId: tags[index % tags.length].id },
      { documentId: document.id, tagId: tags[(index + 3) % tags.length].id }
    ])
  });

  return { documents, tags };
}

async function seedBankStatements(
  userId: string,
  documents: Awaited<ReturnType<typeof seedDocuments>>["documents"],
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  ledgerEntries: Awaited<ReturnType<typeof seedLedgerEntries>>
) {
  const bankAccounts = cashAccounts.filter((account) => account.type === "BANK");
  await prisma.bankStatementImport.createMany({
    data: range(3).map((index) => ({
      userId,
      documentId: documents[index]?.id ?? null,
      cashAccountId: bankAccounts[index % bankAccounts.length].id,
      bankName: `${PREFIX} Anonim Banka ${index + 1}`,
      sourceType: index === 2 ? "PDF" : index === 1 ? "XLSX" : "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `${PREFIX.toLowerCase()}-banka-ekstresi-${index + 1}.${index === 0 ? "csv" : index === 1 ? "xlsx" : "pdf"}`,
      originalFileName: `anonim-banka-ekstresi-${index + 1}.${index === 0 ? "csv" : index === 1 ? "xlsx" : "pdf"}`,
      mimeType:
        index === 0
          ? "text/csv"
          : index === 1
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
      fileSize: 180_000 + index * 50_000,
      storagePath: `documents/${PREFIX.toLowerCase()}-banka-ekstresi-${index + 1}.${index === 0 ? "csv" : index === 1 ? "xlsx" : "pdf"}`,
      fileHash: sha256(`${PREFIX}:bank-import:${index}`),
      periodStart: monthsAgo(12 - index * 4),
      periodEnd: monthsAgo(8 - index * 4),
      detectedColumns: { date: "Tarih", description: "Açıklama", debit: "Borç", credit: "Alacak", balance: "Bakiye" },
      columnMapping: { date: "Tarih", description: "Açıklama", debit: "Borç", credit: "Alacak", balance: "Bakiye" },
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      thousandSeparator: ",",
      totalRows: 200,
      successfulRows: 188,
      failedRows: 4,
      duplicateRows: 8,
      openingBalance: decimal(money(80_000, 180_000, index + 3100)),
      closingBalance: decimal(money(95_000, 220_000, index + 3300)),
      notes: `${MARKER}. CSV/XLSX/PDF anonim import örneği.`
    }))
  });
  const bankImports = await prisma.bankStatementImport.findMany({ where: { userId, bankName: { startsWith: PREFIX } }, orderBy: { createdAt: "asc" } });
  const rows = bankImports.flatMap((bankImport, importIndex) => createBankRows(userId, bankImport.id, bankImport.cashAccountId, importIndex, clients, caseFiles, ledgerEntries));
  await prisma.bankStatementRow.createMany({ data: rows });
  const bankRows = await prisma.bankStatementRow.findMany({ where: { userId, importId: { in: bankImports.map((item) => item.id) } }, orderBy: [{ importId: "asc" }, { rowNumber: "asc" }] });
  return { bankImports, bankRows };
}

function createBankRows(
  userId: string,
  importId: string,
  cashAccountId: string | null,
  importIndex: number,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  ledgerEntries: Awaited<ReturnType<typeof seedLedgerEntries>>
) {
  return range(200).map((index) => {
    const absoluteIndex = importIndex * 200 + index;
    const ledger = ledgerEntries[absoluteIndex % ledgerEntries.length];
    const direction = index % 11 === 0 ? "NEUTRAL" : index % 3 === 0 ? "OUT" : "IN";
    const matched = index < 30;
    const suggested = index >= 30 && index < 50;
    const ignored = index >= 50 && index < 58;
    const duplicate = index >= 58 && index < 66;
    const amount = suggested || matched ? ledger.amount : decimal(index % 17 === 0 ? "2500.00" : money(95, 55000, absoluteIndex + 4000));
    const signedAmount = direction === "OUT" ? amount.abs().negated() : direction === "IN" ? amount.abs() : decimal("0");
    const rowDate = daysAgo((absoluteIndex * 2) % 365);
    const description = bankDescription(absoluteIndex, direction, clients[absoluteIndex % clients.length].name);
    return {
      userId,
      importId,
      cashAccountId,
      rowNumber: index + 1,
      transactionDate: rowDate,
      description,
      debitAmount: direction === "OUT" ? amount.abs() : null,
      creditAmount: direction === "IN" ? amount.abs() : null,
      amount: signedAmount,
      balance: decimal(money(50_000, 260_000, absoluteIndex + 4500)),
      currency: "TRY",
      direction,
      status: duplicate ? "DUPLICATE" : index % 53 === 0 ? "ERROR" : "SUCCESS",
      errorMessage: duplicate ? "Duplicate satır" : index % 53 === 0 ? "Tarih veya tutar kontrol edilmeli" : null,
      rawData: {
        Tarih: isoDate(rowDate),
        Açıklama: description,
        Borç: direction === "OUT" ? amount.abs().toFixed(2) : "",
        Alacak: direction === "IN" ? amount.abs().toFixed(2) : "",
        Bakiye: money(50_000, 260_000, absoluteIndex + 4500)
      },
      rawHash: duplicate ? sha256(`${PREFIX}:bank-row:duplicate:${importIndex}:${index % 2}`) : sha256(`${PREFIX}:bank-row:${importIndex}:${index}`),
      categorySuggestion: direction === "IN" ? "Tahsilat" : direction === "OUT" ? pick(["Kira", "SGK", "Vergi", "UYAP", "Noter", "Yazılım aboneliği"], index) : "Transfer",
      clientSuggestionId: index % 4 === 0 ? clients[absoluteIndex % clients.length].id : null,
      caseFileSuggestionId: index % 7 === 0 ? caseFiles[absoluteIndex % caseFiles.length].id : null,
      matchType: matched ? "MANUALLY_MATCHED" : suggested ? "SUGGESTED" : ignored ? "IGNORED" : "NONE",
      matchedIncomeId: matched && ledger.incomeId ? ledger.incomeId : null,
      matchedExpenseId: matched && ledger.expenseId ? ledger.expenseId : null,
      matchedCashLedgerEntryId: matched || suggested ? ledger.id : null
    };
  });
}

async function seedCapital(userId: string, cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>, documents: Awaited<ReturnType<typeof seedDocuments>>["documents"]) {
  const assets = [
    ["Nakit ana kasa", "CASH", "TRY", "TRY", "1", "1", null, cashAccounts.find((item) => item.type === "CASH")?.id],
    ["Banka TL varlığı", "BANK", "TRY", "TRY", "1", "1", null, cashAccounts.find((item) => item.name.includes("Banka TL"))?.id],
    ["USD döviz", "FX", "USD", "USD", "6200", "32.20", "199640", null],
    ["EUR döviz", "FX", "EUR", "EUR", "4100", "35.10", "143910", null],
    ["Gram altın", "GOLD", "XAU", "XAU", "320", "2510", "803200", null],
    ["BIST izleme sepeti", "STOCK", "TRY", "THYAO", "1200", "305", "366000", null],
    ["Teknoloji fonu", "FUND", "TRY", "FON-A", "8500", "42", "357000", null],
    ["BTC izleme", "CRYPTO", "BTC", "BTC", "0.75", "2100000", "1575000", null],
    ["ETH izleme", "CRYPTO", "ETH", "ETH", "5", "118000", "590000", null],
    ["Ofis demirbaş", "OTHER", "TRY", "DEMIRBAS", "1", "185000", "185000", null],
    ["Kredi kartı borcu", "DEBT", "TRY", "KK", "1", "38500", "38500", cashAccounts.find((item) => item.type === "CREDIT_CARD")?.id],
    ["Vergi borcu karşılığı", "DEBT", "TRY", "VERGI", "1", "74000", "74000", null],
    ["Alacak varlığı", "RECEIVABLE", "TRY", "ALACAK", "1", "225000", "225000", null],
    ["Araç varlığı", "VEHICLE", "TRY", "ARAC", "1", "850000", "850000", null],
    ["Gayrimenkul izleme", "REAL_ESTATE", "TRY", "OFIS", "1", "3200000", "3200000", null],
    ["Masraf avans havuzu", "BANK", "TRY", "AVANS", "1", "21500", null, cashAccounts.find((item) => item.name.includes("Masraf"))?.id],
    ["Sanal UYAP hesabı", "BANK", "TRY", "UYAP", "1", "9500", null, cashAccounts.find((item) => item.name.includes("UYAP"))?.id],
    ["Kısa vadeli borç", "DEBT", "TRY", "BORC", "1", "125000", "125000", null],
    ["Diğer yatırım", "OTHER", "TRY", "DIGER", "1", "64000", "64000", null],
    ["Döviz sepeti GBP", "FX", "GBP", "GBP", "1800", "41.20", "74160", null]
  ] as const;

  await prisma.assetAccount.createMany({
    data: assets.map(([label, assetType, currency, symbol, quantity, unitPrice, manualTotalValue, linkedCashAccountId], index) => ({
      userId,
      name: `${PREFIX} ${label}`,
      assetType,
      currency,
      symbol,
      quantity: decimal(quantity),
      unitPrice: decimal(unitPrice),
      manualTotalValue: manualTotalValue ? decimal(manualTotalValue) : null,
      valuationCurrency: "TRY",
      linkedCashAccountId: linkedCashAccountId ?? null,
      sourceDocumentId: documents[(index + 10) % documents.length]?.id ?? null,
      description: `${MARKER}. Manuel değerleme amaçlı anonim varlık.`
    }))
  });
  const assetAccounts = await prisma.assetAccount.findMany({ where: { userId, name: { startsWith: PREFIX } }, orderBy: { createdAt: "asc" } });
  await prisma.assetValuation.createMany({
    data: assetAccounts.flatMap((asset, assetIndex) =>
      range(12).map((monthIndex) => {
        const factor = decimal("0.88").plus(decimal(monthIndex).mul("0.018")).plus(decimal((assetIndex % 5) * 0.01));
        const base = asset.manualTotalValue ?? (asset.quantity && asset.unitPrice ? asset.quantity.mul(asset.unitPrice) : decimal("0"));
        return {
          userId,
          assetAccountId: asset.id,
          valuationDate: monthsAgo(11 - monthIndex),
          quantity: asset.quantity,
          unitPrice: asset.unitPrice,
          totalValue: base.mul(factor).abs(),
          valuationCurrency: "TRY",
          source: "MANUAL",
          sourceDocumentId: documents[(assetIndex + monthIndex) % documents.length]?.id ?? null,
          note: `${MARKER}. ${monthIndex + 1}. ay manuel değerleme.`
        };
      })
    )
  });
  await prisma.assetTransaction.createMany({
    data: assetAccounts.flatMap((asset, assetIndex) =>
      range(12).map((monthIndex) => ({
        userId,
        assetAccountId: asset.id,
        transactionType: "VALUE_UPDATE",
        date: monthsAgo(11 - monthIndex),
        quantity: asset.quantity,
        unitPrice: asset.unitPrice,
        totalAmount: decimal(money(10_000, 300_000, assetIndex * 100 + monthIndex)),
        currency: "TRY",
        description: `${MARKER}. Varlık değer güncelleme hareketi.`
      }))
    )
  });

  return assetAccounts;
}

async function seedReminders(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>
) {
  const types = ["GENERAL", "EXPENSE", "COLLECTION", "CASE", "INVOICE", "TAX"] as const;
  const priorities = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
  await prisma.taskReminder.createMany({
    data: range(50).map((index) => ({
      userId,
      title: `${PREFIX} Hatırlatma ${index + 1}: ${reminderTitle(index)}`,
      description: `${MARKER}. Anonim hatırlatma açıklaması.`,
      dueDate: addDays(now, index % 11 === 0 ? -index : index % 17),
      reminderType: pick(types, index),
      amount: index % 2 === 0 ? decimal(money(350, 48000, index + 7000)) : null,
      currency: "TRY",
      cashAccountId: cashAccounts[index % cashAccounts.length].id,
      relatedClientId: index % 4 === 0 ? null : clients[index % clients.length].id,
      relatedCaseFileId: index % 5 === 0 ? null : caseFiles[index % caseFiles.length].id,
      status: index % 13 === 0 ? "DONE" : index % 19 === 0 ? "CANCELLED" : "OPEN",
      priority: pick(priorities, index),
      notifyBeforeDays: pick([1, 3, 7, 15], index),
      notificationEnabled: index % 9 !== 0,
      notifiedAt: index % 10 === 0 ? daysAgo(1) : null
    }))
  });
}

async function seedRules(
  userId: string,
  clients: Awaited<ReturnType<typeof seedClients>>,
  caseFiles: Awaited<ReturnType<typeof seedCaseFiles>>,
  cashAccounts: Awaited<ReturnType<typeof seedCashAccounts>>
) {
  const categories = [
    ["Kira", "kira", "OUT"],
    ["SGK", "sgk", "OUT"],
    ["Vergi", "vergi", "OUT"],
    ["UYAP Harç", "uyap", "OUT"],
    ["Noter", "noter", "OUT"],
    ["Yazılım aboneliği", "abonelik", "OUT"],
    ["Avukatlık ücreti", "vekalet", "IN"],
    ["Masraf iadesi", "masraf iadesi", "IN"]
  ] as const;
  await prisma.transactionCategory.createMany({
    data: categories.map(([label, slug, direction], index) => ({
      userId,
      name: `${PREFIX} ${label}`,
      slug: `${PREFIX.toLowerCase()}-${slug.replace(/\s+/g, "-")}`,
      group: direction === "IN" ? "INCOME" : "EXPENSE",
      direction,
      color: direction === "IN" ? "#16a34a" : "#dc2626",
      icon: index % 2 === 0 ? "tag" : "sparkles",
      description: `${MARKER}. Analiz kuralı kategorisi.`,
      isSystem: false,
      isActive: true
    }))
  });
  await prisma.transactionRule.createMany({
    data: categories.map(([label, keyword, direction], index) => ({
      userId,
      name: `${PREFIX} Kural ${label}`,
      keyword,
      matchType: index === 5 ? "REGEX" : "DESCRIPTION_CONTAINS",
      direction: direction === "IN" ? "IN" : "OUT",
      category: label,
      targetGroup: direction === "IN" ? "INCOME" : "EXPENSE",
      amountMin: index % 3 === 0 ? decimal("100") : null,
      amountMax: index % 3 === 0 ? decimal("100000") : null,
      priority: 10 + index,
      confidence: decimal(index < 4 ? "0.92" : "0.78"),
      clientId: index === 7 ? clients[0].id : null,
      caseFileId: index === 7 ? caseFiles[0].id : null,
      cashAccountId: cashAccounts[index % cashAccounts.length].id,
      isActive: true
    }))
  });
}

async function seedAuditLogs(context: SeedContext) {
  const samples = [
    ...context.clients.slice(0, 20).map((item) => ["CLIENT", item.id, "CREATE", `Müvekkil oluşturuldu - ${MARKER}`] as const),
    ...context.caseFiles.slice(0, 20).map((item) => ["CASE_FILE", item.id, "CREATE", `Dosya oluşturuldu - ${MARKER}`] as const),
    ...context.incomes.slice(0, 30).map((item) => ["INCOME", item.id, "CREATE", `Tahsilat kaydedildi - ${MARKER}`] as const),
    ...context.expenses.slice(0, 30).map((item) => ["EXPENSE", item.id, "CREATE", `Gider kaydedildi - ${MARKER}`] as const),
    ...context.documents.slice(0, 20).map((item) => ["DOCUMENT", item.id, "CREATE", `Belge metadata eklendi - ${MARKER}`] as const),
    ...context.bankRows.slice(0, 20).map((item) => ["BANK_STATEMENT_ROW", item.id, "UPDATE", `Banka hareketi analiz edildi - ${MARKER}`] as const),
    ...context.assets.slice(0, 10).map((item) => ["ASSET_ACCOUNT", item.id, "CREATE", `Sermaye varlığı oluşturuldu - ${MARKER}`] as const)
  ];

  await prisma.auditLog.createMany({
    data: samples.map(([entityType, entityId, action, message], index) => ({
      entityType,
      entityId,
      action,
      message,
      userId: context.userId,
      oldValue: index % 5 === 0 ? { previous: "anonim eski değer" } : Prisma.JsonNull,
      newValue: { seed: MARKER, sequence: index + 1 }
    }))
  });
}

async function collectSummary(userId: string) {
  const whereByUser = { userId };
  return [
    { tablo: "Müvekkil", adet: await prisma.client.count({ where: { ...whereByUser, name: { startsWith: PREFIX } } }) },
    { tablo: "Dosya", adet: await prisma.caseFile.count({ where: { ...whereByUser, title: { startsWith: PREFIX } } }) },
    { tablo: "Tahsilat", adet: await prisma.income.count({ where: { ...whereByUser, description: { startsWith: PREFIX } } }) },
    { tablo: "Gider", adet: await prisma.expense.count({ where: { ...whereByUser, description: { startsWith: PREFIX } } }) },
    { tablo: "Makbuz/Fatura", adet: await prisma.invoiceOrReceipt.count({ where: { ...whereByUser, number: { startsWith: PREFIX } } }) },
    { tablo: "Kasa hesabı", adet: await prisma.cashAccount.count({ where: { ...whereByUser, name: { startsWith: PREFIX } } }) },
    { tablo: "Kasa hareketi", adet: await prisma.cashLedgerEntry.count({ where: { ...whereByUser, description: { startsWith: PREFIX } } }) },
    { tablo: "Belge metadata", adet: await prisma.document.count({ where: { ...whereByUser, title: { startsWith: PREFIX } } }) },
    { tablo: "Banka import", adet: await prisma.bankStatementImport.count({ where: { ...whereByUser, bankName: { startsWith: PREFIX } } }) },
    { tablo: "Banka hareketi", adet: await prisma.bankStatementRow.count({ where: { ...whereByUser, import: { bankName: { startsWith: PREFIX } } } }) },
    { tablo: "Varlık", adet: await prisma.assetAccount.count({ where: { ...whereByUser, name: { startsWith: PREFIX } } }) },
    { tablo: "Varlık değerleme", adet: await prisma.assetValuation.count({ where: { ...whereByUser, assetAccount: { name: { startsWith: PREFIX } } } }) },
    { tablo: "Hatırlatma", adet: await prisma.taskReminder.count({ where: { ...whereByUser, title: { startsWith: PREFIX } } }) },
    { tablo: "Audit log örneği", adet: await prisma.auditLog.count({ where: { ...whereByUser, message: { contains: MARKER } } }) }
  ];
}

function incomeDescription(index: number) {
  return pick(
    [
      "avukatlık ücreti havalesi",
      "masraf avansı tahsilatı",
      "icra dosyası tahsilatı",
      "arabuluculuk vekalet ücreti",
      "danışmanlık hizmet bedeli",
      "masraf iadesi",
      "dava takip ücreti"
    ],
    index
  );
}

function expenseDescription(index: number) {
  return pick(
    [
      "UYAP harç ödemesi",
      "noter vekaletname masrafı",
      "bilirkişi gider avansı",
      "ofis kira ödemesi",
      "SGK prim ödemesi",
      "vergi tahakkuk ödemesi",
      "personel maaş ödemesi",
      "ulaşım ve otopark gideri",
      "yazılım aboneliği",
      "ofis elektrik ve su faturası",
      "konaklama ve duruşma seyahati",
      "yemek ve toplantı gideri"
    ],
    index
  );
}

function documentTitle(index: number) {
  return pick(["Dekont", "Makbuz", "Fiş", "Fatura", "Sözleşme", "Banka Ekstresi", "Vergi Belgesi", "UYAP Çıktısı"], index);
}

function bankDescription(index: number, direction: string, clientName: string) {
  if (direction === "IN") {
    return pick(
      [
        `${clientName} vekalet ücreti EFT`,
        "Anonim müvekkil masraf avansı FAST",
        "İcra tahsilatı açıklamalı havale",
        "Masraf iadesi banka girişi",
        "Danışmanlık bedeli tahsilatı"
      ],
      index
    );
  }
  if (direction === "OUT") {
    return pick(["UYAP HARÇ ÖDEMESİ", "SGK PRİM TAHSİLATI", "VERGİ DAİRESİ ÖDEMESİ", "OFİS KİRA EFT", "YAZILIM ABONELİĞİ POS", "NOTER ÖDEMESİ"], index);
  }
  return "Kendi hesaplar arası transfer";
}

function reminderTitle(index: number) {
  return pick(["Gider vadesi", "Tahsilat takibi", "Dosya duruşma kontrolü", "Makbuz kesim kontrolü", "Vergi/SGK ödeme günü", "Genel büro işi"], index);
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

function money(min: number, max: number, salt: number) {
  const current = createRng(1000 + salt);
  const raw = min + current() * (max - min);
  return decimal(raw).toDecimalPlaces(2).toFixed(2);
}

function daysAgo(count: number) {
  return addDays(now, -count);
}

function monthsAgo(count: number) {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() - count, 1, 12, 0, 0);
}

function addDays(date: Date, count: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function decimal(value: string | number | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function ids(rows: Array<{ id: string }>) {
  return rows.map((row) => row.id);
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

main()
  .catch((error) => {
    console.error("V3 gerçekçi test veri seti oluşturulamadı:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
