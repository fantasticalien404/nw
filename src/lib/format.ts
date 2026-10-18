// Display formatting shared by every dashboard. Values are plain numbers: no currency symbols (see STYLE.MD).

const NO_VALUE = "—";

const integerFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const percentFormats = new Map<string, Intl.NumberFormat>();
const monthYearFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const longMonthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const fullDateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function utcDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

export function formatInteger(value: number) {
  return integerFormat.format(value);
}

export function formatMoney(value: number | null) {
  return value === null ? NO_VALUE : integerFormat.format(value);
}

/** Formats a fraction (0.25 → "25%"). */
export function formatPercent(value: number | null, { digits = 0, signed = false } = {}) {
  if (value === null) return NO_VALUE;
  const key = `${digits}:${signed}`;
  let format = percentFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat("en-GB", {
      style: "percent",
      maximumFractionDigits: digits,
      ...(signed && { signDisplay: "always" as const }),
    });
    percentFormats.set(key, format);
  }
  return format.format(value);
}

/** Formats a value that is already in percent (12.34 → "12.3%"). */
export function formatPercentPoints(value: number | null) {
  return value === null ? NO_VALUE : `${value.toFixed(1)}%`;
}

/** Percentage tick for a fraction axis: 0.25 → "25%". */
export function formatAxisPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** Compact y-axis tick: 1 500 000 → "2m", -2 500 → "-3k". */
export function formatAxisValue(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  if (absolute >= 1_000_000) return `${sign}${Math.round(absolute / 1_000_000)}m`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${rounded}`;
}

/** "Jan-26", used for table column headers. */
export function formatMonthDash(date: string) {
  const value = utcDate(date);
  return `${monthFormat.format(value)}-${String(value.getUTCFullYear()).slice(-2)}`;
}

/** "Jan 26", used for chart axes and tooltips. */
export function formatMonthYear(date: string) {
  return monthYearFormat.format(utcDate(date));
}

/** "31 Jan 2026". */
export function formatFullDate(date: string) {
  return fullDateFormat.format(utcDate(date));
}

/** Full English month name for a two-digit month number ("03" → "March"). */
export function formatMonthName(month: string) {
  return longMonthFormat.format(utcDate(`2026-${month}-01`));
}
