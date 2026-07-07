import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import {
  DocumentUploadError,
  type DocumentStorageAdapter,
  type DocumentStorageWriteInput,
  type DocumentStorageWriteResult
} from "./storage";
import { allowedDocumentExtensions } from "./validate-upload";

const privateStoragePrefix = "documents";
const storedFileNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export function documentStorageRoot() {
  return documentStorageDirectory();
}

export function documentStorageDirectory() {
  return path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "documents"));
}

export class LocalDocumentStorage implements DocumentStorageAdapter {
  readonly kind = "local";
  readonly rootDirectory: string;

  constructor(rootDirectory = documentStorageDirectory()) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async write(input: DocumentStorageWriteInput): Promise<DocumentStorageWriteResult> {
    const fileName = normalizeStoredFileName(input.fileName);
    const targetPath = this.resolvePhysicalPath(fileName);

    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(targetPath, input.buffer);

    return { storagePath: toPrivateStoragePath(fileName) };
  }

  async read(storagePath: string) {
    return readFile(this.resolvePhysicalPath(storagePath));
  }

  resolvePhysicalPath(storagePath: string) {
    const fileName = normalizeStoredFileName(storagePath);
    const targetPath = path.resolve(this.rootDirectory, fileName);

    if (!isPathInside(this.rootDirectory, targetPath)) {
      throw new DocumentUploadError("Dosya yolu güvenli değil.");
    }

    return targetPath;
  }
}

export function toPrivateStoragePath(fileName: string) {
  return `${privateStoragePrefix}/${normalizeStoredFileName(fileName)}`;
}

export function normalizeStoredFileName(input: string) {
  const normalized = input.replace(/\\/g, "/").trim();

  if (!normalized || normalized.includes("\0") || path.posix.isAbsolute(normalized)) {
    throw new DocumentUploadError("Dosya yolu güvenli değil.");
  }

  const withoutPrefix = normalized.startsWith(`${privateStoragePrefix}/`)
    ? normalized.slice(privateStoragePrefix.length + 1)
    : normalized;
  const compact = path.posix.normalize(withoutPrefix);

  if (
    compact === "." ||
    compact.startsWith("../") ||
    compact.includes("/") ||
    compact !== path.posix.basename(compact) ||
    !storedFileNamePattern.test(compact)
  ) {
    throw new DocumentUploadError("Dosya yolu güvenli değil.");
  }

  const extension = path.extname(compact).toLowerCase();
  if (!allowedDocumentExtensions.includes(extension)) {
    throw new DocumentUploadError("Dosya türü desteklenmiyor.");
  }

  return compact;
}

function isPathInside(rootPath: string, targetPath: string) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
