import { createHash } from "crypto";

export function hashBuffer(buffer: Buffer | Uint8Array) {
  return createHash("sha256").update(buffer).digest("hex");
}
