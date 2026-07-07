import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CapitalAssetError, softDeleteAssetAccount, updateAssetAccount } from "@/lib/capital/asset-service";
import { assetAccountInputSchema } from "@/lib/validations";

type AssetRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: AssetRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await updateAssetAccount(user.id, id, await parseJson(request, assetAccountInputSchema));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CapitalAssetError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Varlık hesabı güncellenemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: AssetRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    await softDeleteAssetAccount(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CapitalAssetError) return Response.json({ message: error.message }, { status: 400 });
    return Response.json({ message: "Varlık hesabı silinemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
