import { LocalDocumentStorage } from "@/lib/documents/local-storage";
import {
  DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB,
  documentUploadLimitSettingKey,
  type DocumentStorageAdapter
} from "@/lib/documents/storage";
import { prisma } from "@/lib/prisma";

export * from "@/lib/documents/storage";
export * from "@/lib/documents/hash";
export * from "@/lib/documents/validate-upload";
export { documentStorageDirectory, documentStorageRoot, LocalDocumentStorage } from "@/lib/documents/local-storage";

let activeDocumentStorage: DocumentStorageAdapter | null = null;

export function getDocumentStorage() {
  activeDocumentStorage ??= new LocalDocumentStorage();
  return activeDocumentStorage;
}

export async function getDocumentUploadLimitBytes(userId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { userId_key: { userId, key: documentUploadLimitSettingKey } },
    select: { value: true }
  });
  const parsedLimit = Number(setting?.value ?? process.env.DOCUMENT_MAX_UPLOAD_SIZE_MB ?? DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB);
  const limitMb = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_DOCUMENT_UPLOAD_LIMIT_MB;

  return Math.round(limitMb * 1024 * 1024);
}

export async function writePrivateDocumentFile(fileName: string, buffer: Buffer) {
  const result = await getDocumentStorage().write({ fileName, buffer });
  return result.storagePath;
}

export async function readPrivateDocumentFile(storagePath: string) {
  return getDocumentStorage().read(storagePath);
}
