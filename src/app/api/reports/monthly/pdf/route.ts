import { requireApiUser, unauthorized } from "@/lib/api";
import { buildMonthlyFinancePdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";
import { reportFiltersFromSearchParams } from "@/lib/reporting";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const report = await buildMonthlyFinancePdf(user.id, reportFiltersFromSearchParams(url.searchParams));

  return renderBuiltPdfResponse(report);
}
