import { requireApiUser, unauthorized } from "@/lib/api";
import { buildCapitalPdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const report = await buildCapitalPdf(user.id);

  return renderBuiltPdfResponse(report);
}
