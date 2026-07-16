import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { buildAppUrl } from "@/lib/production-env";

export async function POST(request: Request) {
  const response = NextResponse.redirect(buildAppUrl("/login", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://") !== false,
    path: "/",
    maxAge: 0
  });
  return response;
}
