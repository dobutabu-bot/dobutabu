import { requireApiUser, unauthorized } from "@/lib/api";
import { buildMonthlyFinancePdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";
import { reportFiltersFromSearchParams } from "@/lib/reporting";

export const runtime = "nodejs";

const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  for (const key of ["startDate", "endDate"] as const) {
    const value = url.searchParams.get(key);
    if (value && !isValidDateInput(value)) {
      return Response.json(
        { error: "Rapor tarih parametreleri geçerli değil." },
        { status: 422, headers: PRIVATE_JSON_HEADERS }
      );
    }
  }

  const report = await buildMonthlyFinancePdf(user.id, reportFiltersFromSearchParams(url.searchParams));

  return renderBuiltPdfResponse(report);
}
