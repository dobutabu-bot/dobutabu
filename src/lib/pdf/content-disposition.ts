const DEFAULT_PDF_FILE_NAME = "rapor.pdf";
const MAX_FILE_NAME_LENGTH = 160;

export function pdfFileNameFromContentDisposition(
  contentDisposition: string | null,
  fallback = DEFAULT_PDF_FILE_NAME
) {
  const encodedFileName = contentDisposition?.match(
    /(?:^|;)\s*filename\*\s*=\s*(?:(?:UTF-8|utf-8)'[^']*')?([^;]+)/i
  )?.[1];

  if (encodedFileName) {
    try {
      return sanitizePdfFileName(decodeURIComponent(stripQuotes(encodedFileName)));
    } catch {
      // A malformed filename* must not prevent an otherwise valid download.
    }
  }

  const asciiFileName = contentDisposition?.match(
    /(?:^|;)\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i
  )?.[1];

  return sanitizePdfFileName(asciiFileName ? unescapeQuotedFileName(asciiFileName) : fallback);
}

export function sanitizePdfFileName(value: string) {
  const normalized = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^[.\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH);
  const withName = normalized || DEFAULT_PDF_FILE_NAME;

  return withName.toLocaleLowerCase("tr-TR").endsWith(".pdf")
    ? withName
    : `${withName}.pdf`;
}

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function unescapeQuotedFileName(value: string) {
  return stripQuotes(value).replace(/\\(["\\])/g, "$1");
}
