import { createServerClient } from "./supabase";

// ---------------------------------------------------------------------------
// Brute-force throttle.
//
// Vercel functions do not share memory between invocations, so an in-process
// Map would reset every cold start and protect nothing. Counters live in the
// `auth_throttle` table instead, keyed by whatever we want to limit — an IP,
// a phone number, or both at once.
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000; // attempts older than this are forgiven
const LOCKOUT_MS = 15 * 60 * 1000; // how long a key stays locked once tripped

// The client IP as reported by Vercel's edge. Falls back to a constant in local
// dev, where the header is absent — which simply makes the limiter global.
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

// Returns { allowed, retryAfterSeconds }. Call BEFORE checking the password.
export async function checkThrottle(key, limit) {
  const supabase = createServerClient();
  const now = Date.now();

  const { data } = await supabase
    .from("auth_throttle")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (!data) return { allowed: true, retryAfterSeconds: 0 };

  if (data.locked_until && new Date(data.locked_until).getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (new Date(data.locked_until).getTime() - now) / 1000
      ),
    };
  }

  // Window expired, or lockout served: treat as a clean slate.
  const windowAge = now - new Date(data.window_start).getTime();
  if (windowAge > WINDOW_MS) return { allowed: true, retryAfterSeconds: 0 };

  if (data.attempts >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// Call after a failed attempt. Locks the key once `limit` is reached.
export async function recordFailure(key, limit) {
  const supabase = createServerClient();
  const now = Date.now();

  const { data } = await supabase
    .from("auth_throttle")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  const windowExpired =
    !data || now - new Date(data.window_start).getTime() > WINDOW_MS;

  const attempts = windowExpired ? 1 : data.attempts + 1;
  const windowStart = windowExpired
    ? new Date(now).toISOString()
    : data.window_start;

  await supabase.from("auth_throttle").upsert(
    {
      key,
      attempts,
      window_start: windowStart,
      locked_until:
        attempts >= limit ? new Date(now + LOCKOUT_MS).toISOString() : null,
    },
    { onConflict: "key" }
  );
}

// Call after a successful login so an honest user who fat-fingered their
// password twice does not carry the strikes forward.
export async function clearThrottle(key) {
  const supabase = createServerClient();
  await supabase.from("auth_throttle").delete().eq("key", key);
}
