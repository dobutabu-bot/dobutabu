import { dateInputValue, formatDate, formatMoney, formatSignedMoney, toNumber } from "@/lib/utils";

export type SerializedMoney = {
  amount: number;
  currency: string;
  label: string;
  signedLabel: string;
  absoluteLabel: string;
};

export type SerializedDate = {
  iso: string | null;
  input: string;
  label: string;
  timestamp: number | null;
};

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue = SerializablePrimitive | SerializableValue[] | { [key: string]: SerializableValue };

export function serializeMoney(value: unknown, currency = "TRY"): SerializedMoney {
  const amount = toNumber(value);
  const normalizedCurrency = normalizeCurrency(currency);

  return {
    amount,
    currency: normalizedCurrency,
    label: formatMoney(amount, normalizedCurrency),
    signedLabel: formatSignedMoney(amount, normalizedCurrency),
    absoluteLabel: formatMoney(Math.abs(amount), normalizedCurrency)
  };
}

export function serializeDate(value: Date | string | number | null | undefined): SerializedDate {
  const date = normalizeDate(value);

  if (!date) {
    return {
      iso: null,
      input: "",
      label: "-",
      timestamp: null
    };
  }

  return {
    iso: date.toISOString(),
    input: dateInputValue(date),
    label: formatDate(date),
    timestamp: date.getTime()
  };
}

export function serializeEntity<T>(value: T): SerializableValue {
  return serializeValue(value, "$");
}

function serializeValue(value: unknown, path: string): SerializableValue {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Non-serializable value at ${path}`);
  }

  if (value instanceof Date) {
    return normalizeDate(value)?.toISOString() ?? null;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => serializeValue(item, `${path}[${index}]`));
  }

  if (isDecimalLike(value)) {
    return toNumber(value);
  }

  if (typeof value === "object") {
    const result: Record<string, SerializableValue> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        continue;
      }

      result[key] = serializeValue(entry, `${path}.${key}`);
    }

    return result;
  }

  return null;
}

function normalizeCurrency(currency: string) {
  const next = currency.trim().toUpperCase();
  return next || "TRY";
}

function normalizeDate(value: Date | string | number | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDecimalLike(value: unknown): value is { toNumber: () => number; toString: () => string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    toNumber?: unknown;
    toString?: unknown;
    d?: unknown;
    e?: unknown;
    s?: unknown;
    constructor?: { name?: string };
  };

  return (
    typeof candidate.toNumber === "function" &&
    typeof candidate.toString === "function" &&
    (candidate.constructor?.name === "Decimal" || ("d" in candidate && "e" in candidate && "s" in candidate))
  );
}
