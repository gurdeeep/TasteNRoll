import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase";
import { requireCustomer } from "../../../../lib/auth";
import { validateUtr } from "../../../../lib/upi";
import { PAYMENT, FULFILLMENT } from "../../../../lib/orderStatus";

// Every query below is filtered on BOTH order_id and customer_id, so a signed-in
// customer typing someone else's order id gets a 404, not their order.
async function loadOwnOrder(supabase, orderId, customerId) {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();
  return data;
}

// GET /api/customer/orders/<orderId> — poll one order for live status.
export async function GET(req, { params }) {
  try {
    const { session, error: authError } = await requireCustomer();
    if (authError) return authError;

    const { orderId } = await params;
    const supabase = createServerClient();
    const order = await loadOwnOrder(supabase, orderId, session.sub);

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("Customer order fetch error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/customer/orders/<orderId> — "I have paid, here is the reference".
//
// This does NOT mark the order paid. A UPI intent link has no callback, so the
// only thing the customer can give us is the UTR their app displayed. That moves
// the order to 'submitted', which is what lights up the owner's popup. Only the
// owner, having checked their own UPI app, can move it to 'paid'.
// ---------------------------------------------------------------------------
export async function PATCH(req, { params }) {
  try {
    const { session, error: authError } = await requireCustomer();
    if (authError) return authError;

    const { orderId } = await params;
    const { utr, action } = await req.json();
    const supabase = createServerClient();

    const order = await loadOwnOrder(supabase, orderId, session.sub);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Cancelling is only allowed while nothing has been claimed as paid.
    if (action === "cancel") {
      if (order.payment_status !== PAYMENT.PENDING) {
        return NextResponse.json(
          { error: "This order can no longer be cancelled here. Please call the cafe." },
          { status: 409 }
        );
      }
      const { data, error } = await supabase
        .from("orders")
        .update({ order_status: FULFILLMENT.CANCELLED, payment_status: PAYMENT.REJECTED })
        .eq("order_id", orderId)
        .eq("customer_id", session.sub)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, order: data });
    }

    if (order.payment_status === PAYMENT.PAID) {
      return NextResponse.json({ error: "This order is already paid" }, { status: 409 });
    }
    if (order.order_status === FULFILLMENT.CANCELLED) {
      return NextResponse.json({ error: "This order was cancelled" }, { status: 409 });
    }

    const utrError = validateUtr(utr);
    if (utrError) return NextResponse.json({ error: utrError }, { status: 400 });

    const { data, error } = await supabase
      .from("orders")
      .update({
        transaction_id: String(utr).trim().toUpperCase(),
        payment_status: PAYMENT.SUBMITTED,
        order_status: FULFILLMENT.NEW,
        seen_by_owner: false, // re-arm the popup even on a corrected resubmit
      })
      .eq("order_id", orderId)
      .eq("customer_id", session.sub)
      .select()
      .single();

    if (error) {
      console.error("UTR submit error:", error);
      return NextResponse.json({ error: "Could not record your payment" }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err) {
    console.error("Customer order patch error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
