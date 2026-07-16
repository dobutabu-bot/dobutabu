import { NextResponse, type NextRequest } from "next/server";

import { buildAppUrl, getAppOrigin, validateProductionEnvironment } from "@/lib/production-env";
import { isAllowedRequestOrigin, shouldEnforceHttpsForPath } from "@/lib/request-origin";
import { SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/install",
  "/api/health",
  "/api/auth/login",
  "/app.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/pwa-icons",
  "/offline.html",
  "/sw.js"
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let productionEnvValidated = false;

export function middleware(request: NextRequest) {
  const envErrorResponse = validateProductionRequestEnvironment();
  if (envErrorResponse) {
    return envErrorResponse;
  }

  const { pathname } = request.nextUrl;
  const httpsRedirect = shouldEnforceHttpsForPath(pathname) ? enforceHttps(request) : null;
  if (httpsRedirect) {
    return withSecurityHeaders(httpsRedirect);
  }

  const isPublic =
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next");

  if (MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return withSecurityHeaders(Response.json({ message: "İstek reddedildi" }, { status: 403 }));
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        Response.json(
          { message: "Oturum süresi dolmuş olabilir. Lütfen yeniden giriş yapın." },
          { status: 401 }
        )
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (pathname === "/login" && hasSession) {
    return withSecurityHeaders(NextResponse.redirect(buildAppUrl("/dashboard", request.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    const requestOrigins = getRequestOrigins(request);
    if (!isAllowedRequestOrigin({ origin, ...requestOrigins })) {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  return true;
}

function getRequestOrigins(request: NextRequest) {
  const appOrigin = getAppOrigin();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  let forwardedOrigin: string | null = null;

  if (host) {
    try {
      forwardedOrigin = new URL(`${protocol}://${host}`).origin;
    } catch {
      // An invalid Host header must never widen the origin allowlist.
    }
  }

  return { requestOrigin: request.nextUrl.origin, appOrigin, forwardedOrigin };
}

function withSecurityHeaders<TResponse extends Response>(response: TResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());

  if (isProductionHttps()) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

function validateProductionRequestEnvironment() {
  if (isPlaywrightE2E() || process.env.NODE_ENV !== "production" || productionEnvValidated) {
    return null;
  }

  try {
    validateProductionEnvironment();
    productionEnvValidated = true;
    return null;
  } catch {
    return withSecurityHeaders(
      Response.json(
        { message: "Production ortam değişkenleri eksik veya güvensiz yapılandırılmış." },
        { status: 500 }
      )
    );
  }
}

function enforceHttps(request: NextRequest) {
  if (isPlaywrightE2E() || process.env.NODE_ENV !== "production") {
    return null;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = request.nextUrl.protocol === "https:" || forwardedProto === "https";

  if (isHttps) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

function isProductionHttps() {
  return !isPlaywrightE2E() && process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://");
}

function isPlaywrightE2E() {
  return process.env.PLAYWRIGHT_E2E === "1";
}

function contentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join("; ");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
