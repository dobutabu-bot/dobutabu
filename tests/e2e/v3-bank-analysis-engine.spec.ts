import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { classifyTransactionDeterministically } from "../../src/lib/bank-analysis/rule-engine";
import { getBankAnalysisScreenData } from "../../src/lib/bank-analysis/analyze-statement";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 deterministic bank analysis engine", () => {
  test("classifies with keyword, regex, counterparty, IBAN and amount range rules", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Analiz motoru testi tek projede çalışır.");

    const rules = [
      {
        id: "rule-keyword-amount",
        name: "Ofis kira aralığı",
        keyword: "KİRA",
        matchType: "DESCRIPTION_CONTAINS",
        direction: "OUT",
        category: "Kira",
        targetGroup: "EXPENSE",
        amountMin: 1000,
        amountMax: 20000,
        confidence: 0.84
      },
      {
        id: "rule-regex",
        name: "UYAP harç regex",
        keyword: "UYAP|HAR[CÇ]",
        matchType: "REGEX",
        direction: "OUT",
        category: "Harç",
        targetGroup: "EXPENSE",
        confidence: 0.82
      },
      {
        id: "rule-counterparty",
        name: "Delta müvekkil",
        keyword: "Delta Teknoloji",
        matchType: "COUNTERPARTY_MATCHES",
        direction: "IN",
        category: "Müvekkil Ödemesi",
        targetGroup: "INCOME",
        confidence: 0.86,
        clientId: "client-delta"
      },
      {
        id: "rule-iban",
        name: "Kendi banka hesabı",
        keyword: "TR120006200000000006789012",
        matchType: "IBAN_MATCHES",
        direction: "ANY",
        category: "Kendi Hesapları Arası Transfer",
        targetGroup: "TRANSFER",
        confidence: 0.88
      }
    ];
    const categories = [
      { name: "Kira", slug: "kira", group: "EXPENSE", direction: "OUT" },
      { name: "Harç", slug: "harc", group: "EXPENSE", direction: "OUT" },
      { name: "Müvekkil Ödemesi", slug: "muvekkil-odemesi", group: "INCOME", direction: "IN" },
      { name: "Kendi Hesapları Arası Transfer", slug: "transfer", group: "TRANSFER", direction: "NEUTRAL" }
    ];

    const rent = classifyTransactionDeterministically(
      { description: "OFİS KİRA ÖDEMESİ TEMMUZ", direction: "OUT", amount: 12_500 },
      rules,
      categories
    );
    expect(rent.category).toBe("Kira");
    expect(rent.group).toBe("EXPENSE");
    expect(rent.isHighConfidence).toBeTruthy();
    expect(rent.reason).toContain("tutar aralığı");

    const courtFee = classifyTransactionDeterministically({ description: "UYAP HARÇ TAHSILATI", direction: "OUT", amount: 2_100 }, rules, categories);
    expect(courtFee.category).toBe("Harç");
    expect(courtFee.ruleId).toBe("rule-regex");

    const clientPayment = classifyTransactionDeterministically(
      { description: "FAST GELEN Delta Teknoloji vekalet", direction: "IN", amount: 18_000, counterparty: "Delta Teknoloji AŞ" },
      rules,
      categories
    );
    expect(clientPayment.category).toBe("Müvekkil Ödemesi");
    expect(clientPayment.clientId).toBe("client-delta");

    const transfer = classifyTransactionDeterministically(
      { description: "Virman TR120006200000000006789012 hesabıma", direction: "OUT", amount: 5_000 },
      rules,
      categories
    );
    expect(transfer.group).toBe("TRANSFER");
    expect(transfer.ruleId).toBe("rule-iban");
  });

  test("server-side analysis detects recurring payments and large transactions without creating finance records", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Server-side analiz testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let importId: string | null = null;
    let kiraCategoryId: string | null = null;
    let vergiCategoryId: string | null = null;
    let kiraRuleId: string | null = null;
    let vergiRuleId: string | null = null;
    const ledgerBefore = await prisma.cashLedgerEntry.count({ where: { userId: user!.id, deletedAt: null } });

    try {
      kiraCategoryId = (
        await prisma.transactionCategory.create({
          data: {
            userId: user!.id,
            name: `Kira E2E ${stamp}`,
            slug: `kira-e2e-${stamp}`,
            group: "EXPENSE",
            direction: "OUT"
          }
        })
      ).id;
      vergiCategoryId = (
        await prisma.transactionCategory.create({
          data: {
            userId: user!.id,
            name: `Vergi E2E ${stamp}`,
            slug: `vergi-e2e-${stamp}`,
            group: "EXPENSE",
            direction: "OUT"
          }
        })
      ).id;
      kiraRuleId = (
        await prisma.transactionRule.create({
          data: {
            userId: user!.id,
            name: `Kira E2E ${stamp}`,
            keyword: `KIRA E2E ${stamp}`,
            matchType: "DESCRIPTION_CONTAINS",
            direction: "OUT",
            category: `Kira E2E ${stamp}`,
            targetGroup: "EXPENSE",
            amountMin: 5000,
            amountMax: 20000,
            confidence: 0.86,
            priority: 1
          }
        })
      ).id;
      vergiRuleId = (
        await prisma.transactionRule.create({
          data: {
            userId: user!.id,
            name: `Vergi E2E ${stamp}`,
            keyword: `VERGI E2E ${stamp}`,
            matchType: "DESCRIPTION_CONTAINS",
            direction: "OUT",
            category: `Vergi E2E ${stamp}`,
            targetGroup: "EXPENSE",
            amountMin: 30000,
            confidence: 0.88,
            priority: 2
          }
        })
      ).id;
      const bankImport = await prisma.bankStatementImport.create({
        data: {
          userId: user!.id,
          bankName: `Analiz Banka ${stamp}`,
          sourceType: "CSV",
          status: "IMPORTED",
          currency: "TRY",
          fileName: `analysis-${stamp}.csv`,
          originalFileName: `analysis-${stamp}.csv`,
          mimeType: "text/csv",
          fileSize: 512,
          storagePath: `storage/test/analysis-${stamp}.csv`,
          fileHash: `analysis-${stamp}`,
          totalRows: 6,
          successfulRows: 6,
          failedRows: 0,
          duplicateRows: 0
        }
      });
      importId = bankImport.id;

      await prisma.bankStatementRow.createMany({
        data: [
          row(user!.id, importId, 1, "2026-01-05", `KIRA E2E ${stamp} ofis`, "OUT", -10000),
          row(user!.id, importId, 2, "2026-02-05", `KIRA E2E ${stamp} ofis`, "OUT", -10000),
          row(user!.id, importId, 3, "2026-03-05", `KIRA E2E ${stamp} ofis`, "OUT", -10000),
          row(user!.id, importId, 4, "2026-04-05", `KIRA E2E ${stamp} ofis`, "OUT", -10000),
          row(user!.id, importId, 5, "2026-04-08", `VERGI E2E ${stamp} KDV`, "OUT", -40000),
          row(user!.id, importId, 6, "2026-04-10", `Müvekkil vekalet ${stamp}`, "IN", 50000)
        ]
      });

      const analysis = await getBankAnalysisScreenData({ userId: user!.id, importId, page: 1, pageSize: 50 });
      expect(analysis.summary.totalOut).toBe(80000);
      expect(analysis.summary.totalIn).toBe(50000);
      expect(analysis.summary.highConfidenceSuggestions).toBeGreaterThanOrEqual(5);
      expect(analysis.recurring.expense.some((item) => item.category === `Kira E2E ${stamp}` && item.count === 4)).toBeTruthy();
      expect(analysis.largeTransactions.expense[0].amount).toBe(40000);
      expect(analysis.largeTransactions.expense[0].category).toBe(`Vergi E2E ${stamp}`);

      const ledgerAfter = await prisma.cashLedgerEntry.count({ where: { userId: user!.id, deletedAt: null } });
      expect(ledgerAfter).toBe(ledgerBefore);
    } finally {
      if (importId) {
        await prisma.bankStatementRow.deleteMany({ where: { importId } });
        await prisma.bankStatementImport.deleteMany({ where: { id: importId } });
      }
      await prisma.transactionRule.deleteMany({ where: { id: { in: [kiraRuleId, vergiRuleId].filter(Boolean) as string[] } } });
      await prisma.transactionCategory.deleteMany({ where: { id: { in: [kiraCategoryId, vergiCategoryId].filter(Boolean) as string[] } } });
    }
  });
});

function row(userId: string, importId: string, rowNumber: number, date: string, description: string, direction: "IN" | "OUT", amount: number) {
  return {
    userId,
    importId,
    rowNumber,
    transactionDate: new Date(`${date}T00:00:00+03:00`),
    description,
    debitAmount: direction === "OUT" ? Math.abs(amount) : null,
    creditAmount: direction === "IN" ? Math.abs(amount) : null,
    amount,
    currency: "TRY",
    direction,
    status: "SUCCESS" as const,
    rawData: { date, description, amount: String(amount) },
    rawHash: `${importId}-${rowNumber}-${amount}`
  };
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
