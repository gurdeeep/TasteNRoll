// Regression tests for the security review fixes.
//   node scripts/test-security.mjs
//
// These cover the authorisation and input-trust boundaries that the review
// changed. They are deliberately dependency-free so `npm test` stays instant.

import { readFileSync } from "node:fs";
import { repriceCart } from "../app/lib/pricing.js";
import { escapeHtml } from "../app/lib/html.js";

let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`pass  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
section("Cron endpoints fail closed (C-1 / H-1)");
// ---------------------------------------------------------------------------
const cronAuthSrc = readFileSync(new URL("../app/lib/cronAuth.js", import.meta.url), "utf8");
const dailySrc = readFileSync(new URL("../app/api/cron/daily-report/route.js", import.meta.url), "utf8");
const monthlySrc = readFileSync(new URL("../app/api/cron/monthly-report/route.js", import.meta.url), "utf8");

check(
  "no route still skips the check when CRON_SECRET is unset",
  !dailySrc.includes("cronSecret &&") && !monthlySrc.includes("cronSecret &&")
);
check("daily report is guarded by authoriseCron", dailySrc.includes("authoriseCron(req)"));
check("monthly report is guarded by authoriseCron", monthlySrc.includes("authoriseCron(req)"));
check(
  "a missing CRON_SECRET returns 503 rather than allowing the call",
  /if \(!cronSecret\)/.test(cronAuthSrc) && cronAuthSrc.includes("status: 503")
);
check("secrets are compared in constant time", cronAuthSrc.includes("timingSafeEqual"));

// ---------------------------------------------------------------------------
section("No internal error details leak to clients (M-2)");
// ---------------------------------------------------------------------------
for (const [name, src] of [["daily", dailySrc], ["monthly", monthlySrc]]) {
  check(
    `${name} report does not return raw error text`,
    !/details:\s*\w+\.message/.test(src) && !src.includes("details: emailResult")
  );
}

// ---------------------------------------------------------------------------
section("Order pricing is server-authoritative (verified, unchanged)");
// ---------------------------------------------------------------------------
// A client sending its own price must not be believed.
const tampered = repriceCart([{ id: "vr7", variant: "full", price: 1, qty: 1, name: "Free Roll" }]);
check("client-supplied price is discarded", tampered.items[0].price === 150);
check("client-supplied name is replaced from the menu", tampered.items[0].name === "Paneer Roll");
check("subtotal is computed from menu prices", tampered.subtotal === 150);

check(
  "unknown item id is rejected",
  repriceCart([{ id: "not-a-real-item", variant: "full", qty: 1 }]).error !== null
);
check(
  "variant the category does not sell is rejected",
  repriceCart([{ id: "bg1", variant: "half", qty: 1 }]).error !== null
);
for (const bad of [0, -3, 1.5, 999, "abc", null, undefined, {}, [], NaN, Infinity]) {
  check(
    `quantity ${JSON.stringify(bad) ?? String(bad)} is rejected`,
    repriceCart([{ id: "vr7", variant: "full", qty: bad }]).error !== null
  );
}
// A numeric string is coerced rather than rejected. That is safe: the value
// stored is the coerced Number, so nothing string-typed reaches the database.
const coerced = repriceCart([{ id: "vr7", variant: "full", qty: "2" }]);
check("numeric string quantity is coerced to a number", coerced.items[0].qty === 2);
check("coerced quantity is typed as number", typeof coerced.items[0].qty === "number");
check("empty cart is rejected", repriceCart([]).error !== null);
check("non-array body is rejected", repriceCart(null).error !== null);

// ---------------------------------------------------------------------------
section("Add-on names cannot carry markup (M-3)");
// ---------------------------------------------------------------------------
// "ao4" is a real general add-on, so this line prices successfully and the
// attacker-controlled name is the only thing they influence.
const addon = repriceCart([
  { id: "vr7-ao4", variant: "add-on", qty: 1, name: '<img src=x onerror=alert(1)>' },
]);
check("add-on line is accepted at the menu price", addon.error === null && addon.items[0].price === 20);
check(
  "markup characters are stripped from the stored name",
  !/[<>&"'`]/.test(addon.items[0].name)
);
check(
  "a name made only of markup falls back to a safe label",
  repriceCart([{ id: "vr7-ao4", variant: "add-on", qty: 1, name: "<<>>" }]).items[0].name === "Add-on"
);
check(
  "escapeHtml neutralises the report-email sink",
  escapeHtml('<b>x</b>&"\'') === "&lt;b&gt;x&lt;/b&gt;&amp;&quot;&#39;"
);

