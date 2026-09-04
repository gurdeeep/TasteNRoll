import { NextResponse } from "next/server";
import { authoriseCron } from "../../../lib/cronAuth";
import { escapeHtml } from "../../../lib/html";
import { createServerClient } from "../../../lib/supabase";
import { generateReport } from "../../../lib/salesReport";
import { istDateKey } from "../../../lib/datetime";

// Cron endpoint — called by Vercel Cron at 11 PM IST daily
export async function GET(req) {
  try {
    // Fail closed: a missing CRON_SECRET used to disable this check.
    const denied = await authoriseCron(req);
    if (denied) return denied;

    // Fetch today's orders directly from Supabase
    const todayIST = istDateKey();
    const supabase = createServerClient();

    const { data: allOrders, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    const dayOrders = (allOrders || []).filter((o) => {
      const orderDate = istDateKey(new Date(o.created_at));
      return orderDate === todayIST;
    });

    const dateLabel = new Date(todayIST).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const { text: reportText } = generateReport(dayOrders, dateLabel);

    const results = { email: null, whatsapp: null };

    // ===== 1. EMAIL via Resend =====
    const resendApiKey = process.env.RESEND_API_KEY;
    const reportEmail = process.env.REPORT_EMAIL;

    if (resendApiKey && reportEmail) {
      try {
        const htmlReport = escapeHtml(reportText)
          .replace(/\n/g, "<br>")
          .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
          .replace(/━+/g, "<hr style='border:1px solid #333'>")
          .replace(/▸/g, "•");

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Taste N Rolls <onboarding@resend.dev>",
            to: [reportEmail],
            subject: `📊 Daily Report — ${todayIST} | Taste N' RoLLs`,
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;">
                <div style="text-align:center;margin-bottom:16px;">
                  <span style="font-size:2rem;">🥡</span>
                  <h2 style="margin:4px 0;color:#f97316;">Taste N' RoLLs</h2>
                </div>
                <div style="background:#16162a;padding:16px;border-radius:8px;line-height:1.8;font-size:14px;">
                  ${htmlReport}
                </div>
                <p style="text-align:center;color:#888;font-size:12px;margin-top:16px;">
                  Auto-generated at 11:00 PM IST
                </p>
              </div>
            `,
          }),
        });

        const emailResult = await emailRes.json();
        if (emailRes.ok) {
          results.email = { success: true, emailId: emailResult.id };
        } else {
          results.email = { success: false, error: emailResult };
          console.error("Resend error:", JSON.stringify(emailResult));
        }
      } catch (emailErr) {
        results.email = { success: false, error: emailErr.message };
      }
    } else {
      results.email = { success: false, error: "RESEND_API_KEY or REPORT_EMAIL not set" };
    }

    // ===== 2. WHATSAPP via CallMeBot (if configured) =====
    const callmebotPhone = process.env.CALLMEBOT_PHONE;
    const callmebotKey = process.env.CALLMEBOT_APIKEY;

    if (callmebotPhone && callmebotKey) {
      try {
        const waText = encodeURIComponent(reportText);
        const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${callmebotPhone}&text=${waText}&apikey=${callmebotKey}`;
        const waRes = await fetch(waUrl);
        if (waRes.ok) {
          results.whatsapp = { success: true };
        } else {
          results.whatsapp = { success: false, status: waRes.status, error: await waRes.text() };
        }
      } catch (waErr) {
        results.whatsapp = { success: false, error: waErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Daily report processed",
      date: todayIST,
      ordersFound: dayOrders.length,
      results,
    });
  } catch (err) {
    console.error("Cron report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
