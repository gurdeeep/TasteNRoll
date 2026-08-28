import { NextResponse } from "next/server";
import { requireOwner } from "../../../lib/auth";
import { signSupabaseRealtimeToken } from "../../../lib/jwt";

// Hands the signed-in owner a short-lived Supabase-compatible JWT so their
// browser can open the Realtime websocket on `orders`. The anon key on its own
// gets nothing - see the RLS policy in supabase/migrations/001_*.sql.
export async function GET() {
  const { session, error } = await requireOwner();
  if (error) return error;

  const token = await signSupabaseRealtimeToken(session.sub);

  if (!token) {
    // No SUPABASE_JWT_SECRET configured. Not fatal: the board polls instead.
    return NextResponse.json({ token: null, reason: "SUPABASE_JWT_SECRET not set" });
  }
  return NextResponse.json({ token });
}
