import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function resolveSqliteDatabasePath(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("R2 yedekleme yalnız SQLite file: DATABASE_URL ile çalışır.");
  }

  const configuredPath = databaseUrl.slice("file:".length);
  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), "prisma", configuredPath);

  if (!existsSync(resolvedPath)) {
    throw new Error("SQLite veritabanı bulunamadı.");
  }

  return resolvedPath;
}

export async function createConsistentSqliteSnapshot(sourcePath: string, destinationPath: string) {
  const escapedDestination = destinationPath.replaceAll("'", "''");
  await runSqlite(sourcePath, `PRAGMA busy_timeout=30000; VACUUM INTO '${escapedDestination}';`);
  const snapshotStat = await stat(destinationPath);

  if (!snapshotStat.isFile() || snapshotStat.size < 4096) {
    throw new Error("SQLite snapshot anlamlı bir dosya üretmedi.");
  }
}

export async function verifySqliteIntegrity(databasePath: string) {
  const rows = await queryJson(databasePath, "PRAGMA integrity_check;");
  const values = rows.flatMap((row) => Object.values(row).map(String));

  if (values.length !== 1 || values[0].toLowerCase() !== "ok") {
    throw new Error("SQLite integrity_check başarısız.");
  }

  return "ok" as const;
}

export async function readSqliteRecordCounts(databasePath: string) {
  const tableRows = await queryJson(
    databasePath,
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  const counts: Record<string, number> = {};

  for (const row of tableRows) {
    const tableName = String(row.name ?? "");
    if (!SAFE_TABLE_NAME.test(tableName)) {
      throw new Error("SQLite tablo adı güvenli değil.");
    }

    const countRows = await queryJson(databasePath, `SELECT COUNT(*) AS count FROM "${tableName}";`);
    const count = Number(countRows[0]?.count);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("SQLite kayıt sayımı doğrulanamadı.");
    }
    counts[tableName] = count;
  }

  return counts;
}

async function queryJson(databasePath: string, sql: string) {
  const { stdout } = await execFileAsync("sqlite3", ["-json", databasePath, sql], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000
  });

  if (!stdout.trim()) {
    return [] as Array<Record<string, unknown>>;
  }

  return JSON.parse(stdout) as Array<Record<string, unknown>>;
}

async function runSqlite(databasePath: string, sql: string) {
  await execFileAsync("sqlite3", [databasePath, sql], {
    maxBuffer: 1024 * 1024,
    timeout: 180_000
  });
}
