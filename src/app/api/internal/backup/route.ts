import { randomUUID } from "node:crypto";

import { verifyBackupRequest } from "@/lib/backups/auth";
import { getBackupConfig } from "@/lib/backups/config";
import { BackupAlreadyRunningError, runR2Backup } from "@/lib/backups/service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 3;

export async function POST(request: Request) {
  const requestId = `BKP-${randomUUID().slice(0, 8).toUpperCase()}`;
  const config = readConfig();
  if (!config) {
    return safeJson(
      { ok: false, message: "Yedekleme servisi yapılandırılmamış.", requestId },
      503
    );
  }

  const auth = verifyBackupRequest(request, config.hmacSecret);
  if (!auth.ok) {
    return safeJson({ ok: false, message: auth.message, requestId }, auth.status);
  }

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "scheduler";
  const rateLimit = checkRateLimit(`internal-backup:${clientKey}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (rateLimit.limited) {
    return safeJson(
      { ok: false, message: "Yedekleme isteği geçici olarak sınırlandı.", requestId },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  try {
    const result = await runR2Backup(auth.mode);
    return safeJson({
      ok: true,
      backupId: result.backupId,
      createdAt: result.createdAt,
      copies: result.objectKeys.length,
      verification: {
        databaseIntegrity: result.verification.databaseIntegrity,
        recordCountsMatch: result.verification.recordCountsMatch,
        documentManifestMatch: result.verification.documentManifestMatch,
        documentFileCount: result.verification.documentFileCount
      },
      retention: result.retention,
      requestId
    });
  } catch (error) {
    if (error instanceof BackupAlreadyRunningError) {
      return safeJson({ ok: false, message: error.message, requestId }, 409);
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "error",
        event: "backup.request.failed",
        route: "/api/internal/backup",
        requestId,
        safeErrorCode: "BACKUP_FAILED"
      })
    );
    return safeJson(
      { ok: false, message: "Yedekleme tamamlanamadı. Daha sonra yeniden deneyin.", requestId },
      500
    );
  }
}

function readConfig() {
  try {
    return getBackupConfig();
  } catch {
    return null;
  }
}

function safeJson(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}
