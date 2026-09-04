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
