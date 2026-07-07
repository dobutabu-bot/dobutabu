import { pdfResponse, renderPdfReportToBuffer, renderPdfReportToStream } from "@/lib/pdf/pdf-document";
import type { BuiltPdfReport } from "@/lib/pdf/pdf-report-data";
import { contentDisposition } from "@/lib/document-storage";

export async function renderBuiltPdfResponse(report: BuiltPdfReport) {
  const buffer = await renderPdfReportToBuffer(report.input);
  return pdfResponse(buffer, report.filename);
}

export function renderBuiltPdfStreamResponse(report: BuiltPdfReport) {
  return new Response(renderPdfReportToStream(report.input), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(report.filename, "attachment"),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    }
  });
}
