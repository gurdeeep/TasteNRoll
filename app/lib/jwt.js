import { SignJWT, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Pure token logic — no next/headers, no cookies. proxy.js imports this file,
// and proxy runs outside the request-context those APIs need.
//
// Cookie names are here rather than in auth.js so the proxy and the route
// handlers cannot drift on what the cookie is called.
// ---------------------------------------------------------------------------
export const OWNER_COOKIE = "rb_owner_session";
export const CUSTOMER_COOKIE = "rb_customer_session";

export const OWNER_TTL_SECONDS = 12 * 60 * 60; // one long shift
export const CUSTOMER_TTL_SECONDS = 30 * 24 * 60 * 60; // a month

const ISSUER = "rollbox";
const AUDIENCE = { owner: "rollbox:owner", customer: "rollbox:customer" };

export const cookieNameFor = (role) =>
  role === "owner" ? OWNER_COOKIE : CUSTOMER_COOKIE;

export const ttlFor = (role) =>
  role === "owner" ? OWNER_TTL_SECONDS : CUSTOMER_TTL_SECONDS;

function secret() {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    // Failing loudly beats silently signing everything with a guessable key.
    throw new Error(
      "JWT_SECRET is missing or shorter than 32 characters. Generate one with: node scripts/gen-secret.mjs"
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(payload, role) {
  return new SignJWT({ ...payload, role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE[role])
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(`${ttlFor(role)}s`)
    .sign(secret());
}

// Returns the claims, or null for anything wrong: bad signature, expired,
// wrong issuer, or — crucially — a token minted for the other role. A customer
// token presented to an owner route fails the audience check.
export async function verifySession(token, role) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE[role],
      algorithms: ["HS256"], // pin it: no "alg: none", no algorithm confusion
    });
    if (payload.role !== role) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase Realtime token
//
// The owner's browser subscribes to `orders` over a websocket using the public
// anon key. RLS on that table denies anon everything, so we hand the browser a
// short-lived JWT signed with Supabase's OWN secret carrying role=authenticated
// and rollbox_role=owner — exactly what the RLS policy in the migration checks.
// Anyone holding only the anon key still sees nothing.
// ---------------------------------------------------------------------------
export async function signSupabaseRealtimeToken(ownerSub) {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw) return null; // caller falls back to polling
  return new SignJWT({ role: "authenticated", rollbox_role: "owner" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(ownerSub))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(raw));
}
