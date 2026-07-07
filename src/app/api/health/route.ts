import { access } from "fs/promises";

import { documentStorageDirectory } from "@/lib/documents/local-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks = {
    app: true,
    database: false,
    documentStorage: false
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    await access(documentStorageDirectory());
    checks.documentStorage = true;
  } catch {
    checks.documentStorage = false;
  }

  const healthy = checks.app && checks.database && checks.documentStorage;

  return Response.json(
    {
      ok: healthy,
      checks
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
