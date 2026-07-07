import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function upsertSetting(userId, key, value) {
  await prisma.appSetting.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value }
  });
}

async function main() {
  const email = process.env.ADMIN_EMAIL || "avukat@example.com";
  const password = process.env.ADMIN_PASSWORD || "DemoAvukat2026!";

  if (!isStrongEnoughPassword(password)) {
    throw new Error("ADMIN_PASSWORD en az 10 karakter, buyuk/kucuk harf ve rakam icermeli.");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Avukat",
      passwordHash: hashPassword(password)
    },
    create: {
      email,
      name: "Avukat",
      passwordHash: hashPassword(password)
    }
  });

  await Promise.all([
    upsertSetting(user.id, "firmName", "Hukuk Bürosu"),
    upsertSetting(user.id, "ownerName", "Avukat"),
    upsertSetting(user.id, "currency", "TRY"),
    upsertSetting(user.id, "vatRate", "20"),
    upsertSetting(user.id, "cashSafetyBuffer", "50000")
  ]);

  const client = await prisma.client.upsert({
    where: { id: "seed-client-ayse-yilmaz" },
    update: {
      userId: user.id,
      name: "Ayse Yilmaz",
      type: "INDIVIDUAL",
      tcNo: "12345678901",
      phone: "+90 555 000 00 00",
      email: "ayse.yilmaz@example.com",
      address: "Istanbul",
      notes: "Ornek bireysel muvekkil"
    },
    create: {
      id: "seed-client-ayse-yilmaz",
      userId: user.id,
      name: "Ayse Yilmaz",
      type: "INDIVIDUAL",
      tcNo: "12345678901",
      phone: "+90 555 000 00 00",
      email: "ayse.yilmaz@example.com",
      address: "Istanbul",
      notes: "Ornek bireysel muvekkil"
    }
  });

  const companyClient = await prisma.client.upsert({
    where: { id: "seed-client-delta-teknoloji" },
    update: {
      userId: user.id,
      name: "Delta Teknoloji A.S.",
      type: "COMPANY",
      taxNo: "1234567890",
      phone: "+90 212 000 00 00",
      email: "finans@delta.example",
      address: "Istanbul",
      notes: "Ornek sirket muvekkili"
    },
    create: {
      id: "seed-client-delta-teknoloji",
      userId: user.id,
      name: "Delta Teknoloji A.S.",
      type: "COMPANY",
      taxNo: "1234567890",
      phone: "+90 212 000 00 00",
      email: "finans@delta.example",
      address: "Istanbul",
      notes: "Ornek sirket muvekkili"
    }
  });

  const caseFile = await prisma.caseFile.upsert({
    where: { id: "seed-case-ayse-alacak-takibi" },
    update: {
      userId: user.id,
      clientId: client.id,
      title: "Alacak Takibi",
      courtOrOffice: "Istanbul Icra Dairesi",
      fileNumber: "2026/145",
      caseType: "Icra",
      status: "ACTIVE",
      notes: "Ornek aktif dosya"
    },
    create: {
      id: "seed-case-ayse-alacak-takibi",
      userId: user.id,
      clientId: client.id,
      title: "Alacak Takibi",
      courtOrOffice: "Istanbul Icra Dairesi",
      fileNumber: "2026/145",
      caseType: "Icra",
      status: "ACTIVE",
      notes: "Ornek aktif dosya"
    }
  });

  await Promise.all([
    prisma.income.upsert({
      where: { id: "seed-income-ayse-legal-fee" },
      update: {
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 35000,
        currency: "TRY",
        date: new Date("2026-07-01"),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: "Vekalet ucreti tahsilati",
        receiptIssued: true,
        receiptNumber: "SMM-2026-001"
      },
      create: {
        id: "seed-income-ayse-legal-fee",
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 35000,
        currency: "TRY",
        date: new Date("2026-07-01"),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: "Vekalet ucreti tahsilati",
        receiptIssued: true,
        receiptNumber: "SMM-2026-001"
      }
    }),
    prisma.income.upsert({
      where: { id: "seed-income-ayse-advance" },
      update: {
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 10000,
        currency: "TRY",
        date: new Date("2026-07-02"),
        paymentMethod: "CASH",
        category: "ADVANCE",
        description: "Dosya masraf avansi",
        receiptIssued: false
      },
      create: {
        id: "seed-income-ayse-advance",
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 10000,
        currency: "TRY",
        date: new Date("2026-07-02"),
        paymentMethod: "CASH",
        category: "ADVANCE",
        description: "Dosya masraf avansi",
        receiptIssued: false
      }
    }),
    prisma.income.upsert({
      where: { id: "seed-income-delta-legal-fee" },
      update: {
        userId: user.id,
        clientId: companyClient.id,
        amount: 45000,
        currency: "TRY",
        date: new Date("2026-07-03"),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: "Danismanlik ucreti",
        receiptIssued: true,
        receiptNumber: "SMM-2026-002"
      },
      create: {
        id: "seed-income-delta-legal-fee",
        userId: user.id,
        clientId: companyClient.id,
        amount: 45000,
        currency: "TRY",
        date: new Date("2026-07-03"),
        paymentMethod: "BANK_TRANSFER",
        category: "LEGAL_FEE",
        description: "Danismanlik ucreti",
        receiptIssued: true,
        receiptNumber: "SMM-2026-002"
      }
    })
  ]);

  await Promise.all([
    prisma.expense.upsert({
      where: { id: "seed-expense-ayse-court-fee" },
      update: {
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 4250,
        currency: "TRY",
        date: new Date("2026-07-02"),
        paymentMethod: "CREDIT_CARD",
        category: "COURT_FEE",
        isClientExpense: true,
        description: "Basvuru harci ve dosya masrafi"
      },
      create: {
        id: "seed-expense-ayse-court-fee",
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        amount: 4250,
        currency: "TRY",
        date: new Date("2026-07-02"),
        paymentMethod: "CREDIT_CARD",
        category: "COURT_FEE",
        isClientExpense: true,
        description: "Basvuru harci ve dosya masrafi"
      }
    }),
    prisma.expense.upsert({
      where: { id: "seed-expense-office-utilities" },
      update: {
        userId: user.id,
        amount: 3200,
        currency: "TRY",
        date: new Date("2026-07-03"),
        paymentMethod: "BANK_TRANSFER",
        category: "OFFICE",
        isClientExpense: false,
        description: "Ofis elektrik ve internet gideri"
      },
      create: {
        id: "seed-expense-office-utilities",
        userId: user.id,
        amount: 3200,
        currency: "TRY",
        date: new Date("2026-07-03"),
        paymentMethod: "BANK_TRANSFER",
        category: "OFFICE",
        isClientExpense: false,
        description: "Ofis elektrik ve internet gideri"
      }
    })
  ]);

  let defaultCashAccount = await prisma.cashAccount.findFirst({
    where: { userId: user.id, isDefault: true, deletedAt: null },
    orderBy: { createdAt: "asc" }
  });

  if (!defaultCashAccount) {
    defaultCashAccount = await prisma.cashAccount.create({
      data: {
        userId: user.id,
        name: "Ana Kasa",
        type: "CASH",
        currency: "TRY",
        openingBalance: 0,
        description: "V2 dijital kasa varsayılan hesabı",
        color: "#16a34a",
        icon: "wallet",
        isDefault: true,
        isActive: true
      }
    });
  }

  await Promise.all([
    prisma.income.updateMany({
      where: { userId: user.id, cashAccountId: null },
      data: { cashAccountId: defaultCashAccount.id }
    }),
    prisma.expense.updateMany({
      where: { userId: user.id, cashAccountId: null },
      data: { cashAccountId: defaultCashAccount.id }
    })
  ]);

  const [seedIncomes, seedExpenses] = await Promise.all([
    prisma.income.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({ where: { userId: user.id } })
  ]);

  for (const income of seedIncomes) {
    await prisma.cashLedgerEntry.upsert({
      where: { incomeId: income.id },
      update: {
        userId: user.id,
        cashAccountId: income.cashAccountId || defaultCashAccount.id,
        direction: "IN",
        entryType: "INCOME",
        amount: income.amount,
        currency: income.currency,
        date: income.date,
        description: income.description,
        referenceNo: income.receiptNumber,
        clientId: income.clientId,
        caseFileId: income.caseFileId,
        deletedAt: income.deletedAt
      },
      create: {
        userId: user.id,
        cashAccountId: income.cashAccountId || defaultCashAccount.id,
        direction: "IN",
        entryType: "INCOME",
        amount: income.amount,
        currency: income.currency,
        date: income.date,
        description: income.description,
        referenceNo: income.receiptNumber,
        incomeId: income.id,
        clientId: income.clientId,
        caseFileId: income.caseFileId,
        deletedAt: income.deletedAt
      }
    });
  }

  for (const expense of seedExpenses) {
    await prisma.cashLedgerEntry.upsert({
      where: { expenseId: expense.id },
      update: {
        userId: user.id,
        cashAccountId: expense.cashAccountId || defaultCashAccount.id,
        direction: "OUT",
        entryType: "EXPENSE",
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date,
        description: expense.description,
        referenceNo: null,
        clientId: expense.clientId,
        caseFileId: expense.caseFileId,
        deletedAt: expense.deletedAt
      },
      create: {
        userId: user.id,
        cashAccountId: expense.cashAccountId || defaultCashAccount.id,
        direction: "OUT",
        entryType: "EXPENSE",
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date,
        description: expense.description,
        expenseId: expense.id,
        clientId: expense.clientId,
        caseFileId: expense.caseFileId,
        deletedAt: expense.deletedAt
      }
    });
  }

  await Promise.all([
    prisma.invoiceOrReceipt.upsert({
      where: { userId_type_number: { userId: user.id, type: "E_SMM", number: "SMM-2026-001" } },
      update: {
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        type: "E_SMM",
        number: "SMM-2026-001",
        issueDate: new Date("2026-07-01"),
        grossAmount: 35000,
        vatAmount: 7000,
        withholdingAmount: 7000,
        netAmount: 35000,
        status: "PAID",
        notes: "Ornek tahsil edilmis e-SMM kaydi"
      },
      create: {
        userId: user.id,
        clientId: client.id,
        caseFileId: caseFile.id,
        type: "E_SMM",
        number: "SMM-2026-001",
        issueDate: new Date("2026-07-01"),
        grossAmount: 35000,
        vatAmount: 7000,
        withholdingAmount: 7000,
        netAmount: 35000,
        status: "PAID",
        notes: "Ornek tahsil edilmis e-SMM kaydi"
      }
    }),
    prisma.invoiceOrReceipt.upsert({
      where: { userId_type_number: { userId: user.id, type: "E_SMM", number: "SMM-2026-002" } },
      update: {
        userId: user.id,
        clientId: companyClient.id,
        type: "E_SMM",
        number: "SMM-2026-002",
        issueDate: new Date("2026-07-03"),
        grossAmount: 45000,
        vatAmount: 9000,
        withholdingAmount: 9000,
        netAmount: 45000,
        status: "PAID",
        notes: "Ornek sirket tahsilati"
      },
      create: {
        userId: user.id,
        clientId: companyClient.id,
        type: "E_SMM",
        number: "SMM-2026-002",
        issueDate: new Date("2026-07-03"),
        grossAmount: 45000,
        vatAmount: 9000,
        withholdingAmount: 9000,
        netAmount: 45000,
        status: "PAID",
        notes: "Ornek sirket tahsilati"
      }
    })
  ]);

  await prisma.taskReminder.upsert({
    where: { id: "seed-reminder-advance-check" },
    update: {
      userId: user.id,
      title: "Masraf avansi kontrolu",
      description: "Ayse Yilmaz dosyasinda kalan avans bakiyesini kontrol et.",
      dueDate: new Date("2026-07-10"),
      relatedClientId: client.id,
      relatedCaseFileId: caseFile.id,
      status: "OPEN"
    },
    create: {
      id: "seed-reminder-advance-check",
      userId: user.id,
      title: "Masraf avansi kontrolu",
      description: "Ayse Yilmaz dosyasinda kalan avans bakiyesini kontrol et.",
      dueDate: new Date("2026-07-10"),
      relatedClientId: client.id,
      relatedCaseFileId: caseFile.id,
      status: "OPEN"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

function isStrongEnoughPassword(password) {
  return (
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}
