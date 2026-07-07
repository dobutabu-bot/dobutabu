import { notFound } from "next/navigation";

import { requireApiUser, unauthorized } from "@/lib/api";
import { buildExpenseSummaryPdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

type ExpensePdfRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ExpensePdfRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const report = await buildExpenseSummaryPdf(user.id, id);

  if (!report) {
    notFound();
  }

  return renderBuiltPdfResponse(report);
}
