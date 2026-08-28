import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase";
import { requireOwner } from "../../../lib/auth";
import { FULFILLMENT } from "../../../lib/orderStatus";

// ---------------------------------------------------------------------------
// GET /api/owner/orders — the live online-order board.
//
// ?since=<ISO>  only orders touched after that moment. This is what the polling
//               fallback uses when Supabase Realtime is unavailable, so it does
//               not re-download the whole board every few seconds.
// ?all=1        include finished orders too (the board hides them by default).
// ---------------------------------------------------------------------------
const ACTIVE = [
  FULFILLMENT.AWAITING_PAYMENT,
  FULFILLMENT.NEW,
  FULFILLMENT.PREPARING,
  FULFILLMENT.READY,
];

export async function GET(req) {
  try {
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const all = searchParams.get("all") === "1";

    const supabase = createServerClient();
    let query = supabase
      .from("orders")
      .select("*")
      .eq("source", "online")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!all) query = query.in("order_status", ACTIVE);
    if (since) query = query.gt("created_at", since);

    const { data, error } = await query;

    if (error) {
      console.error("Owner board error:", error);
      return NextResponse.json({ error: "Could not load orders" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orders: data || [],
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Owner board error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
