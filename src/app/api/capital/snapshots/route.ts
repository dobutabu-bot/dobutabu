import { requireApiUser, unauthorized } from "@/lib/api";
import { createCapitalSnapshot } from "@/lib/capital/asset-service";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const currency = url.searchParams.get("currency") ?? "TRY";
  const snapshot = await createCapitalSnapshot(user.id, currency);

  return Response.json({ ok: true, snapshot });
}
