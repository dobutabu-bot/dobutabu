const secretMinLength = 32;

export function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.SESSION_SECRET;
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing: string[] = [];
  const authSecret = getAuthSecret();
  const appUrlValue = process.env.APP_URL;

  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!authSecret || authSecret.length < secretMinLength) missing.push("AUTH_SECRET veya SESSION_SECRET");
  if (!appUrlValue) missing.push("APP_URL");

  if (missing.length > 0) {
    throw new Error(`Production env eksik veya zayıf: ${missing.join(", ")}`);
  }

  if (!appUrlValue) {
    throw new Error("Production APP_URL eksik");
  }

  const appUrl = new URL(appUrlValue);

  if (appUrl.protocol !== "https:") {
    throw new Error("Production APP_URL HTTPS olmalı");
  }
}

export function getAppOrigin() {
  if (!process.env.APP_URL) {
    return null;
  }

  try {
    return new URL(process.env.APP_URL).origin;
  } catch {
    return null;
  }
}

export function buildAppUrl(path: string, requestUrl: string, appOrigin = getAppOrigin()) {
  return new URL(path, appOrigin || requestUrl);
}
