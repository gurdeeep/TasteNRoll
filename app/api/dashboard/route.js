import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { requireOwner } from "../../lib/auth";

export async function GET(req) {
  try {
    // Sales figures are owner-only.
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const date = searchParams.get("date");

    const supabase = createServerClient();

    // Get all orders
    const { data: allOrders, error: allErr } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (allErr) {
      console.error("Supabase error:", allErr);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Separate paid, unpaid, and online orders still awaiting confirmation.
    // 'pending_online' is an online order whose UPI payment the owner has not
    // verified yet: it is neither takings nor an unpaid counter tab, so it is
    // excluded from both totals until confirmed.
    const paidOrders = allOrders?.filter((o) => o.status === "completed") || [];
    const unpaidOrders = allOrders?.filter((o) => o.status === "unpaid") || [];
    const pendingOnline = allOrders?.filter((o) => o.status === "pending_online") || [];

    // Calculate total stats (paid only)
    const totalSales = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Determine date range
    let filterStart, filterEnd;
    if (startDate && endDate) {
      filterStart = startDate;
      filterEnd = endDate;
    } else {
      const singleDate = date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      filterStart = singleDate;
      filterEnd = singleDate;
    }

    // Filter paid orders in the date range
    const filteredOrders = paidOrders.filter((o) => {
      const orderDate = new Date(o.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      return orderDate >= filterStart && orderDate <= filterEnd;
    });

    const filteredSales = filteredOrders.length;
    const filteredRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Unpaid totals
    const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalSales,
        totalRevenue,
        filteredSales,
        filteredRevenue,
        startDate: filterStart,
        endDate: filterEnd,
        unpaidCount: unpaidOrders.length,
        unpaidTotal,
        pendingOnlineCount: pendingOnline.length,
      },
      orders: filteredOrders,
      unpaidOrders,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
