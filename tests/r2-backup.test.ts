import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";

import {
  BACKUP_MODE_HEADER,
  BACKUP_SIGNATURE_HEADER,
  BACKUP_TIMESTAMP_HEADER,
  signBackupRequest,
  verifyBackupRequest
} from "@/lib/backups/auth";
import { createBackupArchive } from "@/lib/backups/archive";
import { decryptBackupFile, encryptBackupFile, sha256File } from "@/lib/backups/crypto";
import {
  buildDocumentManifest,
  documentManifestTotals,
  hashDocumentManifest
} from "@/lib/backups/manifest";
import { backupTiersForDate, selectObjectsToDelete } from "@/lib/backups/retention";
import { verifyDownloadedBackup } from "@/lib/backups/service";
import {
  createConsistentSqliteSnapshot,
  readSqliteRecordCounts,
  verifySqliteIntegrity
} from "@/lib/backups/sqlite";
import type { BackupMetadata } from "@/lib/backups/types";

const execFileAsync = promisify(execFile);
const workspace = path.join(os.tmpdir(), `r2-backup-test-${Date.now()}-${process.pid}`);

before(async () => {
  await mkdir(workspace, { recursive: true });
});

after(async () => {
  await rm(workspace, { recursive: true, force: true });
});

test("backup HMAC doğrulaması geçerli, eski ve değiştirilmiş istekleri ayırır", () => {
  const secret = "backup-test-secret-that-is-longer-than-32-characters";
  const timestamp = "1785024000";
  const signature = signBackupRequest({
    secret,
    timestamp,
    method: "POST",
    pathname: "/api/internal/backup",
    mode: "daily"
  });
  const request = new Request("https://example.test/api/internal/backup", {
    method: "POST",
    headers: {
      [BACKUP_TIMESTAMP_HEADER]: timestamp,
      [BACKUP_SIGNATURE_HEADER]: signature,
      [BACKUP_MODE_HEADER]: "daily"
    }
  });

  assert.deepEqual(verifyBackupRequest(request, secret, Number(timestamp)), {
    ok: true,
    mode: "daily"
  });
  assert.equal(verifyBackupRequest(request, secret, Number(timestamp) + 301).ok, false);

  const tampered = new Request("https://example.test/api/internal/backup", {
    method: "POST",
    headers: {
      [BACKUP_TIMESTAMP_HEADER]: timestamp,
      [BACKUP_SIGNATURE_HEADER]: signature,
      [BACKUP_MODE_HEADER]: "baseline"
    }
  });
  assert.equal(verifyBackupRequest(tampered, secret, Number(timestamp)).ok, false);
});

test("retention günlük 7, haftalık 5 ve aylık 12 sınırını deterministik uygular", () => {
  const objects = Array.from({ length: 10 }, (_, index) => ({
    key: `buro-finans/daily/backup-${index}.bfbackup`,
    lastModified: new Date(Date.UTC(2026, 6, index + 1)),
    size: 100
  }));

  const deleted = selectObjectsToDelete(objects, 7);
  assert.equal(deleted.length, 3);
  assert.deepEqual(
    deleted.map((object) => object.key),
    [
      "buro-finans/daily/backup-2.bfbackup",
      "buro-finans/daily/backup-1.bfbackup",
      "buro-finans/daily/backup-0.bfbackup"
    ]
  );
  assert.deepEqual(backupTiersForDate(new Date("2026-07-26T00:15:00.000Z")), ["daily", "weekly"]);
  assert.deepEqual(backupTiersForDate(new Date("2026-08-01T00:15:00.000Z")), ["daily", "monthly"]);
  assert.deepEqual(backupTiersForDate(new Date("2026-07-27T00:15:00.000Z"), true), [
    "daily",
    "weekly",
    "monthly",
    "baseline"
  ]);
});

