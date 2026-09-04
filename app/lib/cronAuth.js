import { timingSafeEqual } from "node:crypto";
import { getSession } from "./auth";

// ---------------------------------------------------------------------------
// Authorisation for the scheduled report endpoints.
//
// These endpoints return the day's takings and trigger outbound email/WhatsApp,
// so they must never be open. The previous check was `if (cronSecret && ...)`,
// which meant a MISSING CRON_SECRET disabled the check entirely and left the
// route world-readable. This one fails closed: no secret configured, no access.
//
// Two ways in:
//   * Vercel Cron  — sends `Authorization: Bearer <CRON_SECRET>`.
//   * The owner    — already signed in at the counter, so a signed-in owner
//                    session is accepted and they never need to put the secret
//                    in a URL.
// ---------------------------------------------------------------------------

function safeEquals(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Returns null when the caller may proceed, or a Response to return as-is.
export async function authoriseCron(req) {
  // A signed-in owner can always run their own report by hand.
  const owner = await getSession("owner");
  if (owner) return null;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail closed. An unconfigured secret used to mean "let everyone in".
    console.error("CRON_SECRET is not set - report endpoints are disabled.");
    return Response.json(
      { error: "Report endpoint is not configured on this server." },
      { status: 503 }
    );
  }

  const header = req.headers.get("authorization");
  if (header && safeEquals(header, `Bearer ${cronSecret}`)) return null;

  // `?secret=` is still accepted so an existing bookmark keeps working, but a
  // secret in a URL ends up in Vercel access logs, browser history and Referer
  // headers. Prefer the header, or just sign in as the owner.
  const querySecret = new URL(req.url).searchParams.get("secret");
  if (querySecret && safeEquals(querySecret, cronSecret)) return null;

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
