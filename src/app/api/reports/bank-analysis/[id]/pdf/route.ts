import { requireApiUser, unauthorized } from "@/lib/api";
import { buildBankAnalysisPdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

type BankAnalysisPdfRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: BankAnalysisPdfRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const report = await buildBankAnalysisPdf(user.id, id);

  return renderBuiltPdfResponse(report);
}
