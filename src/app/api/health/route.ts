import fsPromises from "node:fs/promises";
import packageJson from "../../../../package.json";
import { documentStorageDirectory } from "@/lib/documents/local-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthStatus = "ok" | "warning" | "error";

export async function GET() {
  const [databaseStatus, storageStatus] = await Promise.all([
    checkDatabase(),
    checkStorage()
  ]);

  const appEnv = normalizeAppEnv();
  const databaseOk = databaseStatus === "ok";
  const storageOk = storageStatus !== "error";
  const status = getHttpStatus(databaseOk);

  const body = {
    ok: databaseOk && storageOk,
    app: "buro-finans-paneli",
    version: packageJson.releaseName ?? packageJson.version,
    env: appEnv,
    database: databaseStatus,
    storage: storageStatus,
    time: new Date().toISOString()
  };

  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function normalizeAppEnv() {
  const raw = (process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown").toLowerCase();

  if (raw === "dev") {
    return "development";
  }

  if (raw === "prod") {
    return "production";
  }

  if (["development", "staging", "production", "test"].includes(raw)) {
    return raw as "development" | "staging" | "production" | "test";
  }

  return "unknown";
}

async function checkDatabase(): Promise<HealthStatus> {
  try {
    const timeoutMs = 3000;
    const dbPromise = prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    const result = await Promise.race([dbPromise, databaseTimeout(timeoutMs)]);
    if (Array.isArray(result) && result.length > 0) {
      return "ok";
    }
  } catch {
    return "error";
  }

  return "error";
}

function databaseTimeout(timeoutMs: number) {
  return new Promise<null>((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });
}

async function checkStorage(): Promise<HealthStatus> {
  let storageDirectory: string;

  try {
    storageDirectory = documentStorageDirectory();
  } catch {
    return "error";
  }

  try {
    await fsPromises.access(storageDirectory);
  } catch {
    try {
      await fsPromises.mkdir(storageDirectory, { recursive: true });
    } catch {
      return "error";
    }
  }

  try {
    const canWrite = await checkStorageWritePermission(storageDirectory);
    return canWrite ? "ok" : "warning";
  } catch {
    return "warning";
  }
}

async function checkStorageWritePermission(directory: string) {
  const markerFile = `${directory}/.health-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;

  try {
    await fsPromises.writeFile(markerFile, "health");
    await fsPromises.unlink(markerFile);
    return true;
  } catch {
    return false;
  }
}

function getHttpStatus(databaseOk: boolean) {
  if (!databaseOk) {
    return 503;
  }

  return 200;
}
