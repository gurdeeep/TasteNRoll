import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { requireOwner, getSession } from "../../lib/auth";
import { istDateKey } from "../../lib/datetime";

// This is the POS endpoint: creating, editing and deleting orders at the
// counter. Every method is owner-only. The proxy already redirects browsers,
// but a proxy is not a security boundary - a direct fetch has to fail here too.

export async function POST(req) {
  try {
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { customer, items, total, paymentMethod, subtotal, discountPercent, discountAmount, cashAmount, upiAmount } = await req.json();

    if (!customer?.name) {
      return NextResponse.json({ error: "Missing customer name" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in order" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Calculate daily order number (resets each day)
    const todayIST = istDateKey();
    const startOfDay = `${todayIST}T00:00:00+05:30`;
    const endOfDay = `${todayIST}T23:59:59+05:30`;

    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    const dailyOrderNumber = (count || 0) + 1;
    const orderId = `RB-${Date.now().toString(36).toUpperCase()}`;

    // Determine status based on payment method
    const isUnpaid = paymentMethod === "Unpaid";

    const { data, error } = await supabase.from("orders").insert({
      order_id: orderId,
      daily_order_number: dailyOrderNumber,
      customer_name: customer.name,
      customer_phone: customer.phone || "",
      items: items,
      subtotal: subtotal || total,
      discount_applied: (discountPercent || 0) > 0,
      discount_percent: discountPercent || 0,
      discount_amount: discountAmount || 0,
      total_amount: total,
      payment_method: isUnpaid ? "Unpaid" : paymentMethod,
      status: isUnpaid ? "unpaid" : "completed",
      cash_amount: cashAmount || 0,
      upi_amount: upiAmount || 0,
    }).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId, dailyOrderNumber, order: data });
  } catch (err) {
    console.error("Order API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("id");
    const status = searchParams.get("status");

    // Reading orders needs a session. The owner sees any order; a customer
    // sees only their own, which is what makes /bill/<id> safe to link to
    // without the id itself being a secret.
    const [owner, customer] = await Promise.all([
      getSession("owner"),
      getSession("customer"),
    ]);
    if (!owner && !customer) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = createServerClient();

    // List orders by status (e.g. unpaid) - counter view, owner only
    if (status) {
      if (!owner) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
      }
      return NextResponse.json({ success: true, orders: data || [] });
    }

    // Single order by ID
    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    let query = supabase.from("orders").select("*").eq("order_id", orderId);
    // Scoping the query itself (rather than filtering after) means a customer
    // guessing another order id gets a plain 404, leaking nothing.
    if (!owner) query = query.eq("customer_id", customer.sub);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err) {
    console.error("Order fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { orderId, items, total, subtotal, discountPercent, discountAmount, paymentMethod, status, cashAmount, upiAmount } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Build update object
    const updateData = {};
    if (items !== undefined) updateData.items = items;
    if (total !== undefined) updateData.total_amount = total;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (discountPercent !== undefined) {
      updateData.discount_applied = discountPercent > 0;
      updateData.discount_percent = discountPercent;
    }
    if (discountAmount !== undefined) updateData.discount_amount = discountAmount;
    if (paymentMethod !== undefined) updateData.payment_method = paymentMethod;
    if (status !== undefined) updateData.status = status;
    if (cashAmount !== undefined) updateData.cash_amount = cashAmount;
    if (upiAmount !== undefined) updateData.upi_amount = upiAmount;

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err) {
    console.error("Order update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("id");

    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("order_id", orderId);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Order delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
