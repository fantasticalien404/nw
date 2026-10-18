// Pure helpers for ISO calendar dates (YYYY-MM-DD). Every date is a UTC calendar day, never local time.

const DAY_MS = 86_400_000;

function parse(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function format(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** True for a real calendar date written as YYYY-MM-DD. Date inputs can hold partial or 5-digit years while typing. */
export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parse(value);
  // The round trip rejects days that Date silently rolls over, such as February 30.
  return !Number.isNaN(date.getTime()) && format(date) === value;
}

export function today() {
  return format(new Date());
}

export function addDays(date: string, days: number) {
  const value = parse(date);
  value.setUTCDate(value.getUTCDate() + days);
  return format(value);
}

export function nextDay(date: string) {
  return addDays(date, 1);
}

/** First day of the month containing `date`, shifted by `monthOffset` months. */
export function monthStart(date: string, monthOffset = 0) {
  const value = parse(date);
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + monthOffset);
  return format(value);
}

/** First days of every month from the month of `start` through the month of `end`, inclusive. Empty for invalid dates. */
export function monthStarts(start: string, end: string) {
  const months: string[] = [];
  if (!isIsoDate(start) || !isIsoDate(end)) return months;
  const last = monthStart(end);
  for (let month = monthStart(start); month <= last; month = monthStart(month, 1)) months.push(month);
  return months;
}

/** Whole calendar months from `start` to `end`, ignoring the day of the month. */
export function monthsBetween(start: string, end: string) {
  const from = parse(start);
  const to = parse(end);
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
}

export function daysBetween(start: string, end: string) {
  return (parse(end).getTime() - parse(start).getTime()) / DAY_MS;
}

/** Every day from `start` through `end`, inclusive. Empty for invalid dates. */
export function eachDay(start: string, end: string) {
  const days: string[] = [];
  if (!isIsoDate(start) || !isIsoDate(end)) return days;
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Google Sheets serial day number (1899-12-30 epoch) to an ISO date. */
export function serialToIsoDate(serial: number) {
  return format(new Date(Date.UTC(1899, 11, 30) + serial * DAY_MS));
}
