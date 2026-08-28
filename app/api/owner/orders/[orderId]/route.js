import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase";
import { requireOwner } from "../../../../lib/auth";
import { PAYMENT, FULFILLMENT, ACCOUNTING } from "../../../../lib/orderStatus";

// ---------------------------------------------------------------------------
// PATCH /api/owner/orders/<orderId>
//
// The owner is the only party who can say money arrived. Confirming here is
// what flips the order into the takings: payment_status 'paid' AND the legacy
// `status` column to 'completed', which is what the dashboard, the daily report
// and the monthly report all count.
//
// Actions: confirm-payment | reject-payment | preparing | ready | complete
//          | cancel | seen
// ---------------------------------------------------------------------------
export async function PATCH(req, { params }) {
  try {
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { orderId } = await params;
    const { action } = await req.json();

    const supabase = createServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    let update;
    switch (action) {
      case "confirm-payment":
        if (order.payment_status === PAYMENT.PAID) {
          return NextResponse.json({ success: true, order }); // already done
        }
        update = {
          payment_status: PAYMENT.PAID,
          status: ACCOUNTING.COMPLETED, // now, and only now, it is revenue
          paid_at: new Date().toISOString(),
          order_status: FULFILLMENT.PREPARING,
          seen_by_owner: true,
        };
        break;

      case "reject-payment":
        update = {
          payment_status: PAYMENT.REJECTED,
          status: ACCOUNTING.PENDING_ONLINE,
          order_status: FULFILLMENT.AWAITING_PAYMENT,
          seen_by_owner: true,
        };
        break;

      case "preparing":
        update = { order_status: FULFILLMENT.PREPARING, seen_by_owner: true };
        break;

      case "ready":
        update = { order_status: FULFILLMENT.READY, seen_by_owner: true };
        break;

      case "complete":
        // Refuse to close out an order that was never actually paid for.
        if (order.payment_status !== PAYMENT.PAID) {
          return NextResponse.json(
            { error: "Confirm the payment before completing this order" },
            { status: 409 }
          );
        }
        update = { order_status: FULFILLMENT.COMPLETED, seen_by_owner: true };
        break;

      case "cancel":
        update = {
          order_status: FULFILLMENT.CANCELLED,
          status: ACCOUNTING.PENDING_ONLINE, // keeps it out of the takings
          payment_status:
            order.payment_status === PAYMENT.PAID ? PAYMENT.PAID : PAYMENT.REJECTED,
          seen_by_owner: true,
        };
        break;

      case "seen":
        // Popup acknowledged. Stops it reappearing on the next page load.
        update = { seen_by_owner: true };
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update(update)
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) {
      console.error("Owner order update error:", error);
      return NextResponse.json({ error: "Could not update the order" }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err) {
    console.error("Owner order patch error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
