import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (uses service role key for full access).
//
// This module is also imported by client code for createBrowserClient, so the
// guard below matters: Next strips non-NEXT_PUBLIC_ env values from client
// bundles (verified - the key does not appear in .next/static), which means a
// browser call would otherwise silently build a client with an undefined key
// instead of failing. Throw loudly rather than half-working.
export function createServerClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServerClient() is server-only and must not run in the browser.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Client-side Supabase client (uses anon key, respects RLS)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
