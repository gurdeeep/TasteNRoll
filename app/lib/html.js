// Escapes text before it is interpolated into an HTML string.
//
// The report emails are built by concatenating a plain-text report into an
// HTML template. Item names on an online order can contain customer-supplied
// text (add-on lines carry a name from the request body), so without this a
// customer could put markup or a phishing link into the owner's inbox.
//
// Kept dependency-free so it can be unit-tested outside Next.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
