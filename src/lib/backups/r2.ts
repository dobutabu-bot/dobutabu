import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type { BackupConfig } from "@/lib/backups/types";

export type BackupObject = {
  key: string;
  lastModified: Date | null;
  size: number;
};

export class R2BackupStore {
  private readonly client: S3Client;

  constructor(private readonly config: BackupConfig) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async putFile({
    key,
    filePath,
    metadata
  }: {
    key: string;
    filePath: string;
    metadata: Record<string, string>;
  }) {
    const fileStat = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: fileStat.size,
        ContentType: "application/octet-stream",
        CacheControl: "private, no-store",
        Metadata: metadata
      })
    );
  }

  async downloadFile(key: string, destinationPath: string) {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      })
    );

    if (!result.Body) {
      throw new Error("R2 yedek nesnesi boş döndü.");
    }

    const body = result.Body as typeof result.Body & {
      transformToWebStream?: () => ReadableStream<Uint8Array>;
    };
    const readable =
      body instanceof Readable
        ? body
        : body.transformToWebStream
          ? Readable.fromWeb(body.transformToWebStream() as never)
          : null;

    if (!readable) {
      throw new Error("R2 yedek nesnesi okunabilir akış sağlamadı.");
    }

    const { createWriteStream } = await import("node:fs");
    await pipeline(readable, createWriteStream(destinationPath, { flags: "wx", mode: 0o600 }));

    return {
      metadata: result.Metadata ?? {},
      contentLength: result.ContentLength ?? null
    };
  }

  async list(prefix: string) {
    const objects: BackupObject[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      );

      for (const item of result.Contents ?? []) {
        if (!item.Key) continue;
        objects.push({
          key: item.Key,
          lastModified: item.LastModified ?? null,
          size: item.Size ?? 0
        });
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      })
    );
  }

  destroy() {
    this.client.destroy();
  }
}
