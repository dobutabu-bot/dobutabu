export type OcrRecognitionInput = {
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
  language?: string;
  timeoutMs?: number;
};

export type OcrRecognitionResult = {
  status: "COMPLETED" | "FAILED";
  text: string | null;
  message: string;
  durationMs: number;
};

export type OcrAdapter = {
  readonly name: string;
  readonly supportedMimeTypes: readonly string[];
  recognize(input: OcrRecognitionInput): Promise<OcrRecognitionResult>;
};

type TesseractModule = {
  recognize?: (
    image: Buffer,
    language?: string,
    options?: Record<string, unknown>
  ) => Promise<{ data?: { text?: string } }>;
};

const supportedImageMimeTypes = ["image/png", "image/jpeg"] as const;
const defaultOcrLanguage = process.env.DOCUMENT_OCR_LANGUAGE || "tur+eng";
const defaultOcrTimeoutMs = Number(process.env.DOCUMENT_OCR_TIMEOUT_MS || 45_000);
const maxOcrTextLength = 120_000;

export const tesseractOcrAdapter: OcrAdapter = {
  name: "tesseract.js",
  supportedMimeTypes: supportedImageMimeTypes,
  async recognize(input) {
    const startedAt = Date.now();

    if (!isSupportedOcrImage(input.mimeType)) {
      return failed("OCR yalnızca PNG ve JPEG görseller için etkin.", startedAt);
    }

    const mockText = process.env.DOCUMENT_OCR_MOCK_TEXT;
    if (mockText && process.env.NODE_ENV !== "production") {
      const text = normalizeExtractedText(mockText);
      return {
        status: text ? "COMPLETED" : "FAILED",
        text: text || null,
        message: text ? `Test OCR metni alındı. ${formatCharacterCount(text.length)} karakter indekslendi.` : "Test OCR metni boş döndü.",
        durationMs: Date.now() - startedAt
      };
    }

    const tesseract = await loadTesseractModule();
    if (!tesseract?.recognize) {
      return failed("Tesseract.js kurulu değil veya OCR adapter'ı yüklenemedi. Manuel metadata girebilirsiniz.", startedAt);
    }

    try {
      const timeoutMs = normalizeTimeout(input.timeoutMs);
      const recognition = await withTimeout(
        tesseract.recognize(input.buffer, input.language || defaultOcrLanguage, {
          logger: undefined
        }),
        timeoutMs
      );
      const text = normalizeExtractedText(recognition.data?.text ?? "");

      if (!text) {
        return failed("Görselden anlamlı OCR metni çıkarılamadı. Manuel metadata girebilirsiniz.", startedAt);
      }

      return {
        status: "COMPLETED",
        text,
        message: `OCR tamamlandı. ${formatCharacterCount(text.length)} karakter arama için indekslendi.`,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      return failed(error instanceof OcrTimeoutError ? "OCR zaman aşımına uğradı. Daha küçük veya daha net bir görsel deneyebilirsiniz." : "OCR tamamlanamadı. Belge kaydı korundu; manuel metadata girilebilir.", startedAt);
    }
  }
};

export function isSupportedOcrImage(mimeType: string) {
  return supportedImageMimeTypes.includes(mimeType as (typeof supportedImageMimeTypes)[number]);
}

async function loadTesseractModule(): Promise<TesseractModule | null> {
  try {
    return (await import(/* webpackIgnore: true */ "tesseract.js")) as TesseractModule;
  } catch {
    return null;
  }
}

function normalizeTimeout(timeoutMs: number | undefined) {
  if (Number.isFinite(timeoutMs) && timeoutMs && timeoutMs > 0) {
    return timeoutMs;
  }

  return defaultOcrTimeoutMs;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new OcrTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    promise.catch(() => undefined);
  }
}

function failed(message: string, startedAt: number): OcrRecognitionResult {
  return {
    status: "FAILED",
    text: null,
    message,
    durationMs: Date.now() - startedAt
  };
}

function formatCharacterCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxOcrTextLength);
}

class OcrTimeoutError extends Error {
  constructor() {
    super("OCR timed out");
    this.name = "OcrTimeoutError";
  }
}
