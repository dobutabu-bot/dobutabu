import { prisma } from "@/lib/prisma";

export type FirmSettings = {
  firmName: string;
  ownerName: string;
  currency: string;
};

export const DEFAULT_FIRM_SETTINGS: FirmSettings = {
  firmName: "Hukuk Bürosu",
  ownerName: "Avukat",
  currency: "TRY"
};

function normalizeFirmSettings(settings: FirmSettings): FirmSettings {
  return {
    ...settings,
    firmName: settings.firmName === "Hukuk Burosu" ? DEFAULT_FIRM_SETTINGS.firmName : settings.firmName
  };
}

export async function getFirmSettings(userId: string): Promise<FirmSettings> {
  const rows = await prisma.appSetting.findMany({
    where: {
      userId,
      key: {
        in: ["firmName", "ownerName", "currency"]
      }
    }
  });

  const settings = rows.reduce(
    (currentSettings, row) => ({ ...currentSettings, [row.key]: row.value }),
    DEFAULT_FIRM_SETTINGS
  );

  return normalizeFirmSettings(settings);
}

export async function setFirmSettings(userId: string, settings: FirmSettings) {
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { userId_key: { userId, key: "firmName" } },
      update: { value: settings.firmName },
      create: { userId, key: "firmName", value: settings.firmName }
    }),
    prisma.appSetting.upsert({
      where: { userId_key: { userId, key: "ownerName" } },
      update: { value: settings.ownerName },
      create: { userId, key: "ownerName", value: settings.ownerName }
    }),
    prisma.appSetting.upsert({
      where: { userId_key: { userId, key: "currency" } },
      update: { value: settings.currency },
      create: { userId, key: "currency", value: settings.currency }
    })
  ]);
}
