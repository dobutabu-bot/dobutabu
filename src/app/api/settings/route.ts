import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { getFirmSettings, setFirmSettings } from "@/lib/settings";
import { settingsInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const data = await parseJson(request, settingsInputSchema);
    const oldSettings = await getFirmSettings(user.id);
    const newSettings = {
      firmName: data.firmName,
      ownerName: data.ownerName,
      currency: data.currency.toUpperCase()
    };

    await setFirmSettings(user.id, newSettings);
    await writeAuditLog({
      entityType: "SETTING",
      entityId: "firm-settings",
      action: "UPDATE",
      oldValue: oldSettings,
      newValue: newSettings,
      message: "Ayarlar güncellendi",
      userId: user.id
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Ayarlar kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
