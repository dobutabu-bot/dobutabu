import fs from "node:fs";

import PDFDocument from "pdfkit";

import {
  PDF_PAGE_MARGIN,
  drawPdfReportLayout,
  type PdfRegisteredFonts,
  type PdfReportInput,
  type PdfSummaryItem,
  type PdfTable,
  type PdfTone
} from "@/components/pdf";
import { contentDisposition } from "@/lib/document-storage";
import { dateInputValue } from "@/lib/utils";

export type { PdfReportInput, PdfSummaryItem, PdfTable, PdfTone };

export async function renderPdfReport(input: PdfReportInput): Promise<Buffer> {
  return renderPdfReportToBuffer(input);
}

export async function renderPdfReportToBuffer(input: PdfReportInput): Promise<Buffer> {
  const fontPaths = resolveFontPaths();
  const doc = new PDFDocument({
    size: "A4",
    margin: PDF_PAGE_MARGIN,
    bufferPages: true,
    autoFirstPage: true,
    font: fontPaths.regular,
    info: {
      Title: input.title,
      Author: input.firmName,
      Subject: input.subtitle ?? input.title
    }
  });
  const fonts = registerFonts(doc, fontPaths);
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawPdfReportLayout(doc, fonts, input);
  doc.end();

  const buffer = await done;
  assertValidPdfBuffer(buffer);
  return buffer;
}

export function renderPdfReportToStream(input: PdfReportInput): ReadableStream<Uint8Array> {
  const fontPaths = resolveFontPaths();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const doc = new PDFDocument({
        size: "A4",
        margin: PDF_PAGE_MARGIN,
        bufferPages: true,
        autoFirstPage: true,
        font: fontPaths.regular,
        info: {
          Title: input.title,
          Author: input.firmName,
          Subject: input.subtitle ?? input.title
        }
      });
      const fonts = registerFonts(doc, fontPaths);

      doc.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      doc.on("end", () => controller.close());
      doc.on("error", (error) => controller.error(error));

      drawPdfReportLayout(doc, fonts, input);
      doc.end();
    }
  });
}

export function pdfResponse(buffer: Buffer, filename: string) {
  assertValidPdfBuffer(buffer);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition(filename, "attachment"),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    }
  });
}

export function datedPdfFilename(prefix: string, date = new Date(), granularity: "day" | "month" = "day") {
  const stamp = dateInputValue(date).slice(0, granularity === "month" ? 7 : 10);
  return `${prefix}-${stamp}.pdf`;
}

function registerFonts(doc: PDFKit.PDFDocument, fontPaths: { regular: string; bold: string }): PdfRegisteredFonts {
  doc.registerFont("PdfRegular", fontPaths.regular);
  doc.registerFont("PdfBold", fontPaths.bold);
  return { regular: "PdfRegular", bold: "PdfBold" };
}

function resolveFontPaths() {
  const regularPath = firstExistingPath([
    process.env.PDF_FONT_PATH,
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
  ]);
  const boldPath = firstExistingPath([
    process.env.PDF_FONT_BOLD_PATH,
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    regularPath
  ]);

  if (!regularPath) {
    throw new Error("PDF fontu bulunamadı. Türkçe karakter desteği için PDF_FONT_PATH ile bir TTF font yolu tanımlayın.");
  }

  return { regular: regularPath, bold: boldPath ?? regularPath };
}

function firstExistingPath(paths: Array<string | undefined>) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

function assertValidPdfBuffer(buffer: Buffer) {
  if (buffer.length < 1_000 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("PDF çıktısı doğrulanamadı.");
  }
}
