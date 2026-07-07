import { ZodError, type z } from "zod";

import { getCurrentUser } from "@/lib/auth";

export async function requireApiUser() {
  return getCurrentUser();
}

export function unauthorized() {
  return Response.json({ message: "Oturum süresi dolmuş olabilir. Lütfen yeniden giriş yapın." }, { status: 401 });
}

export function validationError(error: ZodError) {
  return Response.json(
    {
      message: "Formdaki eksik veya hatalı alanları kontrol edin.",
      errors: error.flatten().fieldErrors
    },
    { status: 422 }
  );
}

export async function parseJson<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ZodError([]);
  }

  const payload = await request.json();
  return schema.parse(payload);
}

export function nullable(value: string | undefined | null) {
  return value || null;
}

export function dateOrNull(value: string | undefined | null) {
  return value ? new Date(value) : null;
}
