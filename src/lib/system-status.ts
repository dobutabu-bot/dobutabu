import { access, readdir, stat } from "fs/promises";
import path from "path";

import packageJson from "../../package.json";

import { documentStorageDirectory } from "@/lib/documents/local-storage";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  applied_steps_count: number | bigint | null;
};

export type SystemHealthSummary = {
  ok: boolean;
  database: boolean;
  storage: boolean;
  version: string;
  time: string;
};

export type SystemStatusData = {
  version: string;
  releaseName: string;
  environment: string;
  health: SystemHealthSummary;
  migration: {
    name: string;
    appliedAt: string;
    appliedSteps: string;
    ok: boolean;
  };
  counts: {
    clients: number;
    incomes: number;
    expenses: number;
    documents: number;
    unmatchedBankRows: number;
    missingFinancialDocuments: number;
  };
  storage: {
    ok: boolean;
    usedBytes: number | null;
    usedLabel: string;
  };
  backup: {
    lastBackupAt: string;
    ok: boolean;
  };
  bankImport: {
    lastImportAt: string;
    lastImportLabel: string;
    ok: boolean;
  };
  pwa: {
    manifest: boolean;
    serviceWorker: boolean;
  };
  limitations: string[];
};

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const [database, storage] = await Promise.all([checkDatabase(), checkDocumentStorage()]);

  return {
    ok: database && storage,
    database,
    storage,
    version: packageJson.version,
    time: new Date().toISOString()
  };
}

export async function getSystemStatusData(userId: string): Promise<SystemStatusData> {
  const [
    health,
    migration,
    clients,
    incomes,
    expenses,
    documents,
    storageUsedBytes,
    lastBackupDate,
    lastBankImport,
    unmatchedBankRows,
    missingFinancialDocuments,
    pwa
  ] = await Promise.all([
    getSystemHealthSummary(),
    getLastMigration(),
    prisma.client.count({ where: { userId, deletedAt: null, archivedAt: null } }),
    prisma.income.count({ where: { userId, deletedAt: null } }),
    prisma.expense.count({ where: { userId, deletedAt: null } }),
    prisma.document.count({ where: { userId, deletedAt: null } }),
    getDocumentStorageSize(),
    getLastBackupDate(),
    prisma.bankStatementImport.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { bankName: true, status: true, createdAt: true }
    }),
    prisma.bankStatementRow.count({
      where: {
        userId,
        deletedAt: null,
        status: "SUCCESS",
        matchType: { in: ["NONE", "SUGGESTED"] }
      }
    }),
    getMissingFinancialDocumentCount(userId),
    getPwaStatus()
  ]);

  return {
    version: packageJson.version,
    releaseName: packageJson.releaseName ?? "V3-RC1",
    environment: process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    health,
    migration,
    counts: {
      clients,
      incomes,
      expenses,
      documents,
      unmatchedBankRows,
      missingFinancialDocuments
    },
    storage: {
      ok: health.storage,
      usedBytes: storageUsedBytes,
      usedLabel: storageUsedBytes == null ? "Hesaplanamadı" : formatBytes(storageUsedBytes)
    },
    backup: {
      lastBackupAt: lastBackupDate ? formatDate(lastBackupDate) : "Kayıt yok",
      ok: Boolean(lastBackupDate)
    },
    bankImport: {
      lastImportAt: lastBankImport ? formatDate(lastBankImport.createdAt) : "Kayıt yok",
      lastImportLabel: lastBankImport ? `${lastBankImport.bankName} · ${lastBankImport.status}` : "Henüz banka import kaydı yok",
      ok: Boolean(lastBankImport)
    },
    pwa,
    limitations: knownLimitations()
  };
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkDocumentStorage() {
  try {
    await access(documentStorageDirectory());
    return true;
  } catch {
    return false;
  }
}

async function getLastMigration() {
  try {
    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, applied_steps_count
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    const row = rows[0];

    if (!row) {
      return { name: "Migration kaydı yok", appliedAt: "-", appliedSteps: "-", ok: false };
    }

    return {
      name: row.migration_name,
      appliedAt: row.finished_at ? formatDate(row.finished_at) : "Tamamlanmamış",
      appliedSteps: row.applied_steps_count == null ? "-" : String(row.applied_steps_count),
      ok: Boolean(row.finished_at)
    };
  } catch {
    return { name: "Migration bilgisi okunamadı", appliedAt: "-", appliedSteps: "-", ok: false };
  }
}

