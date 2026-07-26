import { randomUUID } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createBackupArchive, extractBackupArchive, removeBackupWorkspace } from "@/lib/backups/archive";
import { getBackupConfig } from "@/lib/backups/config";
import { decryptBackupFile, encryptBackupFile, sha256File } from "@/lib/backups/crypto";
import {
  buildDocumentManifest,
  documentManifestTotals,
  hashDocumentManifest
} from "@/lib/backups/manifest";
import { R2BackupStore } from "@/lib/backups/r2";
import {
  applyBackupRetention,
  backupTiersForDate,
  buildBackupObjectKey
} from "@/lib/backups/retention";
import {
  createConsistentSqliteSnapshot,
  readSqliteRecordCounts,
  resolveSqliteDatabasePath,
  verifySqliteIntegrity
} from "@/lib/backups/sqlite";
import type {
  BackupMetadata,
  BackupMode,
  BackupRunResult,
  BackupVerification,
  DocumentManifestEntry
} from "@/lib/backups/types";

let activeBackup: Promise<BackupRunResult> | null = null;

export function runR2Backup(mode: BackupMode) {
  if (activeBackup) {
    throw new BackupAlreadyRunningError();
  }

  activeBackup = executeBackup(mode).finally(() => {
    activeBackup = null;
  });
  return activeBackup;
}

export class BackupAlreadyRunningError extends Error {
  constructor() {
    super("Başka bir yedekleme işlemi devam ediyor.");
    this.name = "BackupAlreadyRunningError";
  }
}

