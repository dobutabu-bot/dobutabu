import { randomUUID } from "crypto";
import path from "path";

export const DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB = 20;
export const documentUploadLimitSettingKey = "documentMaxUploadSizeMb";

export { hashBuffer } from "@/lib/documents/hash";

export type DocumentStorageWriteInput = {
  fileName: string;
  buffer: Buffer;
};

export type DocumentStorageWriteResult = {
  storagePath: string;
};

export interface DocumentStorageAdapter {
  readonly kind: "local" | "s3-like";
  write(input: DocumentStorageWriteInput): Promise<DocumentStorageWriteResult>;
  read(storagePath: string): Promise<Buffer>;
}

export interface S3LikeStorage extends DocumentStorageAdapter {
  readonly kind: "s3-like";
  readonly bucket: string;
  readonly prefix?: string;
}

export function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "belge";
  return baseName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function createStoredDocumentName(extension: string) {
  return `${randomUUID()}${extension.toLowerCase()}`;
}

export function contentDisposition(fileName: string, disposition: "inline" | "attachment") {
  const fallback = sanitizeFileName(fileName).replace(/"/g, "");
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fallback)}`;
}

export class DocumentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentUploadError";
  }
}
