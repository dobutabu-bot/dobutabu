export type PdfTone = "neutral" | "green" | "rose" | "amber" | "blue";

export type PdfSummaryItem = {
  label: string;
  value: string;
  tone?: PdfTone;
};

export type PdfTable = {
  title: string;
  headers: string[];
  rows: Array<Record<string, string> | string[]>;
};

export type PdfReportInput = {
  title: string;
  subtitle?: string;
  firmName: string;
  ownerName?: string;
  reportDate: string;
  period?: string;
  summaries?: PdfSummaryItem[];
  tables?: PdfTable[];
  notes?: string[];
};

export type PdfRegisteredFonts = {
  regular: string;
  bold: string;
};

export const PDF_PAGE_MARGIN = 42;
const NAVY = "#0b1220";
const INK = "#172033";
const MUTED = "#64748b";
const BORDER = "#d8dee8";
const SOFT = "#f5f7fb";
const TONE_COLORS: Record<PdfTone, string> = {
  neutral: "#334155",
  green: "#047857",
  rose: "#be123c",
  amber: "#b45309",
  blue: "#1d4ed8"
};

export function drawPdfReportLayout(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, input: PdfReportInput) {
  drawPdfReportHeader(doc, fonts, input);

  if (input.summaries?.length) {
    drawPdfSummaryGrid(doc, fonts, input.summaries);
  }

  if (input.notes?.length) {
    drawPdfNotes(doc, fonts, input.notes);
  }

  for (const table of input.tables ?? []) {
    drawPdfTable(doc, fonts, table);
  }

  drawPdfFooters(doc, fonts);
}

export function drawPdfReportHeader(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, input: PdfReportInput) {
  const width = pdfContentWidth(doc);
  const startY = doc.y;
  doc.roundedRect(PDF_PAGE_MARGIN, startY, width, 118, 20).fill(NAVY);
  doc
    .font(fonts.bold)
    .fontSize(21)
    .fillColor("#ffffff")
    .text(pdfSafeText(input.title), PDF_PAGE_MARGIN + 22, startY + 24, { width: width - 44 });

  if (input.subtitle) {
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor("#cbd5e1")
      .text(pdfSafeText(input.subtitle), PDF_PAGE_MARGIN + 22, startY + 54, { width: width - 44, lineGap: 2 });
  }

  const meta = [
    input.firmName,
    input.ownerName ? `Sorumlu: ${input.ownerName}` : "",
    `Rapor tarihi: ${input.reportDate}`,
    input.period ? `Dönem: ${input.period}` : ""
  ].filter(Boolean);

  doc.font(fonts.regular).fontSize(8.5).fillColor("#e2e8f0").text(pdfSafeText(meta.join("  |  ")), PDF_PAGE_MARGIN + 22, startY + 92, {
    width: width - 44
  });
  doc.y = startY + 140;
}

export function drawPdfSummaryGrid(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, summaries: PdfSummaryItem[]) {
  const gap = 10;
  const columns = 3;
  const cardWidth = (pdfContentWidth(doc) - gap * (columns - 1)) / columns;
  const cardHeight = 62;

  summaries.forEach((item, index) => {
    if (index % columns === 0) {
      ensurePdfSpace(doc, cardHeight + 14);
    }

    const column = index % columns;
    const x = PDF_PAGE_MARGIN + column * (cardWidth + gap);
    const y = doc.y;
    const tone = item.tone ?? "neutral";
    doc.roundedRect(x, y, cardWidth, cardHeight, 14).fillAndStroke("#ffffff", BORDER);
    doc.rect(x, y, 4, cardHeight).fill(TONE_COLORS[tone]);
    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(pdfSafeText(item.label.toUpperCase()), x + 13, y + 12, { width: cardWidth - 22, ellipsis: true });
    doc
      .font(fonts.bold)
      .fontSize(12.5)
      .fillColor(TONE_COLORS[tone])
      .text(pdfSafeText(item.value), x + 13, y + 32, { width: cardWidth - 22, ellipsis: true });

    if (column === columns - 1 || index === summaries.length - 1) {
      doc.y = y + cardHeight + 14;
    }
  });
}

export function drawPdfNotes(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, notes: string[]) {
  ensurePdfSpace(doc, 58);
  const y = doc.y;
  doc.roundedRect(PDF_PAGE_MARGIN, y, pdfContentWidth(doc), 42 + notes.length * 12, 14).fillAndStroke("#f8fafc", BORDER);
  doc.font(fonts.bold).fontSize(9).fillColor(INK).text("Notlar", PDF_PAGE_MARGIN + 14, y + 12);
  doc.font(fonts.regular).fontSize(8.5).fillColor(MUTED);
  notes.forEach((note, index) => {
    doc.text(pdfSafeText(`- ${note}`), PDF_PAGE_MARGIN + 14, y + 28 + index * 12, { width: pdfContentWidth(doc) - 28 });
  });
  doc.y = y + 54 + notes.length * 12;
}

