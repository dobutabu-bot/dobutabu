import { createHmac, timingSafeEqual } from "node:crypto";

import type { BackupMode } from "@/lib/backups/types";

export const BACKUP_TIMESTAMP_HEADER = "x-backup-timestamp";
export const BACKUP_SIGNATURE_HEADER = "x-backup-signature";
export const BACKUP_MODE_HEADER = "x-backup-mode";

const MAX_CLOCK_SKEW_SECONDS = 300;

export type BackupAuthResult =
  | { ok: true; mode: BackupMode }
  | { ok: false; status: 401 | 422; message: string };

export function verifyBackupRequest(
  request: Request,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): BackupAuthResult {
  const timestamp = request.headers.get(BACKUP_TIMESTAMP_HEADER);
  const signature = request.headers.get(BACKUP_SIGNATURE_HEADER);
  const modeValue = request.headers.get(BACKUP_MODE_HEADER) ?? "daily";

  if (!timestamp || !signature) {
    return { ok: false, status: 401, message: "Yedekleme imzası eksik." };
  }

  if (modeValue !== "daily" && modeValue !== "baseline") {
    return { ok: false, status: 422, message: "Yedekleme modu geçerli değil." };
  }

  if (!/^\d{10}$/.test(timestamp)) {
    return { ok: false, status: 401, message: "Yedekleme zaman damgası geçerli değil." };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 401, message: "Yedekleme isteğinin süresi dolmuş." };
  }

  const url = new URL(request.url);
  const expected = signBackupRequest({
    secret,
    timestamp,
    method: request.method,
    pathname: url.pathname,
    mode: modeValue
  });

  if (!safeEqualHex(signature, expected)) {
    return { ok: false, status: 401, message: "Yedekleme imzası doğrulanamadı." };
  }

  return { ok: true, mode: modeValue };
}

export function signBackupRequest({
  secret,
  timestamp,
  method,
  pathname,
  mode
}: {
  secret: string;
  timestamp: string;
  method: string;
  pathname: string;
  mode: BackupMode;
}) {
  const payload = `${timestamp}\n${method.toUpperCase()}\n${pathname}\n${mode}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
