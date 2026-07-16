type ApiErrorPayload = {
  message?: unknown;
};

const statusMessages: Record<number, string> = {
  400: "Gönderilen istek geçerli değil.",
  401: "Oturum süreniz doldu. Yeniden giriş yapınız.",
  403: "Bu işlem için yetkiniz bulunmuyor.",
  404: "Kayıt bulunamadı veya daha önce kaldırılmış.",
  405: "Bu işlem yöntemi desteklenmiyor.",
  409: "Kayıt ilişkileri nedeniyle işlem tamamlanamadı.",
  422: "Gönderilen bilgiler geçerli değil.",
  500: "İşlem sırasında beklenmeyen hata oluştu."
};

export async function apiRequest(
  endpoint: string,
  init: RequestInit,
  fallbackMessage = "İşlem tamamlanamadı. Lütfen tekrar deneyin."
) {
  const response = await fetch(endpoint, {
    credentials: "same-origin",
    cache: "no-store",
    ...init
  });

  const payload = await readSafePayload(response);
  if (!response.ok) {
    throw new ClientApiError(
      response.status,
      safeServerMessage(payload?.message) ?? statusMessages[response.status] ?? fallbackMessage
    );
  }

  return { response, payload };
}

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export function clientErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ClientApiError) return error.message;
  return fallbackMessage;
}

async function readSafePayload(response: Response): Promise<ApiErrorPayload | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

function safeServerMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 240) return null;
  if (/stack|database_url|auth_secret|session_secret|bearer|token/i.test(normalized)) return null;
  return normalized;
}
