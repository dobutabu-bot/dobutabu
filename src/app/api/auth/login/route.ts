import { NextResponse } from "next/server";

import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/production-env";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations";

const loginRateLimitWindowMs = 15 * 60 * 1000;
const loginRateLimitMaxAttempts = 8;

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const failUrl = buildAppUrl("/login?error=1", request.url);
  const emailValue = formData.get("email");
  const rateLimitKey = loginRateLimitKey(request, emailValue);
  const rateLimit = checkRateLimit(rateLimitKey, loginRateLimitMaxAttempts, loginRateLimitWindowMs);

  if (rateLimit.limited) {
    const response = NextResponse.redirect(failUrl, { status: 303 });
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  if (!parsed.success) {
    return NextResponse.redirect(failUrl, { status: 303 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() }
  });

  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.redirect(failUrl, { status: 303 });
  }

  clearRateLimit(rateLimitKey);

  const response = NextResponse.redirect(buildAppUrl("/dashboard", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
  return response;
}

function loginRateLimitKey(request: Request, email: FormDataEntryValue | null) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "unknown";

  return `login:${ip}:${normalizedEmail}`;
}