async function getMissingFinancialDocumentCount(userId: string) {
  const [incomes, expenses, cashLedgerEntries, invoiceOrReceipts] = await Promise.all([
    prisma.income.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } }
      }
    }),
    prisma.expense.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } }
      }
    }),
    prisma.cashLedgerEntry.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        entryType: { not: "OPENING_BALANCE" },
        incomeId: null,
        expenseId: null,
        attachedDocuments: { none: { deletedAt: null } }
      }
    }),
    prisma.invoiceOrReceipt.count({
      where: {
        userId,
        deletedAt: null,
        documentNotRequired: false,
        attachedDocuments: { none: { deletedAt: null } }
      }
    })
  ]);

  return incomes + expenses + cashLedgerEntries + invoiceOrReceipts;
}

async function getDocumentStorageSize() {
  try {
    return await directorySize(documentStorageDirectory());
  } catch {
    return null;
  }
}

async function directorySize(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        return directorySize(entryPath);
      }

      return entryStat.isFile() ? entryStat.size : 0;
    })
  );

  return sizes.reduce((total, size) => total + size, 0);
}

async function getLastBackupDate() {
  const backupDirs = [
    process.env.BACKUP_DIR,
    path.join(process.cwd(), "backups")
  ].filter(Boolean) as string[];

  for (const directory of backupDirs) {
    const latest = await newestEntryDate(directory);
    if (latest) {
      return latest;
    }
  }

  return null;
}

async function newestEntryDate(directory: string) {
  try {
    const entries = await readdir(directory);
    const dates = await Promise.all(
      entries.map(async (entry) => {
        try {
          const entryStat = await stat(path.join(directory, entry));
          return entryStat.mtime;
        } catch {
          return null;
        }
      })
    );
    const validDates = dates.filter((date): date is Date => Boolean(date));

    return validDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  } catch {
    return null;
  }
}

async function getPwaStatus() {
  const [manifest, serviceWorker] = await Promise.all([
    fileExists(path.join(process.cwd(), "public", "app.webmanifest")),
    fileExists(path.join(process.cwd(), "public", "sw.js"))
  ]);

  return { manifest, serviceWorker };
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(value: number) {
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** unitIndex;

  return `${scaled.toLocaleString("tr-TR", { maximumFractionDigits: unitIndex === 0 ? 0 : 1 })} ${units[unitIndex]}`;
}

export function knownLimitations() {
  return [
    "Sistem resmi e-SMM/e-Fatura kesmez; makbuz/fatura ekranı yalnızca takip ve raporlama içindir.",
    "GİB entegrasyonu yoktur; resmi işlemler yetkili GİB/e-belge sistemlerinden ayrıca yapılmalıdır.",
    "Paraşüt, Logo ve Mikro entegrasyonu yoktur; ilk sürüm manuel kayıt, import/export ve raporlama odaklıdır.",
    "Banka API bağlantısı yoktur; banka hareketleri dosya yükleme ile analiz edilir.",
    "Banka ekstresi için CSV/XLSX formatı önerilir; kolon eşleme ve duplicate kontrolü bu dosyalarda daha güvenilirdir.",
    "Banka PDF import, banka formatları değişken olduğu için düşük güvenli fallback olarak sunulur.",
    "Taranmış PDF OCR aktif değilse sistem belgeyi otomatik okuyamayabilir; kullanıcı manuel metadata girebilir.",
    "Canlı borsa, crypto, döviz veya altın fiyatı çekilmez; sermaye değerleri kullanıcı tarafından manuel güncellenir.",
    "Sermaye ekranı yatırım tavsiyesi vermez; yalnızca kişisel/mesleki varlık takibi ve kayıt amacıyla kullanılır.",
    "Offline veri yazma garanti edilmez; PWA çevrim dışı kabuk ve temel uyarı sağlar.",
    "Production kullanım için HTTPS, güçlü kullanıcı şifresi, güçlü AUTH_SECRET/SESSION_SECRET, persistent storage ve düzenli backup gerekir."
  ];
}
