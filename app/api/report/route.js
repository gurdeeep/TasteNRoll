import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { requireOwner } from "../../lib/auth";
import { generateReport } from "../../lib/salesReport";
import {
  istDateKey,
  istDayStart,
  istDayEnd,
  formatRangeLabelIST,
  parseDayKey,
} from "../../lib/datetime";

// GET /api/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Returns the sales report for a span of IST days. The dashboard sends whatever
// range its date tabs are showing, so "This Week" reports the week. `date=` is
// still accepted as a single-day shorthand.
export async function GET(req) {
  try {
    // Sales figures are owner-only.
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const single = parseDayKey(searchParams.get("date"));
    let startDate = parseDayKey(searchParams.get("startDate")) || single;
    let endDate = parseDayKey(searchParams.get("endDate")) || single;

    // No usable range asked for: report today, as this endpoint always has.
    if (!startDate || !endDate) {
      const today = istDateKey();
      startDate = today;
      endDate = today;
    }

    // Tolerate the two ends arriving the wrong way round.
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

    const supabase = createServerClient();

    // Postgres does the date filtering. The previous version pulled every
    // completed order in the table and filtered in JS, which got slower with
    // each month of trading.
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "completed")
      .gte("created_at", istDayStart(startDate))
      .lte("created_at", istDayEnd(endDate))
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Report query error:", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    const isOneDay = startDate === endDate;
    const report = generateReport(
      orders || [],
      formatRangeLabelIST(startDate, endDate),
      isOneDay ? "Daily Report" : "Sales Report"
    );

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      // `date` kept so an older client reading it does not break.
      date: startDate,
      ...report,
    });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
