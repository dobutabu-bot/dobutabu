import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import type { DocumentManifestEntry } from "@/lib/backups/types";

export async function buildDocumentManifest(directory: string) {
  const entries: DocumentManifestEntry[] = [];
  await walk(directory, directory, entries);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return entries;
}

export function documentManifestTotals(entries: DocumentManifestEntry[]) {
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.size, 0)
  };
}

export function hashDocumentManifest(entries: DocumentManifestEntry[]) {
  const canonical = entries
    .map((entry) => ({
      path: entry.path.normalize("NFC"),
      size: entry.size,
      sha256: entry.sha256
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

async function walk(root: string, directory: string, entries: DocumentManifestEntry[]) {
  const children = await readdir(directory, { withFileTypes: true });

  for (const child of children) {
    if (child.name === ".write-check" || child.name.startsWith(".backup-")) {
      continue;
    }

    const absolutePath = path.join(directory, child.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");

    if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
      throw new Error("Belge manifest yolu güvenli değil.");
    }

    if (child.isDirectory()) {
      await walk(root, absolutePath, entries);
      continue;
    }

    const fileStat = await lstat(absolutePath);
    if (fileStat.isSymbolicLink()) {
      throw new Error("Belge storage içinde sembolik bağlantıya izin verilmez.");
    }
    if (!fileStat.isFile()) {
      continue;
    }

    entries.push({
      path: relativePath,
      size: fileStat.size,
      sha256: await hashFile(absolutePath)
    });
  }
}

async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}
