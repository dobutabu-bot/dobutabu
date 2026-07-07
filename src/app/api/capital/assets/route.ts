import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CapitalAssetError, createAssetAccount } from "@/lib/capital/asset-service";
import { assetAccountInputSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    await createAssetAccount(user.id, await parseJson(request, assetAccountInputSchema));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CapitalAssetError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Varlık hesabı kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
