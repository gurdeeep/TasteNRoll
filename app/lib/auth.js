import { cookies } from "next/headers";
import { cookieNameFor, ttlFor, verifySession } from "./jwt";
import { createServerClient } from "./supabase";

export {
  OWNER_COOKIE,
  CUSTOMER_COOKIE,
  OWNER_TTL_SECONDS,
  CUSTOMER_TTL_SECONDS,
  cookieNameFor,
  ttlFor,
  signSession,
  verifySession,
  signSupabaseRealtimeToken,
} from "./jwt";

// ---------------------------------------------------------------------------
// Cookie helpers — Route Handlers and Server Components only.
// ---------------------------------------------------------------------------
const cookieOptions = (role) => ({
  httpOnly: true, // page JS cannot read it, so an XSS cannot steal the session
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // a cross-site POST cannot carry the session along
  path: "/",
  maxAge: ttlFor(role),
});

export async function setSessionCookie(token, role) {
  const jar = await cookies();
  jar.set(cookieNameFor(role), token, cookieOptions(role));
}

export async function clearSessionCookie(role) {
  const jar = await cookies();
  jar.set(cookieNameFor(role), "", { ...cookieOptions(role), maxAge: 0 });
}

// Reads and verifies the session for `role`. null when there is none.
export async function getSession(role) {
  const jar = await cookies();
  return verifySession(jar.get(cookieNameFor(role))?.value, role);
}

// ---------------------------------------------------------------------------
// Route-handler guards.
//
// The proxy already blocks unauthenticated navigation, but every API route
// calls these too. A proxy is not a security boundary on its own — a direct
// fetch to /api/... that never renders a page must still be rejected here.
// ---------------------------------------------------------------------------
export async function requireOwner() {
  const session = await getSession("owner");
  return session ? { session, error: null } : { session: null, error: unauthorized() };
}

// A signed JWT is normally unrevocable until it expires, and a customer token
// lasts a month. `token_version` closes that hole: the value is baked into the
// token as `tv`, and bumping customers.token_version in the database makes
// every token issued before the bump stop working on the next request.
//
// That costs one indexed primary-key lookup per call. Only the order endpoints
// use this guard, so the cheap read-only paths (/api/auth/me, fetching your own
// bill) are unaffected.
export async function requireCustomer() {
  const session = await getSession("customer");
  if (!session) return { session: null, error: unauthorized() };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("token_version")
    .eq("id", session.sub)
    .maybeSingle();

  // A deleted account, or a token from before the last bump, is no longer a
  // session. A database hiccup (error) is not treated as a revocation — that
  // would sign everyone out whenever Supabase blinked.
  if (!error && (!data || data.token_version !== session.tv)) {
    return { session: null, error: unauthorized() };
  }

  return { session, error: null };
}

function unauthorized() {
  return Response.json(
    { error: "Not signed in", code: "UNAUTHORIZED" },
    { status: 401 }
  );
}
