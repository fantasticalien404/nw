// Pure helpers shared by the tab parsers. No Google Sheets I/O here, so everything is testable with plain arrays.
import { serialToIsoDate } from "@/lib/dates";
import type { SheetRows } from "./client";

export function cellText(value: unknown) {
  return String(value ?? "").trim();
}

export function isBlankRow(row: unknown[]) {
  return row.every((value) => cellText(value) === "");
}

/** Upper-case ISO 4217 code; `DOL` is a legacy alias for `USD`. */
export function normalizeCurrency(value: unknown) {
  const currency = cellText(value).toUpperCase();
  return currency === "DOL" ? "USD" : currency;
}

export function isCurrencyCode(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

/** Lower-cased, trimmed header cells, so header matching is case-insensitive. */
export function normalizeHeaders(row: unknown[]) {
  return row.map((value) => cellText(value).toLowerCase());
}

export function hasHeaders(actual: string[], expected: string[]) {
  return actual.join("|") === expected.join("|");
}

/** `costants` tab: key in column A, value in column B. Keys are upper-cased; values are normalised as currencies. */
export function parseConstants(rows: SheetRows) {
  return new Map(rows.map(([key, value]) => [cellText(key).toUpperCase(), normalizeCurrency(value)]));
}

export function parseSheetDate(value: unknown, errorMessage: string) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) throw new Error(errorMessage);
  return serialToIsoDate(serial);
}
