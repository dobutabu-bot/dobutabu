import { requireApiUser, unauthorized } from "@/lib/api";
import { searchAll } from "@/lib/search/search-data";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").slice(0, 80);
  const data = await searchAll(user.id, query);

  return Response.json(data);
}
