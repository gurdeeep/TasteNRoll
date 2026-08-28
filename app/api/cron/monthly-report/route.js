import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase";
import { menuData } from "../../../data/menu";
import PDFDocument from "pdfkit";

const SHOP_NAME = "Taste N' RoLLs";
const SHOP_ADDRESS = "Shop No. 168, Opp. Bus Stand Parking Gate, Sampla";

// Build item category lookup
function buildItemCategoryMap() {
  const map = {};
  menuData.forEach((cat) => {
    cat.items.forEach((item) => {
      map[item.id] = { category: cat.name };
    });
  });
  return map;
}

// Get previous month's date range in IST
function getPreviousMonthRange() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // current month (0-indexed)

  // Previous month
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  const startDate = new Date(Date.UTC(prevYear, prevMonth, 1) - istOffset);
  const endDate = new Date(Date.UTC(year, month, 1) - istOffset - 1); // last ms of prev month

  const monthName = new Date(prevYear, prevMonth, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return {
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    monthName,
    prevYear,
    prevMonth: prevMonth + 1, // 1-indexed for display
  };
}

// Generate PDF buffer from order data
async function generatePDF(orders, monthName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const catMap = buildItemCategoryMap();

      // ===== CALCULATIONS =====
      const cashOrders = orders.filter((o) => o.payment_method === "Cash");
      const upiOrders = orders.filter((o) => o.payment_method === "UPI");
      const splitOrders = orders.filter((o) => o.payment_method === "Split");
      const unpaidOrders = orders.filter((o) => o.payment_method === "Unpaid");

      const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const totalCash = cashOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
        + splitOrders.reduce((s, o) => s + (o.cash_amount || 0), 0);
      const totalUpi = upiOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
        + splitOrders.reduce((s, o) => s + (o.upi_amount || 0), 0);
      const totalDiscount = orders.reduce((s, o) => s + (o.discount_amount || 0), 0);
      const discountedOrders = orders.filter((o) => o.discount_applied).length;

      // Item-wise breakdown
      const itemMap = {};
      const sectionMap = {};

      orders.forEach((o) => {
        (o.items || []).forEach((item) => {
          const lookup = catMap[item.id];
          const sectionKey = lookup?.category || "Other";
          const itemLabel = item.variant ? `${item.name} (${item.variant})` : item.name;
          const qty = item.qty || 1;
          const rev = (item.price || 0) * qty;

          if (!itemMap[itemLabel]) itemMap[itemLabel] = { qty: 0, rev: 0, section: sectionKey };
          itemMap[itemLabel].qty += qty;
          itemMap[itemLabel].rev += rev;

          if (!sectionMap[sectionKey]) sectionMap[sectionKey] = { qty: 0, rev: 0 };
          sectionMap[sectionKey].qty += qty;
          sectionMap[sectionKey].rev += rev;
        });
      });

      const totalItemsSold = Object.values(itemMap).reduce((s, i) => s + i.qty, 0);

      // ===== PDF CONTENT =====
      // Title
      doc.fontSize(22).font("Helvetica-Bold").text(SHOP_NAME, { align: "center" });
      doc.fontSize(10).font("Helvetica").text(SHOP_ADDRESS, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font("Helvetica-Bold").text(`Monthly Report — ${monthName}`, { align: "center" });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#333");
      doc.moveDown(0.8);

      // Summary stats
      doc.fontSize(13).font("Helvetica-Bold").text("Summary");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");

      const summaryData = [
        ["Total Orders", `${orders.length}`],
        ["Total Items Sold", `${totalItemsSold}`],
        ["Total Revenue", `Rs. ${totalRevenue.toLocaleString("en-IN")}`],
        ["Cash Collection", `Rs. ${totalCash.toLocaleString("en-IN")} (${cashOrders.length} orders)`],
        ["UPI Collection", `Rs. ${totalUpi.toLocaleString("en-IN")} (${upiOrders.length} orders)`],
        ["Split Orders", `${splitOrders.length}`],
        ["Unpaid Orders", `${unpaidOrders.length}`],
      ];

      if (totalDiscount > 0) {
        summaryData.push(["Total Discount Given", `Rs. ${totalDiscount.toLocaleString("en-IN")} (${discountedOrders} orders)`]);
      }

      summaryData.forEach(([label, value]) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
      });

      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ccc");
      doc.moveDown(0.8);

      // Category-wise breakdown
      doc.fontSize(13).font("Helvetica-Bold").text("Category-wise Sales");
      doc.moveDown(0.3);

      // Table header
      const colX = [40, 280, 380, 470];
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Category", colX[0], doc.y, { width: 230 });
      doc.text("Qty Sold", colX[1], doc.y - 11, { width: 90, align: "right" });
      doc.text("Revenue", colX[2], doc.y - 11, { width: 90, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ddd");
      doc.moveDown(0.2);

      const sortedSections = Object.entries(sectionMap).sort((a, b) => b[1].qty - a[1].qty);

      doc.fontSize(9).font("Helvetica");
      sortedSections.forEach(([name, sec]) => {
        if (doc.y > 720) { doc.addPage(); }
        const y = doc.y;
        doc.text(name, colX[0], y, { width: 230 });
        doc.text(`${sec.qty}`, colX[1], y, { width: 90, align: "right" });
        doc.text(`Rs. ${sec.rev.toLocaleString("en-IN")}`, colX[2], y, { width: 90, align: "right" });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ccc");
      doc.moveDown(0.8);

      // Item-wise breakdown
      doc.fontSize(13).font("Helvetica-Bold").text("Item-wise Sales");
      doc.moveDown(0.3);

      doc.fontSize(9).font("Helvetica-Bold");
      let hy = doc.y;
      doc.text("Item", colX[0], hy, { width: 230 });
      doc.text("Qty", colX[1], hy, { width: 90, align: "right" });
      doc.text("Revenue", colX[2], hy, { width: 90, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ddd");
      doc.moveDown(0.2);

      const sortedItems = Object.entries(itemMap).sort((a, b) => b[1].qty - a[1].qty);

      doc.fontSize(9).font("Helvetica");
      sortedItems.forEach(([name, data]) => {
        if (doc.y > 720) { doc.addPage(); }
        const y = doc.y;
        doc.text(name, colX[0], y, { width: 230 });
        doc.text(`${data.qty}`, colX[1], y, { width: 90, align: "right" });
        doc.text(`Rs. ${data.rev.toLocaleString("en-IN")}`, colX[2], y, { width: 90, align: "right" });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ccc");
      doc.moveDown(0.8);

      // Order History table
      if (doc.y > 600) doc.addPage();
      doc.fontSize(13).font("Helvetica-Bold").text("Order History");
      doc.moveDown(0.3);

      const orderColX = [40, 120, 210, 310, 395, 470];
      doc.fontSize(8).font("Helvetica-Bold");
      let ohy = doc.y;
      doc.text("Order ID", orderColX[0], ohy, { width: 75 });
      doc.text("Date", orderColX[1], ohy, { width: 85 });
      doc.text("Customer", orderColX[2], ohy, { width: 95 });
      doc.text("Payment", orderColX[3], ohy, { width: 80 });
      doc.text("Discount", orderColX[4], ohy, { width: 70, align: "right" });
      doc.text("Total", orderColX[5], ohy, { width: 70, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#ddd");
      doc.moveDown(0.15);

      doc.fontSize(7.5).font("Helvetica");
      orders.forEach((o) => {
        if (doc.y > 740) { doc.addPage(); }
        const y = doc.y;
        const date = new Date(o.created_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "2-digit",
        });
        doc.text(o.order_id || "—", orderColX[0], y, { width: 75 });
        doc.text(date, orderColX[1], y, { width: 85 });
        doc.text((o.customer_name || "—").slice(0, 15), orderColX[2], y, { width: 95 });
        doc.text(o.payment_method || "—", orderColX[3], y, { width: 80 });
        doc.text(o.discount_amount > 0 ? `Rs. ${o.discount_amount}` : "—", orderColX[4], y, { width: 70, align: "right" });
        doc.text(`Rs. ${(o.total_amount || 0).toLocaleString("en-IN")}`, orderColX[5], y, { width: 70, align: "right" });
        doc.moveDown(0.2);
      });

      // Footer
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#333");
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").fillColor("#888")
        .text(`Generated on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} | ${SHOP_NAME}`, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Monthly report cron — runs on 1st of every month at 10 AM IST
export async function GET(req) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { startISO, endISO, monthName } = getPreviousMonthRange();

    // Fetch all orders from previous month
    const { data: orders, error: dbError } = await supabase
      .from("orders")
      .select("*")
      // Online orders sit at 'pending_online' until the owner confirms the UPI
      // payment. Only confirmed money belongs in the month's report.
      .neq("status", "pending_online")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ error: "Failed to fetch orders", details: dbError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No orders found for ${monthName}. Nothing to report or clear.`,
      });
    }

    // Generate PDF
    let pdfBuffer;
    try {
      pdfBuffer = await generatePDF(orders, monthName);
    } catch (pdfErr) {
      console.error("PDF generation error:", pdfErr);
      return NextResponse.json({ error: "Failed to generate PDF", details: pdfErr.message }, { status: 500 });
    }

    // Send email with PDF attachment via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const reportEmail = process.env.REPORT_EMAIL;

    if (!resendApiKey || !reportEmail) {
      return NextResponse.json({
        success: false,
        error: "RESEND_API_KEY or REPORT_EMAIL not configured. Data NOT cleared.",
      }, { status: 500 });
    }

    const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const pdfBase64 = pdfBuffer.toString("base64");
    const fileName = `TasteNRolls_Report_${monthName.replace(/\s+/g, "_")}.pdf`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Taste N Rolls <onboarding@resend.dev>",
        to: [reportEmail],
        subject: `📊 Monthly Report — ${monthName} | Taste N' RoLLs`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;">
            <div style="text-align:center;margin-bottom:16px;">
              <span style="font-size:2rem;">🥡</span>
              <h2 style="margin:4px 0;color:#f97316;">Taste N' RoLLs — Monthly Report</h2>
              <p style="color:#aaa;font-size:13px;">${monthName}</p>
            </div>
            <div style="background:#16162a;padding:16px;border-radius:8px;line-height:1.8;font-size:14px;">
              <strong>Total Orders:</strong> ${orders.length}<br>
              <strong>Total Revenue:</strong> Rs. ${totalRevenue.toLocaleString("en-IN")}<br><br>
              <p style="color:#aaa;font-size:12px;">Full report with item-wise breakdown and order history is attached as PDF.</p>
            </div>
            <p style="text-align:center;color:#888;font-size:12px;margin-top:16px;">
              Auto-generated on 1st of every month at 10:00 AM IST
            </p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ],
      }),
    });

    const emailResult = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", JSON.stringify(emailResult));
      return NextResponse.json({
        success: false,
        error: "Failed to send email. Data NOT cleared.",
        details: emailResult,
      }, { status: 500 });
    }

    // EMAIL SENT SUCCESSFULLY — Now clear previous month's data
    const orderIds = orders.map((o) => o.id);

    // Delete in batches of 100 to avoid timeouts
    let deletedCount = 0;
    for (let i = 0; i < orderIds.length; i += 100) {
      const batch = orderIds.slice(i, i + 100);
      const { error: deleteError, count } = await supabase
        .from("orders")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error("Delete error at batch", i, deleteError);
        return NextResponse.json({
          success: false,
          error: `Email sent but failed to delete orders at batch ${i}. ${deletedCount} already deleted.`,
          emailId: emailResult.id,
          details: deleteError.message,
        }, { status: 500 });
      }
      deletedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Monthly report for ${monthName} sent and ${deletedCount} orders cleared.`,
      emailId: emailResult.id,
      month: monthName,
      ordersReported: orders.length,
      ordersDeleted: deletedCount,
      totalRevenue,
    });
  } catch (err) {
    console.error("Monthly report error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