// ---------------------------------------------------------------------------
section("Post-login redirect is same-site only (L-2)");
// ---------------------------------------------------------------------------
// Mirrors the guard used by both login pages.
const sameSiteOnly = /^\/(?![/\\])/;
for (const good of ["/menu", "/owner/live", "/customer/orders?tab=1"]) {
  check(`allows same-site path ${good}`, sameSiteOnly.test(good));
}
for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com"]) {
  check(`blocks ${JSON.stringify(bad)}`, !sameSiteOnly.test(bad));
}

for (const page of ["../app/login/owner/page.js", "../app/login/customer/page.js"]) {
  const src = readFileSync(new URL(page, import.meta.url), "utf8");
  check(`${page.split("/").slice(-2).join("/")} uses the hardened guard`, src.includes("(?![/\\\\])"));
}

// ---------------------------------------------------------------------------
section("Server-only Supabase client cannot run in a browser (L-3)");
// ---------------------------------------------------------------------------
const supaSrc = readFileSync(new URL("../app/lib/supabase.js", import.meta.url), "utf8");
check(
  "createServerClient throws if window exists",
  supaSrc.includes('typeof window !== "undefined"')
);

// ---------------------------------------------------------------------------
section("Proxy matcher escapes literal dots (L-4)");
// ---------------------------------------------------------------------------
const proxySrc = readFileSync(new URL("../proxy.js", import.meta.url), "utf8");
const matcherLine = proxySrc.split("\n").find((l) => l.includes("matcher:"));
check("matcher source contains a doubled backslash", matcherLine.includes("\\\\."));

// Rebuild the pattern exactly as Next would see it and confirm a path that
// merely resembles an asset is still inspected.
const pattern = matcherLine.slice(matcherLine.indexOf('["') + 2, matcherLine.lastIndexOf('"]'));
const compiled = new RegExp(`^${JSON.parse(`"${pattern.replace(/"/g, '\\"')}"`)}$`);
check("real asset path is skipped", !compiled.test("/favicon.ico"));
check("look-alike path is still inspected", compiled.test("/faviconXico"));
check("protected page is inspected", compiled.test("/owner/live"));
check("protected api is inspected", compiled.test("/api/owner/orders"));

// ---------------------------------------------------------------------------
section("Security headers are configured (M-4)");
// ---------------------------------------------------------------------------
const cfg = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
for (const header of [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
]) {
  check(`${header} is set`, cfg.includes(header));
}
check("frame-ancestors is locked down", cfg.includes("frame-ancestors 'none'"));
check("API responses are marked no-store", cfg.includes("no-store"));

// ---------------------------------------------------------------------------
section("Dashboard passcode gate remains safe and render-stable");
// ---------------------------------------------------------------------------
const dashboardPageSrc = readFileSync(
  new URL("../app/owner/dashboard/page.js", import.meta.url),
  "utf8"
);
const dashboardAuthSrc = readFileSync(
  new URL("../app/api/auth/dashboard/route.js", import.meta.url),
  "utf8"
);
check(
  "dashboard gate renders only after hooks are declared",
  dashboardPageSrc.indexOf('if (!authenticated) {\n    return') >
    dashboardPageSrc.indexOf("useEffect(() =>")
);
check(
  "dashboard data waits until the passcode is accepted",
  dashboardPageSrc.includes("if (!authenticated) return;")
);
check(
  "dashboard passcode endpoint requires an owner session",
  dashboardAuthSrc.includes("await requireOwner()")
);
check(
  "dashboard passcode has no shared fallback value",
  !dashboardAuthSrc.includes('|| "1234"')
);
check(
  "dashboard passcode comparison is timing safe",
  dashboardAuthSrc.includes("timingSafeEqual")
);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
console.log("All security checks passed.");
