import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { clientInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, clientInputSchema);

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: data.name,
        type: data.type,
        tcNo: nullable(data.tcNo),
        taxNo: nullable(data.taxNo),
        email: nullable(data.email),
        phone: nullable(data.phone),
        address: nullable(data.address),
        notes: nullable(data.notes)
      }
    });
    await writeAuditLog({
      entityType: "CLIENT",
      entityId: client.id,
      action: "CREATE",
      newValue: client,
      message: "Müvekkil oluşturuldu",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Müvekkil kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