async function executeBackup(mode: BackupMode): Promise<BackupRunResult> {
  const config = getBackupConfig();
  const createdAt = new Date();
  const backupId = `${createdAt.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const workspace = path.join(process.env.BACKUP_TEMP_DIR ?? os.tmpdir(), `buro-finans-${backupId}`);
  const snapshotPath = path.join(workspace, "database.sqlite");
  const payloadDirectory = path.join(workspace, "payload");
  const archivePath = path.join(workspace, "backup.tar.gz");
  const encryptedPath = path.join(workspace, `${backupId}.bfbackup`);
  const downloadedPath = path.join(workspace, "downloaded.bfbackup");
  const decryptedPath = path.join(workspace, "downloaded.tar.gz");
  const restoredDirectory = path.join(workspace, "restored");
  const store = new R2BackupStore(config);

  try {
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    const databasePath = resolveSqliteDatabasePath();
    const documentDirectory = resolveDocumentDirectory();
    await createConsistentSqliteSnapshot(databasePath, snapshotPath);
    const databaseIntegrity = await verifySqliteIntegrity(snapshotPath);
    const recordCounts = await readSqliteRecordCounts(snapshotPath);
    const documentManifest = await buildDocumentManifest(documentDirectory);
    const documentTotals = documentManifestTotals(documentManifest);
    const databaseStat = await stat(snapshotPath);
    const metadata: BackupMetadata = {
      formatVersion: 1,
      backupId,
      createdAt: createdAt.toISOString(),
      mode,
      database: {
        fileName: "database.sqlite",
        sha256: await sha256File(snapshotPath),
        size: databaseStat.size,
        integrity: databaseIntegrity,
        recordCounts
      },
      documents: {
        directoryName: "documents",
        fileCount: documentTotals.fileCount,
        totalBytes: documentTotals.totalBytes,
        manifestSha256: hashDocumentManifest(documentManifest)
      }
    };

    await createBackupArchive({
      payloadDirectory,
      snapshotPath,
      documentDirectory,
      documentManifest,
      metadata,
      archivePath
    });
    const encryption = await encryptBackupFile({
      inputPath: archivePath,
      outputPath: encryptedPath,
      key: config.encryptionKey
    });
    const tiers = backupTiersForDate(createdAt, mode === "baseline");
    const objectKeys = tiers.map((tier) =>
      buildBackupObjectKey({ prefix: config.objectPrefix, tier, backupId })
    );
    const objectMetadata = {
      "backup-id": backupId,
      "format-version": "1",
      "encrypted-sha256": encryption.encryptedSha256,
      "database-sha256": metadata.database.sha256,
      "document-count": String(metadata.documents.fileCount)
    };

    for (const objectKey of objectKeys) {
      await store.putFile({
        key: objectKey,
        filePath: encryptedPath,
        metadata: objectMetadata
      });
    }

    const downloaded = await store.downloadFile(objectKeys[0], downloadedPath);
    if (downloaded.metadata["encrypted-sha256"] !== encryption.encryptedSha256) {
      throw new Error("R2 nesne metadata checksum doğrulamasını geçemedi.");
    }
    const verifiedBackup = await verifyDownloadedBackup({
      encryptedPath: downloadedPath,
      expectedEncryptedSha256: encryption.encryptedSha256,
      decryptedPath,
      restoredDirectory,
      encryptionKey: config.encryptionKey
    });
    const verification: BackupVerification = {
      ...verifiedBackup,
      objectKey: objectKeys[0]
    };

    const retention = await applyBackupRetention({
      store,
      prefix: config.objectPrefix
    });

    safeLog("backup.completed", {
      backupId,
      objectCount: objectKeys.length,
      documentCount: metadata.documents.fileCount,
      deletedObjects: retention.deletedObjects
    });

    return {
      backupId,
      createdAt: createdAt.toISOString(),
      objectKeys,
      verification,
      retention
    };
  } catch (error) {
    safeLog("backup.failed", {
      backupId,
      code: error instanceof BackupAlreadyRunningError ? "BACKUP_BUSY" : "BACKUP_FAILED"
    });
    throw error;
  } finally {
    store.destroy();
    await removeBackupWorkspace(workspace);
  }
}

export async function verifyDownloadedBackup({
  encryptedPath,
  expectedEncryptedSha256,
  decryptedPath,
  restoredDirectory,
  encryptionKey
}: {
  encryptedPath: string;
  expectedEncryptedSha256: string;
  decryptedPath: string;
  restoredDirectory: string;
  encryptionKey: Buffer;
}): Promise<BackupVerification> {
  const encryptedSha256 = await sha256File(encryptedPath);
  if (encryptedSha256 !== expectedEncryptedSha256) {
    throw new Error("R2 indirme checksum doğrulamasını geçemedi.");
  }

  await decryptBackupFile({
    inputPath: encryptedPath,
    outputPath: decryptedPath,
    key: encryptionKey
  });
  const { metadata, documentManifest } = await extractBackupArchive(decryptedPath, restoredDirectory);
  const restoredDatabasePath = path.join(restoredDirectory, "database.sqlite");
  const databaseIntegrity = await verifySqliteIntegrity(restoredDatabasePath);
  const restoredCounts = await readSqliteRecordCounts(restoredDatabasePath);
  assertRecordCounts(metadata.database.recordCounts, restoredCounts);
  const restoredManifest = await buildDocumentManifest(path.join(restoredDirectory, "documents"));
  assertDocumentManifest(documentManifest, restoredManifest);

  if ((await sha256File(restoredDatabasePath)) !== metadata.database.sha256) {
    throw new Error("Geri yüklenen SQLite checksum doğrulamasını geçemedi.");
  }
  if (hashDocumentManifest(restoredManifest) !== metadata.documents.manifestSha256) {
    throw new Error("Geri yüklenen belge manifesti checksum doğrulamasını geçemedi.");
  }

  return {
    objectKey: "",
    encryptedSha256,
    databaseIntegrity,
    recordCountsMatch: true,
    documentManifestMatch: true,
    documentFileCount: restoredManifest.length
  };
}

function resolveDocumentDirectory() {
  const configuredPath = process.env.DOCUMENT_STORAGE_DIR ?? "./storage/documents";
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

function assertRecordCounts(expected: Record<string, number>, actual: Record<string, number>) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error("Geri yüklenen SQLite kayıt sayımları eşleşmiyor.");
  }
}

function assertDocumentManifest(expected: DocumentManifestEntry[], actual: DocumentManifestEntry[]) {
  const expectedByPath = new Map(expected.map((entry) => [entry.path.normalize("NFC"), entry]));
  const actualByPath = new Map(actual.map((entry) => [entry.path.normalize("NFC"), entry]));

  if (expectedByPath.size !== actualByPath.size) {
    throw new Error("Geri yüklenen belge manifesti eşleşmiyor.");
  }

  for (const [filePath, expectedEntry] of expectedByPath) {
    const actualEntry = actualByPath.get(filePath);
    if (
      !actualEntry ||
      actualEntry.size !== expectedEntry.size ||
      actualEntry.sha256 !== expectedEntry.sha256
    ) {
      throw new Error("Geri yüklenen belge manifesti eşleşmiyor.");
    }
  }
}

function safeLog(event: string, details: Record<string, string | number>) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      severity: event.endsWith("failed") ? "error" : "info",
      event,
      ...details
    })
  );
}
