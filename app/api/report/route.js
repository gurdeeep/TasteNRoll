import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { requireOwner } from "../../lib/auth";
import { menuData } from "../../data/menu";

// Build a lookup: item ID → category name & icon
function buildItemCategoryMap() {
  const map = {};
  menuData.forEach((cat) => {
    cat.items.forEach((item) => {
      map[item.id] = { category: cat.name, icon: cat.icon };
    });
  });
  return map;
}

// Generate daily report grouped by menu sections
function generateReport(orders, dateLabel) {
  // Payment breakdown
  const cashOrders = orders.filter((o) => o.payment_method === "Cash");
  const upiOrders = orders.filter((o) => o.payment_method === "UPI");
  const splitOrders = orders.filter((o) => o.payment_method === "Split");

  const totalCash = cashOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
    + splitOrders.reduce((s, o) => s + (o.cash_amount || 0), 0);
  const totalUpi = upiOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
    + splitOrders.reduce((s, o) => s + (o.upi_amount || 0), 0);
  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalDiscount = orders.reduce((s, o) => s + (o.discount_amount || 0), 0);
  const discountedOrders = orders.filter((o) => o.discount_applied).length;

  // Build item-to-category map
  const catMap = buildItemCategoryMap();

  // Group items by category
  const sectionMap = {}; // { "🌿 Veg Rolls": { totalQty, totalRev, items: { "Paneer Roll (Full)": {qty, rev} } } }

  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const lookup = catMap[item.id];
      const sectionKey = lookup ? `${lookup.icon} ${lookup.category}` : "🍽️ Other";
      const itemLabel = item.variant ? `${item.name} (${item.variant})` : item.name;

      if (!sectionMap[sectionKey]) {
        sectionMap[sectionKey] = { totalQty: 0, totalRev: 0, items: {} };
      }

      sectionMap[sectionKey].totalQty += item.qty || 1;
      sectionMap[sectionKey].totalRev += (item.price || 0) * (item.qty || 1);

      if (!sectionMap[sectionKey].items[itemLabel]) {
        sectionMap[sectionKey].items[itemLabel] = { qty: 0, rev: 0 };
      }
      sectionMap[sectionKey].items[itemLabel].qty += item.qty || 1;
      sectionMap[sectionKey].items[itemLabel].rev += (item.price || 0) * (item.qty || 1);
    });
  });

  // Sort sections by total quantity sold (highest first)
  const sortedSections = Object.entries(sectionMap)
    .sort((a, b) => b[1].totalQty - a[1].totalQty);

  // Total items sold
  const totalItemsSold = sortedSections.reduce((s, [, sec]) => s + sec.totalQty, 0);

  // Build text report
  let text = `📊 *TASTE N' ROLLS — Daily Report*\n`;
  text += `📅 ${dateLabel}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `🧾 *Total Orders:* ${orders.length}\n`;
  text += `🍽️ *Total Items Sold:* ${totalItemsSold}\n`;
  text += `💰 *Total Revenue:* ₹${totalRevenue.toLocaleString("en-IN")}\n`;
  if (totalDiscount > 0) {
    text += `🏷️ *Total Discount Given:* ₹${totalDiscount.toLocaleString("en-IN")} (${discountedOrders} orders)\n`;
  }
  text += `\n`;

  text += `💵 *Cash:* ₹${totalCash.toLocaleString("en-IN")} (${cashOrders.length} orders)\n`;
  text += `📱 *UPI:* ₹${totalUpi.toLocaleString("en-IN")} (${upiOrders.length} orders)\n`;
  if (splitOrders.length > 0) {
    text += `💳 *Split:* ${splitOrders.length} orders\n`;
  }

  if (sortedSections.length === 0) {
    text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `No items sold today.\n`;
  } else {
    sortedSections.forEach(([sectionName, section]) => {
      text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `*${sectionName}* — ${section.totalQty} sold (₹${section.totalRev.toLocaleString("en-IN")})\n\n`;

      // Sort items within section by qty
      const sortedItems = Object.entries(section.items)
        .sort((a, b) => b[1].qty - a[1].qty);

      sortedItems.forEach(([name, data]) => {
        text += `  ▸ ${name} × ${data.qty} = ₹${data.rev}\n`;
      });
    });
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏪 Taste N' RoLLs, Sampla`;

  return {
    text,
    stats: {
      totalOrders: orders.length,
      totalItemsSold,
      totalRevenue,
      totalDiscount,
      discountedOrders,
      totalCash,
      totalUpi,
      cashOrders: cashOrders.length,
      upiOrders: upiOrders.length,
      splitOrders: splitOrders.length,
      sections: sortedSections.map(([name, sec]) => ({
        name,
        totalQty: sec.totalQty,
        totalRev: sec.totalRev,
        items: Object.entries(sec.items)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([n, d]) => ({ name: n, qty: d.qty, revenue: d.rev })),
      })),
    },
  };
}

export async function GET(req) {
  try {
    // Sales figures are owner-only.
    const { error: authError } = await requireOwner();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const supabase = createServerClient();
    const todayIST = date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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
      const orderDate = new Date(o.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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
