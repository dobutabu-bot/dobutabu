import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import {
  createAssetAccount,
  createAssetValuation,
  getCapitalSummary,
  softDeleteAssetAccount,
  updateAssetAccount
} from "../../src/lib/capital/asset-service";
import { getCapitalCenterData } from "../../src/lib/capital/capital-data";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 manual capital center", () => {
  test("creates, updates, values and soft deletes manual assets while calculating net worth", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Sermaye merkezi servis testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    const createdAssetIds: string[] = [];

    try {
      const bankAsset = await createAssetAccount(user!.id, {
        name: `Manuel banka varlığı ${stamp}`,
        assetType: "BANK",
        currency: "XTS",
        symbol: "XTS",
        manualTotalValue: "10000",
        valuationCurrency: "XTS",
        description: "Servis testi manuel varlık",
        isActive: true
      });
      createdAssetIds.push(bankAsset.id);

      const debtAsset = await createAssetAccount(user!.id, {
        name: `Manuel borç ${stamp}`,
        assetType: "DEBT",
        currency: "XTS",
        symbol: "BORC",
        manualTotalValue: "2500",
        valuationCurrency: "XTS",
        description: "Servis testi borç",
        isActive: true
      });
      createdAssetIds.push(debtAsset.id);

      const initialSummary = await getCapitalSummary(user!.id, "XTS");
      expect(initialSummary.totalAssets).toBe(10000);
      expect(initialSummary.totalDebts).toBe(2500);
      expect(initialSummary.netWorth).toBe(7500);

      const initialValuations = await prisma.assetValuation.count({ where: { userId: user!.id, assetAccountId: { in: createdAssetIds }, deletedAt: null } });
      const initialTransactions = await prisma.assetTransaction.count({ where: { userId: user!.id, assetAccountId: { in: createdAssetIds }, transactionType: "VALUE_UPDATE", deletedAt: null } });
      expect(initialValuations).toBe(2);
      expect(initialTransactions).toBe(2);

      await updateAssetAccount(user!.id, bankAsset.id, {
        name: `Manuel banka varlığı güncel ${stamp}`,
        assetType: "BANK",
        currency: "XTS",
        symbol: "XTS",
        manualTotalValue: "10000",
        valuationCurrency: "XTS",
        description: "Güncellendi",
        isActive: true
      });
      await createAssetValuation(user!.id, {
        assetAccountId: debtAsset.id,
        valuationDate: "2026-07-06",
        totalValue: "3000",
        valuationCurrency: "XTS",
        source: "MANUAL",
        note: "Borç değeri güncellendi"
      });

      const updatedSummary = await getCapitalSummary(user!.id, "XTS");
      expect(updatedSummary.totalAssets).toBe(10000);
      expect(updatedSummary.totalDebts).toBe(3000);
      expect(updatedSummary.netWorth).toBe(7000);

      const debtTransactions = await prisma.assetTransaction.count({ where: { userId: user!.id, assetAccountId: debtAsset.id, transactionType: "VALUE_UPDATE", deletedAt: null } });
      expect(debtTransactions).toBe(2);

      await softDeleteAssetAccount(user!.id, bankAsset.id);
      const afterDelete = await getCapitalSummary(user!.id, "XTS");
      expect(afterDelete.totalAssets).toBe(0);
      expect(afterDelete.totalDebts).toBe(3000);
      expect(afterDelete.netWorth).toBe(-3000);
    } finally {
      await cleanupCapitalRecords(user!.id, createdAssetIds);
    }
  });

  test("suggests unlinked CashAccount assets without creating AssetAccount automatically", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Sermaye merkezi servis testi tek projede çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const stamp = uniqueStamp();
    let cashAccountId: string | null = null;

    try {
      const cashAccount = await prisma.cashAccount.create({
        data: {
          userId: user!.id,
          name: `Öneri banka hesabı ${stamp}`,
          type: "BANK",
          currency: "TRY",
          openingBalance: 4321,
          isActive: true,
          isDefault: false
        }
      });
      cashAccountId = cashAccount.id;

      const beforeCount = await prisma.assetAccount.count({ where: { userId: user!.id, linkedCashAccountId: cashAccount.id } });
      const data = await getCapitalCenterData(user!.id, "TRY");
      const suggestion = data.cashAccountSuggestions.find((item) => item.cashAccountId === cashAccount.id);

      expect(beforeCount).toBe(0);
      expect(suggestion).toBeTruthy();
      expect(suggestion?.suggestedAssetType).toBe("BANK");
      expect(suggestion?.balance).toBe(4321);

      const afterCount = await prisma.assetAccount.count({ where: { userId: user!.id, linkedCashAccountId: cashAccount.id } });
      expect(afterCount).toBe(0);
    } finally {
      if (cashAccountId) {
        await prisma.auditLog.deleteMany({ where: { entityId: cashAccountId } });
        await prisma.cashAccount.deleteMany({ where: { id: cashAccountId } });
      }
    }
  });
});

async function cleanupCapitalRecords(userId: string, assetIds: string[]) {
  if (assetIds.length === 0) return;
  await prisma.auditLog.deleteMany({ where: { userId, entityId: { in: assetIds } } });
  const valuationIds = (await prisma.assetValuation.findMany({ where: { userId, assetAccountId: { in: assetIds } }, select: { id: true } })).map((row) => row.id);
  const transactionIds = (await prisma.assetTransaction.findMany({ where: { userId, assetAccountId: { in: assetIds } }, select: { id: true } })).map((row) => row.id);
  await prisma.auditLog.deleteMany({ where: { userId, entityId: { in: [...valuationIds, ...transactionIds] } } });
  await prisma.assetTransaction.deleteMany({ where: { userId, assetAccountId: { in: assetIds } } });
  await prisma.assetValuation.deleteMany({ where: { userId, assetAccountId: { in: assetIds } } });
  await prisma.assetAccount.deleteMany({ where: { userId, id: { in: assetIds } } });
}

function uniqueStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
