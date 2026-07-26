export type BackupMode = "daily" | "baseline";

export type BackupTier = "daily" | "weekly" | "monthly" | "baseline";

export type BackupConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  encryptionKey: Buffer;
  hmacSecret: string;
  objectPrefix: string;
};

export type DocumentManifestEntry = {
  path: string;
  size: number;
  sha256: string;
};

export type BackupMetadata = {
  formatVersion: 1;
  backupId: string;
  createdAt: string;
  mode: BackupMode;
  database: {
    fileName: "database.sqlite";
    sha256: string;
    size: number;
    integrity: "ok";
    recordCounts: Record<string, number>;
  };
  documents: {
    directoryName: "documents";
    fileCount: number;
    totalBytes: number;
    manifestSha256: string;
  };
};

export type EncryptedBackupHeader = {
  format: "buro-finans-backup";
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  payloadSha256: string;
};

export type BackupVerification = {
  objectKey: string;
  encryptedSha256: string;
  databaseIntegrity: "ok";
  recordCountsMatch: true;
  documentManifestMatch: true;
  documentFileCount: number;
};

export type BackupRunResult = {
  backupId: string;
  createdAt: string;
  objectKeys: string[];
  verification: BackupVerification;
  retention: {
    deletedObjects: number;
  };
};
