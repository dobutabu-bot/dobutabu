import { requireApiUser, unauthorized } from "@/lib/api";
import { buildAdvancesPdf, pdfFiltersFromSearchParams } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const report = await buildAdvancesPdf(user.id, pdfFiltersFromSearchParams(url.searchParams));

  return renderBuiltPdfResponse(report);
}
