type RequestOriginInput = {
  origin: string;
  requestOrigin: string;
  appOrigin?: string | null;
  forwardedOrigin?: string | null;
  nodeEnv?: string;
};

export function isAllowedRequestOrigin({
  origin,
  requestOrigin,
  appOrigin,
  forwardedOrigin,
  nodeEnv = process.env.NODE_ENV
}: RequestOriginInput) {
  const allowedOrigins = new Set([requestOrigin, appOrigin, forwardedOrigin].filter(Boolean));
  if (allowedOrigins.has(origin)) return true;
  if (nodeEnv === "production") return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(requestOrigin);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const originPort = effectivePort(originUrl);
    const requestPort = effectivePort(requestUrl);
    return loopbackHosts.has(originUrl.hostname) && loopbackHosts.has(requestUrl.hostname) && originPort === requestPort;
  } catch {
    return false;
  }
}

function effectivePort(url: URL) {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}
