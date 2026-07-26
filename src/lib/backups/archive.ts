import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { BackupMetadata, DocumentManifestEntry } from "@/lib/backups/types";

const execFileAsync = promisify(execFile);

export async function createBackupArchive({
  payloadDirectory,
  snapshotPath,
  documentDirectory,
  documentManifest,
  metadata,
  archivePath
}: {
  payloadDirectory: string;
  snapshotPath: string;
  documentDirectory: string;
  documentManifest: DocumentManifestEntry[];
  metadata: BackupMetadata;
  archivePath: string;
}) {
  await mkdir(payloadDirectory, { recursive: true, mode: 0o700 });
  await symlink(snapshotPath, path.join(payloadDirectory, "database.sqlite"));
  await symlink(documentDirectory, path.join(payloadDirectory, "documents"));
  await writeJson(path.join(payloadDirectory, "document-manifest.json"), documentManifest);
  await writeJson(path.join(payloadDirectory, "record-counts.json"), metadata.database.recordCounts);
  await writeJson(path.join(payloadDirectory, "backup-metadata.json"), metadata);

  await execFileAsync("tar", ["-chzf", archivePath, "-C", payloadDirectory, "."], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000
  });
}

export async function extractBackupArchive(archivePath: string, destinationDirectory: string) {
  await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
  const { stdout } = await execFileAsync("tar", ["-tzf", archivePath], {
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000
  });

  for (const entry of stdout.split("\n").filter(Boolean)) {
    const normalized = entry.replace(/^\.\//, "");
    if (!normalized || normalized === ".") continue;
    if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) {
      throw new Error("Yedek arşivi güvenli olmayan yol içeriyor.");
    }
  }

  await execFileAsync("tar", ["-xzf", archivePath, "-C", destinationDirectory], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000
  });

  const metadata = JSON.parse(
    await readFile(path.join(destinationDirectory, "backup-metadata.json"), "utf8")
  ) as BackupMetadata;
  const documentManifest = JSON.parse(
    await readFile(path.join(destinationDirectory, "document-manifest.json"), "utf8")
  ) as DocumentManifestEntry[];

  return { metadata, documentManifest };
}

export async function removeBackupWorkspace(directory: string) {
  const workspaceStat = await lstat(directory).catch(() => null);
  if (!workspaceStat) return;

  const temporaryRoot = path.resolve(process.env.BACKUP_TEMP_DIR ?? "/tmp");
  const resolvedDirectory = path.resolve(directory);

  if (!resolvedDirectory.startsWith(`${temporaryRoot}${path.sep}`)) {
    throw new Error("Yedek çalışma alanı yalnız geçici dizinde temizlenebilir.");
  }

  await rm(resolvedDirectory, { recursive: true, force: true });
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
