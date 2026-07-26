import { mkdir, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getBackupConfig } from "@/lib/backups/config";
import { removeBackupWorkspace } from "@/lib/backups/archive";
import { sha256File } from "@/lib/backups/crypto";
import { R2BackupStore } from "@/lib/backups/r2";
import { verifyDownloadedBackup } from "@/lib/backups/service";

const outputArgument = argumentValue("--output");
const requestedKey = argumentValue("--key");

if (!outputArgument) {
  console.error("Kullanım: npm run backup:r2:restore -- --output /guvenli/gecici/dizin [--key object-key]");
  process.exit(1);
}

const outputDirectory = path.resolve(outputArgument);
assertIsolatedOutput(outputDirectory);
await assertOutputIsEmpty(outputDirectory);

const config = getBackupConfig();
const store = new R2BackupStore(config);
const temporaryRoot = path.resolve(process.env.BACKUP_TEMP_DIR ?? os.tmpdir());
const workspace = path.join(temporaryRoot, `buro-finans-restore-${Date.now()}-${process.pid}`);
const encryptedPath = path.join(workspace, "backup.bfbackup");
const decryptedPath = path.join(workspace, "backup.tar.gz");

try {
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const objectKey = requestedKey || (await latestDailyKey(store, config.objectPrefix));
  const download = await store.downloadFile(objectKey, encryptedPath);
  const encryptedSha256 = await sha256File(encryptedPath);
  const expectedSha256 = download.metadata["encrypted-sha256"];

  if (expectedSha256 && expectedSha256 !== encryptedSha256) {
    throw new Error("R2 nesne checksum doğrulaması başarısız.");
  }

  const verification = await verifyDownloadedBackup({
    encryptedPath,
    expectedEncryptedSha256: expectedSha256 || encryptedSha256,
    decryptedPath,
    restoredDirectory: outputDirectory,
    encryptionKey: config.encryptionKey
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        objectKey,
        outputDirectory,
        databaseIntegrity: verification.databaseIntegrity,
        recordCountsMatch: verification.recordCountsMatch,
        documentManifestMatch: verification.documentManifestMatch,
        documentFileCount: verification.documentFileCount
      },
      null,
      2
    )
  );
} finally {
  store.destroy();
  await removeBackupWorkspace(workspace);
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertIsolatedOutput(directory: string) {
  const forbiddenRoots = new Set([
    path.resolve("/data"),
    path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? "/data/documents"),
    path.dirname(path.resolve((process.env.DATABASE_URL ?? "file:/data/buro-finans.db").replace(/^file:/, "")))
  ]);

  for (const forbiddenRoot of forbiddenRoots) {
    if (directory === forbiddenRoot || directory.startsWith(`${forbiddenRoot}${path.sep}`)) {
      throw new Error("Restore provası production volume veya storage içine yazamaz.");
    }
  }
}

async function assertOutputIsEmpty(directory: string) {
  const existing = await stat(directory).catch(() => null);
  if (!existing) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    return;
  }
  if (!existing.isDirectory()) {
    throw new Error("Restore hedefi klasör olmalıdır.");
  }
  if ((await readdir(directory)).length > 0) {
    throw new Error("Restore hedefi boş olmalıdır.");
  }
}

async function latestDailyKey(store: R2BackupStore, prefix: string) {
  const objects = await store.list(`${prefix}/daily/`);
  const latest = objects
    .filter((object) => object.key.endsWith(".bfbackup"))
    .sort((left, right) => {
      const byDate = (right.lastModified?.getTime() ?? 0) - (left.lastModified?.getTime() ?? 0);
      return byDate || right.key.localeCompare(left.key);
    })[0];

  if (!latest) {
    throw new Error("R2 içinde geri yüklenecek günlük yedek bulunamadı.");
  }
  return latest.key;
}
