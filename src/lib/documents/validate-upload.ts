import path from "path";

import { DocumentUploadError, sanitizeFileName } from "@/lib/documents/storage";

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
] as const;

const extensionMimeMap: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".csv": ["text/csv", "application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
  ".xls": ["application/vnd.ms-excel"]
};

export const allowedDocumentExtensions = Object.keys(extensionMimeMap);

export type UploadedDocumentFileValidation = {
  extension: string;
  mimeType: string;
  originalFileName: string;
  detectedSignature: string;
};

export async function validateUploadedDocumentFile(file: File, maxBytes: number): Promise<UploadedDocumentFileValidation> {
  const originalFileName = sanitizeFileName(file.name);
  const extension = path.extname(originalFileName).toLowerCase();
  const mimeType = file.type;
  const allowedMimes = extensionMimeMap[extension];

  if (!allowedMimes || !mimeType || !allowedMimes.includes(mimeType)) {
    throw new DocumentUploadError("Dosya türü desteklenmiyor. PDF, PNG, JPG, JPEG, CSV veya XLSX yükleyebilirsiniz.");
  }

  if (!allowedDocumentMimeTypes.includes(mimeType as (typeof allowedDocumentMimeTypes)[number])) {
    throw new DocumentUploadError("Dosya MIME tipi desteklenmiyor.");
  }

  if (file.size <= 0) {
    throw new DocumentUploadError("Boş dosya yüklenemez.");
  }

  if (file.size > maxBytes) {
    throw new DocumentUploadError(`Dosya boyutu çok büyük. En fazla ${formatMegabytes(maxBytes)} MB yükleyebilirsiniz.`);
  }

  const header = Buffer.from(await file.slice(0, 512).arrayBuffer());
  const detectedSignature = detectFileSignature(header, extension);

  if (!isAllowedSignatureForExtension(extension, detectedSignature)) {
    throw new DocumentUploadError("Dosya içeriği, uzantı veya MIME tipiyle uyuşmuyor. Lütfen dosyanın gerçek formatını kontrol edin.");
  }

  return { extension, mimeType, originalFileName, detectedSignature };
}

export function sanitizeDocumentTitle(input: string, fallback: string) {
  const normalized = (input || fallback || "Belge")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.slice(0, 180) || "Belge";
}

export function detectFileSignature(header: Buffer, extension: string) {
  if (startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(header, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(header, [0x50, 0x4b, 0x03, 0x04]) || startsWith(header, [0x50, 0x4b, 0x05, 0x06]) || startsWith(header, [0x50, 0x4b, 0x07, 0x08])) return "zip";
  if (startsWith(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (extension === ".csv" && looksLikeText(header)) return "text";

  return "unknown";
}

function isAllowedSignatureForExtension(extension: string, signature: string) {
  switch (extension) {
    case ".pdf":
      return signature === "pdf";
    case ".png":
      return signature === "png";
    case ".jpg":
    case ".jpeg":
      return signature === "jpeg";
    case ".csv":
      return signature === "text";
    case ".xlsx":
      return signature === "zip";
    case ".xls":
      return signature === "ole";
    default:
      return false;
  }
}

function startsWith(buffer: Buffer, bytes: number[]) {
  if (buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
}

function looksLikeText(buffer: Buffer) {
  if (buffer.length === 0) {
    return false;
  }

  let printable = 0;
  for (const byte of buffer) {
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128) {
      printable += 1;
    }
  }

  return printable / buffer.length > 0.9;
}

function formatMegabytes(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}
