import { z } from "zod";

import type { BackupConfig } from "@/lib/backups/types";

const configSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(3),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BACKUP_ENCRYPTION_KEY: z.string().min(40),
  BACKUP_HMAC_SECRET: z.string().min(32),
  R2_BACKUP_PREFIX: z.string().optional()
});

export function getBackupConfig(environment: NodeJS.ProcessEnv = process.env): BackupConfig {
  const values = configSchema.parse(environment);
  const encryptionKey = Buffer.from(values.R2_BACKUP_ENCRYPTION_KEY, "base64");

  if (encryptionKey.length !== 32) {
    throw new Error("R2_BACKUP_ENCRYPTION_KEY 32 byte base64 anahtar olmalıdır.");
  }

  const objectPrefix = sanitizePrefix(values.R2_BACKUP_PREFIX ?? "buro-finans");

  return {
    accountId: values.R2_ACCOUNT_ID,
    accessKeyId: values.R2_ACCESS_KEY_ID,
    secretAccessKey: values.R2_SECRET_ACCESS_KEY,
    bucketName: values.R2_BUCKET_NAME,
    endpoint: values.R2_ENDPOINT ?? `https://${values.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    encryptionKey,
    hmacSecret: values.BACKUP_HMAC_SECRET,
    objectPrefix
  };
}

function sanitizePrefix(value: string) {
  const normalized = value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-");

  if (!normalized || normalized.includes("..")) {
    throw new Error("R2_BACKUP_PREFIX güvenli değil.");
  }

  return normalized;
}
