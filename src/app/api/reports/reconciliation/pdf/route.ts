import { requireApiUser, unauthorized } from "@/lib/api";
import { buildV3ReconciliationPdf, pdfFiltersFromSearchParams } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const report = await buildV3ReconciliationPdf(user.id, pdfFiltersFromSearchParams(url.searchParams));

  return renderBuiltPdfResponse(report);
}
