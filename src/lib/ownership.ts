import { prisma } from "@/lib/prisma";

export function ownedBy(userId: string) {
  return { userId };
}

export async function findOwnedClient(userId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true, archivedAt: true, deletedAt: true }
  });
}

export async function findOwnedCaseFile(userId: string, caseFileId: string) {
  return prisma.caseFile.findFirst({
    where: { id: caseFileId, userId },
    select: {
      id: true,
      clientId: true,
      status: true,
      archivedAt: true,
      deletedAt: true,
      client: { select: { archivedAt: true, deletedAt: true } }
    }
  });
}

export async function validateOwnedClientAndCase(
  userId: string,
  clientId: string | null,
  caseFileId: string | null
) {
  if (clientId) {
    const client = await findOwnedClient(userId, clientId);
    if (!client) {
      return { ok: false as const, message: "Seçilen müvekkil bulunamadı. Lütfen güncel listeden yeniden seçin." };
    }

    if (client.archivedAt || client.deletedAt) {
      return { ok: false as const, message: "Arşivdeki müvekkile yeni işlem bağlanamaz." };
    }
  }

  if (!caseFileId) {
    return { ok: true as const, clientId };
  }

  const caseFile = await findOwnedCaseFile(userId, caseFileId);
  if (!caseFile) {
    return { ok: false as const, message: "Seçilen dosya bulunamadı. Lütfen güncel listeden yeniden seçin." };
  }

  if (
    caseFile.status === "ARCHIVED" ||
    caseFile.archivedAt ||
    caseFile.deletedAt ||
    caseFile.client.archivedAt ||
    caseFile.client.deletedAt
  ) {
    return { ok: false as const, message: "Arşivdeki dosyaya yeni işlem bağlanamaz." };
  }

  if (clientId && caseFile.clientId !== clientId) {
    return { ok: false as const, message: "Seçilen dosya bu müvekkile bağlı değil" };
  }

  return { ok: true as const, clientId: clientId ?? caseFile.clientId };
}
