import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { findOwnedClient } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { caseInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, caseInputSchema);
    const client = await findOwnedClient(user.id, data.clientId);

    if (!client) {
      return Response.json({ message: "Seçilen müvekkil bulunamadı. Lütfen güncel listeden yeniden seçin." }, { status: 400 });
    }

    if (client.archivedAt || client.deletedAt) {
      return Response.json({ message: "Arşivdeki müvekkile yeni dosya bağlanamaz." }, { status: 400 });
    }

    const caseFile = await prisma.caseFile.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
        title: data.title,
        fileNumber: nullable(data.fileNumber),
        courtOrOffice: nullable(data.courtOrOffice),
        caseType: nullable(data.caseType),
        status: data.status,
        archivedAt: data.status === "ARCHIVED" ? new Date() : null,
        notes: nullable(data.notes)
      }
    });
    await writeAuditLog({
      entityType: "CASE_FILE",
      entityId: caseFile.id,
      action: data.status === "ARCHIVED" ? "ARCHIVE" : "CREATE",
      newValue: caseFile,
      message: data.status === "ARCHIVED" ? "Dosya arşivlendi" : "Dosya oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Dosya kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
