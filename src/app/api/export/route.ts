import { requireApiUser, unauthorized } from "@/lib/api";
import { buildExport } from "@/lib/export-data";
import { rowsToCsv, rowsToXls } from "@/lib/export";
import { exportFilename } from "@/lib/export-resources";
import { withSensitiveDataHeaders } from "@/lib/security-headers";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "summary";
  const requestedFormat = url.searchParams.get("format");
  const format = requestedFormat === "xls" ? "xls" : requestedFormat === "pdf" ? "pdf" : "csv";

  if (format === "pdf") {
    return Response.json(
      { message: "PDF export altyapısı ayrıldı. İlk sürümde CSV export aktiftir." },
      { status: 501 }
    );
  }

  const data = await buildExport(user.id, resource, url.searchParams);
  const filename = exportFilename(resource, format);
  const body =
    format === "xls"
      ? rowsToXls(data.headers, data.rows, data.title)
      : `\ufeff${rowsToCsv(data.headers, data.rows)}`;

  return new Response(body, {
    headers: withSensitiveDataHeaders({
      "Content-Type":
        format === "xls" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    })
  });
}
