import type { BackupTier } from "@/lib/backups/types";
import type { BackupObject, R2BackupStore } from "@/lib/backups/r2";

const RETENTION_LIMITS: Record<Exclude<BackupTier, "baseline">, number> = {
  daily: 7,
  weekly: 5,
  monthly: 12
};

export function backupTiersForDate(date: Date, includeBaseline = false) {
  const tiers: BackupTier[] = ["daily"];
  if (date.getUTCDay() === 0 || includeBaseline) tiers.push("weekly");
  if (date.getUTCDate() === 1 || includeBaseline) tiers.push("monthly");
  if (includeBaseline) tiers.push("baseline");
  return tiers;
}

export function buildBackupObjectKey({
  prefix,
  tier,
  backupId
}: {
  prefix: string;
  tier: BackupTier;
  backupId: string;
}) {
  return `${prefix}/${tier}/${backupId}.bfbackup`;
}

export async function applyBackupRetention({
  store,
  prefix
}: {
  store: R2BackupStore;
  prefix: string;
}) {
  let deletedObjects = 0;

  for (const [tier, limit] of Object.entries(RETENTION_LIMITS) as Array<
    [Exclude<BackupTier, "baseline">, number]
  >) {
    const objects = await store.list(`${prefix}/${tier}/`);
    const candidates = selectObjectsToDelete(objects, limit);

    for (const object of candidates) {
      await store.delete(object.key);
      deletedObjects += 1;
    }
  }

  return { deletedObjects };
}

export function selectObjectsToDelete(objects: BackupObject[], keep: number) {
  if (objects.length <= keep) return [];

  return [...objects]
    .sort((left, right) => {
      const timeDifference = (right.lastModified?.getTime() ?? 0) - (left.lastModified?.getTime() ?? 0);
      return timeDifference || right.key.localeCompare(left.key);
    })
    .slice(keep);
}