test("SQLite snapshot, belge manifesti, AES-256-GCM ve izole restore doğrulaması geçer", async () => {
  const testRoot = path.join(workspace, "roundtrip");
  const sourceDatabase = path.join(testRoot, "source.sqlite");
  const snapshotDatabase = path.join(testRoot, "database.sqlite");
  const documents = path.join(testRoot, "documents-source");
  const payload = path.join(testRoot, "payload");
  const archive = path.join(testRoot, "backup.tar.gz");
  const encrypted = path.join(testRoot, "backup.bfbackup");
  const decrypted = path.join(testRoot, "restored.tar.gz");
  const restored = path.join(testRoot, "restored");
  const encryptionKey = randomBytes(32);

  await mkdir(documents, { recursive: true });
  await writeFile(path.join(documents, "dekont-ç.pdf"), "%PDF-1.4\nanonim test\n");
  await mkdir(path.join(documents, "nested"));
  await writeFile(path.join(documents, "nested", "fiş.txt"), "Türkçe belge içeriği");
  await execFileAsync("sqlite3", [
    sourceDatabase,
    "CREATE TABLE Client(id TEXT PRIMARY KEY, name TEXT); INSERT INTO Client VALUES('1','Anonim Müvekkil');"
  ]);

  await createConsistentSqliteSnapshot(sourceDatabase, snapshotDatabase);
  assert.equal(await verifySqliteIntegrity(snapshotDatabase), "ok");
  const recordCounts = await readSqliteRecordCounts(snapshotDatabase);
  assert.equal(recordCounts.Client, 1);
  const documentManifest = await buildDocumentManifest(documents);
  const totals = documentManifestTotals(documentManifest);
  const metadata: BackupMetadata = {
    formatVersion: 1,
    backupId: "test-backup",
    createdAt: "2026-07-26T00:15:00.000Z",
    mode: "baseline",
    database: {
      fileName: "database.sqlite",
      sha256: await sha256File(snapshotDatabase),
      size: (await stat(snapshotDatabase)).size,
      integrity: "ok",
      recordCounts
    },
    documents: {
      directoryName: "documents",
      fileCount: totals.fileCount,
      totalBytes: totals.totalBytes,
      manifestSha256: hashDocumentManifest(documentManifest)
    }
  };

  await createBackupArchive({
    payloadDirectory: payload,
    snapshotPath: snapshotDatabase,
    documentDirectory: documents,
    documentManifest,
    metadata,
    archivePath: archive
  });
  const encryption = await encryptBackupFile({
    inputPath: archive,
    outputPath: encrypted,
    key: encryptionKey
  });
  const verification = await verifyDownloadedBackup({
    encryptedPath: encrypted,
    expectedEncryptedSha256: encryption.encryptedSha256,
    decryptedPath: decrypted,
    restoredDirectory: restored,
    encryptionKey
  });

  assert.equal(verification.databaseIntegrity, "ok");
  assert.equal(verification.recordCountsMatch, true);
  assert.equal(verification.documentManifestMatch, true);
  assert.equal(verification.documentFileCount, 2);
});

test("AES-256-GCM değiştirilmiş şifreli yedeği reddeder", async () => {
  const testRoot = path.join(workspace, "tamper");
  const source = path.join(testRoot, "source.txt");
  const encrypted = path.join(testRoot, "backup.bfbackup");
  const tampered = path.join(testRoot, "tampered.bfbackup");
  const output = path.join(testRoot, "output.txt");
  const encryptionKey = randomBytes(32);

  await mkdir(testRoot, { recursive: true });
  await writeFile(source, "anonim yedek içeriği");
  await encryptBackupFile({
    inputPath: source,
    outputPath: encrypted,
    key: encryptionKey
  });

  const bytes = await readFile(encrypted);
  bytes[bytes.length - 1] ^= 0xff;
  await writeFile(tampered, bytes);

  await assert.rejects(
    decryptBackupFile({
      inputPath: tampered,
      outputPath: output,
      key: encryptionKey
    })
  );
});
