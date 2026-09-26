// Dates for a cafe that trades in one timezone.
//
// The shop's day runs on IST, but Vercel's functions run on UTC. Anything that
// buckets orders into a day — the daily order number, the dashboard's date
// filter, the nightly report — has to ask what day it is *in Sampla*, not on
// the server. Getting this wrong silently moves the evening's takings into
// tomorrow's report.
//
// This was written inline in ten places before. One copy now, with the reason
// attached to it.

const IST = "Asia/Kolkata";

// A sortable YYYY-MM-DD key for the IST day a moment falls in.
//
// "en-CA" is not a stylistic choice: it is the locale whose short date format
// is ISO-ordered, which is what makes these keys safe to compare with < and >
// and to hand to an <input type="date">.
export function istDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}

// "07:45 PM" — the time an order was taken.
export function formatTimeIST(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// "31 Aug 2026" — used where the row could be from any date.
export function formatDateIST(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "31 Aug" — the unpaid tabs list drops the year, because an unpaid tab is
// always recent and the extra characters cost a line wrap on a phone.
export function formatShortDateIST(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
  });
}

// "Saturday, 26 September 2026" — the heading of a single-day sales report.
export function formatLongDateIST(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// The heading of a sales report, which may cover one day or a span of them.
// Both arguments are YYYY-MM-DD day keys as produced by istDateKey().
export function formatRangeLabelIST(startKey, endKey) {
  if (startKey === endKey) return formatLongDateIST(startKey);

  // Day keys are ISO-ordered, so this subtraction is safe without parsing.
  const days =
    Math.round((new Date(endKey) - new Date(startKey)) / 86400000) + 1;
  return `${formatDateIST(startKey)} – ${formatDateIST(endKey)} (${days} days)`;
}

// The IST instant a day key starts and ends at. India has no daylight saving,
// so the +05:30 offset is correct year-round and Postgres can do the filtering
// itself rather than the server pulling every row and comparing in JS.
export function istDayStart(dayKey) {
  return `${dayKey}T00:00:00+05:30`;
}

export function istDayEnd(dayKey) {
  return `${dayKey}T23:59:59.999+05:30`;
}

// Validates a day key arriving from a query string before it reaches a database
// filter. Returns the key, or null for anything that is not a real calendar
// date — including values like "2026-02-31", which look right but are not.
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDayKey(value) {
  if (typeof value !== "string" || !DAY_KEY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Round-trips only if the date exists; JS rolls 02-31 forward to 03-03.
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}
