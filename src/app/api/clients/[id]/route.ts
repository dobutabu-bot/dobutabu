import { ZodError } from "zod";

import { nullable, parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { clientInputSchema } from "@/lib/validations";

type ClientRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ClientRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, clientInputSchema);

    const existing = await prisma.client.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });

    if (!existing) {
      return Response.json({ message: "Müvekkil bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
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
      entityId: updated.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
      message: "Müvekkil güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Müvekkil güncellenemedi" }, { status: 500 });
  }
}
