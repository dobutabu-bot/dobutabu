import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { documentUploadLimitSettingKey } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { documentSettingsInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, documentSettingsInputSchema);
    const oldSetting = await prisma.appSetting.findUnique({
      where: { userId_key: { userId: user.id, key: documentUploadLimitSettingKey } }
    });
    const setting = await prisma.appSetting.upsert({
      where: { userId_key: { userId: user.id, key: documentUploadLimitSettingKey } },
      update: { value: data.documentMaxUploadSizeMb },
      create: { userId: user.id, key: documentUploadLimitSettingKey, value: data.documentMaxUploadSizeMb }
    });

    await writeAuditLog({
      entityType: "SETTING",
      entityId: documentUploadLimitSettingKey,
      action: "UPDATE",
      oldValue: oldSetting,
      newValue: setting,
      message: "Belge yükleme limiti güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Belge ayarları kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
