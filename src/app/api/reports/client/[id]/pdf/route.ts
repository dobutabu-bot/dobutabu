import { requireApiUser, unauthorized } from "@/lib/api";
import { buildClientCurrentPdf } from "@/lib/pdf/pdf-report-data";
import { renderBuiltPdfResponse } from "@/lib/pdf/pdf-route";

export const runtime = "nodejs";

const PDF_RECORD_ID = /^[A-Za-z0-9_-]{8,128}$/;
const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

type ClientPdfRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ClientPdfRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!PDF_RECORD_ID.test(id)) {
    return Response.json(
      { error: "Geçersiz rapor kayıt kimliği." },
      { status: 400, headers: PRIVATE_JSON_HEADERS }
    );
  }

  const report = await buildClientCurrentPdf(user.id, id);

  if (!report) {
    return Response.json(
      { error: "Rapor kaydı bulunamadı." },
      { status: 404, headers: PRIVATE_JSON_HEADERS }
    );
  }

  return renderBuiltPdfResponse(report);
}
