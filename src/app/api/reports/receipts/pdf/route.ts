import { requireApiUser, unauthorized } from "@/lib/api";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";
import { buildReceiptsPdf } from "@/lib/pdf/receipt-pdf-report";
import { receiptFiltersFromSearchParams } from "@/lib/receipt-query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const report = await buildReceiptsPdf(
    user.id,
    receiptFiltersFromSearchParams(url.searchParams)
  );

  return renderBuiltPdfResponse(report);
}
