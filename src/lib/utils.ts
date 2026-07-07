import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const TURKEY_TIME_ZONE = "Europe/Istanbul";
const TURKEY_UTC_OFFSET = "+03:00";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: unknown) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    return parseNumberString(value);
  }

  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    const next = value.toNumber();
    return Number.isFinite(next) ? next : 0;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export function formatMoney(value: unknown, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toNumber(value));
}

export function formatSignedMoney(value: unknown, currency = "TRY") {
  const numericValue = toNumber(value);

  if (numericValue === 0) {
    return formatMoney(0, currency);
  }

  const sign = numericValue > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(numericValue), currency)}`;
}

export function formatDirectionalMoney(value: unknown, direction: "IN" | "OUT" | "NEUTRAL", currency = "TRY") {
  const absoluteValue = Math.abs(toNumber(value));

  if (direction === "IN") {
    return formatSignedMoney(absoluteValue, currency);
  }

  if (direction === "OUT") {
    return formatSignedMoney(-absoluteValue, currency);
  }

  return formatMoney(absoluteValue, currency);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TURKEY_TIME_ZONE
  }).format(new Date(value));
}

export function dateInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TURKEY_TIME_ZONE
  }).formatToParts(value);
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00${TURKEY_UTC_OFFSET}`);
}

export function endOfDateInput(value: string) {
  return new Date(`${value}T23:59:59.999${TURKEY_UTC_OFFSET}`);
}

export function startOfDay(date = new Date()) {
  return new Date(`${dateInputValue(date)}T00:00:00${TURKEY_UTC_OFFSET}`);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfMonth(date = new Date()) {
  const [year, month] = dateInputValue(date).split("-");
  return new Date(`${year}-${month}-01T00:00:00${TURKEY_UTC_OFFSET}`);
}

export function startOfYear(date = new Date()) {
  const [year] = dateInputValue(date).split("-");
  return new Date(`${year}-01-01T00:00:00${TURKEY_UTC_OFFSET}`);
}

export function addMonths(date: Date, amount: number) {
  const [year, month] = dateInputValue(date).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + amount, 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");

  return new Date(`${nextYear}-${nextMonth}-01T00:00:00${TURKEY_UTC_OFFSET}`);
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: TURKEY_TIME_ZONE }).format(date);
}

function parseNumberString(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return 0;
  }

  const normalized = cleanValue.replace(/\s/g, "").replace(/[^\d,.\-+]/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let decimalValue = normalized;

  if (lastComma > -1 && lastDot > -1) {
    decimalValue = lastComma > lastDot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (lastComma > -1) {
    decimalValue = normalized.replace(",", ".");
  } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    decimalValue = normalized.replace(/\./g, "");
  }

  const parsed = Number(decimalValue);
  return Number.isFinite(parsed) ? parsed : 0;
}
