import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase";
import { requireCustomer } from "../../../lib/auth";
import { repriceCart } from "../../../lib/pricing";
import { makeTxnRef } from "../../../lib/upi";
import { PAYMENT, FULFILLMENT, ACCOUNTING, ORDER_TYPES } from "../../../lib/orderStatus";

// ---------------------------------------------------------------------------
// POST /api/customer/orders  — place an online order.
//
// The order is created UNPAID (payment_status 'pending'). The customer is then
// sent to the UPI screen. Nothing counts as revenue until the owner confirms
// the payment, so the legacy `status` column stays 'pending_online' and the
// dashboard leaves it out of the takings.
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const { session, error: authError } = await requireCustomer();
    if (authError) return authError;

    const body = await req.json();
    const { items: rawItems, orderType, tableNumber, note } = body;

    if (!ORDER_TYPES.includes(orderType)) {
      return NextResponse.json({ error: "Choose pickup or dine-in" }, { status: 400 });
    }

    const cleanTable =
      orderType === "dine-in" ? String(tableNumber ?? "").trim().slice(0, 10) : "";
    if (orderType === "dine-in" && !cleanTable) {
      return NextResponse.json({ error: "Enter your table number" }, { status: 400 });
    }

    // Prices come from the menu on this server, never from the request body.
    const { items, subtotal, error: priceError } = repriceCart(rawItems);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });

    // No discounts online. Discounts are a counter decision the staff make in
    // person, so an online order always pays the listed price.
    const total = subtotal;

    const supabase = createServerClient();

    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${todayIST}T00:00:00+05:30`)
      .lte("created_at", `${todayIST}T23:59:59+05:30`);

    const orderId = `RB-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_id: orderId,
        daily_order_number: (count || 0) + 1,
        customer_id: session.sub,
        customer_name: session.name,
        customer_phone: session.phone || "",
        items,
        subtotal,
        discount_applied: false,
        discount_percent: 0,
        discount_amount: 0,
        total_amount: total,
        payment_method: "UPI (Online)",
        cash_amount: 0,
        upi_amount: total,
        source: "online",
        order_type: orderType,
        table_number: cleanTable || null,
        customer_note: String(note ?? "").trim().slice(0, 200) || null,
        status: ACCOUNTING.PENDING_ONLINE,
        payment_status: PAYMENT.PENDING,
        order_status: FULFILLMENT.AWAITING_PAYMENT,
        upi_txn_ref: makeTxnRef(orderId),
        seen_by_owner: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Online order insert error:", error);
      return NextResponse.json({ error: "Could not place your order" }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId, order: data });
  } catch (err) {
    console.error("Customer order error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/customer/orders — this customer's own order history.
// Scoped by customer_id from the token, never by a query parameter, so one
// customer cannot read another one by guessing an id.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const { session, error: authError } = await requireCustomer();
    if (authError) return authError;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", session.sub)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Customer history error:", error);
      return NextResponse.json({ error: "Could not load your orders" }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: data || [] });
  } catch (err) {
    console.error("Customer history error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
