export const sensitiveDataHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Accept-Ranges": "none",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
} as const;

export function withSensitiveDataHeaders(headers: HeadersInit = {}) {
  return {
    ...headers,
    ...sensitiveDataHeaders
  };
}
