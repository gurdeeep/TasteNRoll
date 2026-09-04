import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { requireOwner } from "../../lib/auth";
import { buildItemCategoryMap, generateReport } from "../../lib/salesReport";
import { istDateKey } from "../../lib/datetime";

export async function GET(req) {
  try {
    // Sales figures are owner-only.
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const supabase = createServerClient();
    const todayIST = date || istDateKey();

    // Fetch all completed orders for the date
    const { data: allOrders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Filter to the target date
    const dayOrders = (allOrders || []).filter((o) => {
      const orderDate = istDateKey(new Date(o.created_at));
      return orderDate === todayIST;
    });

    const dateLabel = new Date(todayIST).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const report = generateReport(dayOrders, dateLabel);

    return NextResponse.json({ success: true, date: todayIST, ...report });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
