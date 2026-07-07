import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

import { requireApiUser, unauthorized } from "@/lib/api";
import { withSensitiveDataHeaders } from "@/lib/security-headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const filePath = sqlitePath();

  if (!filePath || !existsSync(filePath)) {
    return Response.json({ message: "SQLite yedek dosyası bulunamadı. Veritabanı yolunu kontrol edin." }, { status: 404 });
  }

  const file = await readFile(filePath);
  return new Response(file, {
    headers: withSensitiveDataHeaders({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="hukuk-finans-${new Date()
        .toISOString()
        .slice(0, 10)}.db"`
    })
  });
}

function sqlitePath() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl?.startsWith("file:")) {
    return null;
  }

  const value = databaseUrl.replace("file:", "");

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(process.cwd(), "prisma", value);
}
