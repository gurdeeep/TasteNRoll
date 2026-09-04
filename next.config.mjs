/** @type {import('next').NextConfig} */

// ---------------------------------------------------------------------------
// Content Security Policy
//
// Supabase Realtime opens a websocket and the REST client makes XHRs, so the
// project origin has to be allowed in connect-src. It is read from the same
// public env var the client already uses; if it is unset the directive simply
// omits it rather than falling back to a wildcard.
//
// 'unsafe-inline' is present for scripts and styles because this app renders
// plenty of inline `style={{...}}` and Next injects inline bootstrap/flight
// scripts. Removing it requires the per-request nonce flow from the Next docs
// (guides/content-security-policy), which forces dynamic rendering on every
// page - a deliberate trade-off, not an oversight. Even without nonces this
// policy still blocks script loading from any other origin, framing, plugin
// content, <base> hijacking and cross-origin form posts.
//
// There is no dangerouslySetInnerHTML anywhere in this app, so the DOM XSS
// sink CSP normally defends is already absent.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");

// Per the Next docs (guides/content-security-policy): React uses eval in
// development to rebuild server-side error stacks in the browser. Production
// needs no such allowance, so it does not get one.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // globals.css does @import url('https://fonts.googleapis.com/...') for
  // Fraunces/Outfit/Inter, and that stylesheet then pulls the actual font
  // files from fonts.gstatic.com. Both hosts have to be allowed or the whole
  // site silently falls back to system fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWs}` : ""}`,
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'", // the counter must not be framed by anyone
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-braces alongside frame-ancestors, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak an order id or ?next= path to a third-party site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Vercel serves HTTPS only; this stops the first plaintext hop.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  serverExternalPackages: ["pdfkit"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Every API response here is either a session check or someone's
        // order data. None of it should sit in a shared or browser cache.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