export function drawPdfTable(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, table: PdfTable) {
  const rows = table.rows.map((row) => normalizePdfRow(table.headers, row));
  ensurePdfSpace(doc, 64);
  doc.moveDown(0.6);
  doc.font(fonts.bold).fontSize(12).fillColor(INK).text(pdfSafeText(table.title), PDF_PAGE_MARGIN, doc.y, { width: pdfContentWidth(doc) });
  doc.moveDown(0.5);

  if (rows.length === 0) {
    const y = doc.y;
    doc.roundedRect(PDF_PAGE_MARGIN, y, pdfContentWidth(doc), 44, 12).fillAndStroke(SOFT, BORDER);
    doc.font(fonts.regular).fontSize(8.5).fillColor(MUTED).text("Bu bölümde gösterilecek kayıt yok.", PDF_PAGE_MARGIN + 14, y + 16);
    doc.y = y + 58;
    return;
  }

  const headers = compactPdfHeaders(table.headers);
  const widths = pdfColumnWidths(doc, headers.length);
  drawPdfTableHeader(doc, fonts, headers, widths);

  for (const row of rows) {
    const rowHeight = pdfTableRowHeight(doc, fonts, headers, row, widths);
    ensurePdfSpace(doc, rowHeight + 2, () => drawPdfTableHeader(doc, fonts, headers, widths));
    drawPdfTableRow(doc, fonts, headers, row, widths, rowHeight);
  }

  doc.moveDown(0.8);
}

export function drawPdfTableHeader(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts, headers: string[], widths: number[]) {
  const y = doc.y;
  let x = PDF_PAGE_MARGIN;
  doc.roundedRect(PDF_PAGE_MARGIN, y, pdfContentWidth(doc), 24, 8).fill("#e8edf5");
  headers.forEach((header, index) => {
    doc
      .font(fonts.bold)
      .fontSize(headers.length > 5 ? 6.7 : 7.4)
      .fillColor(INK)
      .text(pdfSafeText(header), x + 5, y + 8, { width: widths[index] - 10, height: 12, ellipsis: true });
    x += widths[index];
  });
  doc.y = y + 24;
}

export function drawPdfFooters(doc: PDFKit.PDFDocument, fonts: PdfRegisteredFonts) {
  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const footerY = doc.page.height - PDF_PAGE_MARGIN + 8;
    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text("Bu rapor sistem kayıtlarına göre oluşturulmuştur.", PDF_PAGE_MARGIN, footerY, { width: pdfContentWidth(doc) / 2 });
    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(`Sayfa ${pageIndex + 1 - range.start}/${range.count}`, PDF_PAGE_MARGIN, footerY, {
        width: pdfContentWidth(doc),
        align: "right"
      });
  }
}

export function ensurePdfSpace(doc: PDFKit.PDFDocument, requiredHeight: number, afterPageBreak?: () => void) {
  if (doc.y + requiredHeight <= doc.page.height - PDF_PAGE_MARGIN - 28) {
    return;
  }

  doc.addPage();
  doc.y = PDF_PAGE_MARGIN;
  afterPageBreak?.();
}

export function pdfContentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - PDF_PAGE_MARGIN * 2;
}

function drawPdfTableRow(
  doc: PDFKit.PDFDocument,
  fonts: PdfRegisteredFonts,
  headers: string[],
  row: Record<string, string>,
  widths: number[],
  rowHeight: number
) {
  const y = doc.y;
  let x = PDF_PAGE_MARGIN;
  doc.rect(PDF_PAGE_MARGIN, y, pdfContentWidth(doc), rowHeight).fill("#ffffff");
  doc
    .moveTo(PDF_PAGE_MARGIN, y + rowHeight)
    .lineTo(PDF_PAGE_MARGIN + pdfContentWidth(doc), y + rowHeight)
    .strokeColor("#e5eaf1")
    .lineWidth(0.7)
    .stroke();

  headers.forEach((header, index) => {
    const value = pdfSafeText(row[header] ?? "");
    const tone = value.trim().startsWith("-") ? "rose" : value.trim().startsWith("+") ? "green" : "neutral";
    doc
      .font(fonts.regular)
      .fontSize(headers.length > 5 ? 6.7 : 7.4)
      .fillColor(tone === "neutral" ? INK : TONE_COLORS[tone])
      .text(value, x + 5, y + 8, { width: widths[index] - 10, height: rowHeight - 12, ellipsis: true });
    x += widths[index];
  });

  doc.y = y + rowHeight;
}

function pdfTableRowHeight(
  doc: PDFKit.PDFDocument,
  fonts: PdfRegisteredFonts,
  headers: string[],
  row: Record<string, string>,
  widths: number[]
) {
  doc.font(fonts.regular).fontSize(headers.length > 5 ? 6.7 : 7.4);
  const textHeights = headers.map((header, index) =>
    doc.heightOfString(pdfSafeText(row[header] ?? ""), {
      width: widths[index] - 10,
      lineGap: 1
    })
  );

  return Math.min(Math.max(32, Math.ceil(Math.max(...textHeights)) + 16), 58);
}

function pdfSafeText(value: string) {
  return value.replace(/([+-]?)₺\s*/g, "$1TL ");
}

function compactPdfHeaders(headers: string[]) {
  return headers.length <= 7 ? headers : headers.slice(0, 7);
}

function normalizePdfRow(headers: string[], row: Record<string, string> | string[]) {
  if (Array.isArray(row)) {
    return headers.reduce<Record<string, string>>((current, header, index) => {
      current[header] = row[index] ?? "";
      return current;
    }, {});
  }

  return row;
}

function pdfColumnWidths(doc: PDFKit.PDFDocument, count: number) {
  const width = pdfContentWidth(doc);
  const firstColumnBoost = count > 3 ? 1.35 : 1;
  const units = firstColumnBoost + Math.max(count - 1, 0);
  const base = width / units;

  return Array.from({ length: count }, (_, index) => (index === 0 ? base * firstColumnBoost : base));
}
