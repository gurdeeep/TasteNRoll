import { NextResponse } from "next/server";
import { cookieNameFor, verifySession } from "./app/lib/jwt";

// ---------------------------------------------------------------------------
// Next 16 renamed the `middleware` convention to `proxy`, and proxy always runs
// on the Node.js runtime (the edge runtime is not supported here). That suits
// us — `jose` verifies the session before any protected page is rendered.
//
// This is a convenience layer, not the security boundary: it redirects humans
// to the right login screen. Every API route independently calls requireOwner()
// / requireCustomer(), so a request that somehow skips the proxy still fails.
// ---------------------------------------------------------------------------

// Owner-only surfaces. The POS, the money, the reports.
const OWNER_PATHS = ["/owner", "/api/owner", "/api/dashboard", "/api/report"];

// Customer-only surfaces.
const CUSTOMER_PATHS = ["/customer", "/api/customer"];

// Not redirected by the proxy: the entry gate, both logins, registration, and
// the auth endpoints themselves.
//
// /bill is here because it serves two audiences and so cannot be sent to one
// login screen. It is not open access: the page fetches /api/orders?id=..., and
// that route requires a session and scopes the query to the caller — the owner
// sees any bill, a customer only their own.
const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth", "/bill"];

const startsWith = (pathname, list) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

async function sessionFor(request, role) {
  const token = request.cookies.get(cookieNameFor(role))?.value;
  return verifySession(token, role);
}

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  if (startsWith(pathname, PUBLIC_PATHS)) return NextResponse.next();

  if (startsWith(pathname, OWNER_PATHS)) {
    const session = await sessionFor(request, "owner");
    if (session) return NextResponse.next();
    return deny(request, "/login/owner", pathname + search);
  }

  if (startsWith(pathname, CUSTOMER_PATHS)) {
    const session = await sessionFor(request, "customer");
    if (session) return NextResponse.next();
    return deny(request, "/login/customer", pathname + search);
  }

  return NextResponse.next();
}

// API calls get a 401 they can handle; page navigations get bounced to the
// login screen with `next` set, so the customer lands back where they were
// headed instead of on a generic home page.
function deny(request, loginPath, attempted) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not signed in", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(attempted)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next's own assets and static files; everything else is inspected.
  // Note the doubled backslashes: this is a JS string, so "\\." is what
  // reaches the regex engine as an escaped dot. A single "\." would collapse
  // to a plain "." and match any character.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|brand|items|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
