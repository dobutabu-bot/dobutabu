import { ZodError } from "zod";

import { parseJson, requireApiUser, unauthorized, validationError } from "@/lib/api";
import { CapitalAssetError, createAssetValuation } from "@/lib/capital/asset-service";
import { assetValuationInputSchema } from "@/lib/validations";

type AssetValuationRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: AssetValuationRouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const { id } = await context.params;
    const data = await parseJson(request, assetValuationInputSchema);
    await createAssetValuation(user.id, {
      assetAccountId: id,
      ...data,
      source: "MANUAL"
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CapitalAssetError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof ZodError) return validationError(error);
    return Response.json({ message: "Değer güncellemesi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
