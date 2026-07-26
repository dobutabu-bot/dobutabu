import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rename, rm, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import type { EncryptedBackupHeader } from "@/lib/backups/types";

const MAGIC = "BFPBK1:";
const MAX_HEADER_BYTES = 4096;

export async function encryptBackupFile({
  inputPath,
  outputPath,
  key
}: {
  inputPath: string;
  outputPath: string;
  key: Buffer;
}) {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertextPath = `${outputPath}.cipher`;

  try {
    await pipeline(createReadStream(inputPath), cipher, createWriteStream(ciphertextPath, { flags: "wx", mode: 0o600 }));
    const header: EncryptedBackupHeader = {
      format: "buro-finans-backup",
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      payloadSha256: await sha256File(inputPath)
    };
    const headerLine = `${MAGIC}${Buffer.from(JSON.stringify(header), "utf8").toString("base64")}\n`;
    const temporaryOutput = `${outputPath}.tmp`;

    await writeFile(temporaryOutput, headerLine, { flag: "wx", mode: 0o600 });
    await pipeline(createReadStream(ciphertextPath), createWriteStream(temporaryOutput, { flags: "a", mode: 0o600 }));
    await rename(temporaryOutput, outputPath);

    return {
      header,
      encryptedSha256: await sha256File(outputPath)
    };
  } finally {
    await rm(ciphertextPath, { force: true });
    await rm(`${outputPath}.tmp`, { force: true });
  }
}

export async function decryptBackupFile({
  inputPath,
  outputPath,
  key
}: {
  inputPath: string;
  outputPath: string;
  key: Buffer;
}) {
  assertKey(key);
  const { header, offset } = await readEncryptedHeader(inputPath);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.iv, "base64"));
  decipher.setAuthTag(Buffer.from(header.authTag, "base64"));

  await pipeline(
    createReadStream(inputPath, { start: offset }),
    decipher,
    createWriteStream(outputPath, { flags: "wx", mode: 0o600 })
  );

  const payloadSha256 = await sha256File(outputPath);
  if (payloadSha256 !== header.payloadSha256) {
    await rm(outputPath, { force: true });
    throw new Error("Şifresi çözülen yedek checksum doğrulamasını geçemedi.");
  }

  return header;
}

export async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function sha256Json(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readEncryptedHeader(filePath: string) {
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const newlineIndex = buffer.subarray(0, bytesRead).indexOf(0x0a);

    if (newlineIndex < 0) {
      throw new Error("Şifreli yedek başlığı bulunamadı.");
    }

    const line = buffer.subarray(0, newlineIndex).toString("utf8");
    if (!line.startsWith(MAGIC)) {
      throw new Error("Şifreli yedek biçimi desteklenmiyor.");
    }

    const parsed = JSON.parse(Buffer.from(line.slice(MAGIC.length), "base64").toString("utf8")) as EncryptedBackupHeader;
    validateHeader(parsed);
    return { header: parsed, offset: newlineIndex + 1 };
  } finally {
    await handle.close();
  }
}

function validateHeader(header: EncryptedBackupHeader) {
  if (
    header.format !== "buro-finans-backup" ||
    header.version !== 1 ||
    header.algorithm !== "aes-256-gcm" ||
    Buffer.from(header.iv, "base64").length !== 12 ||
    Buffer.from(header.authTag, "base64").length !== 16 ||
    !/^[a-f0-9]{64}$/.test(header.payloadSha256)
  ) {
    throw new Error("Şifreli yedek başlığı geçerli değil.");
  }
}

function assertKey(key: Buffer) {
  if (key.length !== 32) {
    throw new Error("AES-256-GCM için 32 byte anahtar gerekir.");
  }
}
