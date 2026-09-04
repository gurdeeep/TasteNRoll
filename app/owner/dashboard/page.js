"use client";
import { useState, useEffect } from "react";
import { istDateKey } from "../../lib/datetime";

function getPresetRange(preset) {
  const now = new Date();
  const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const ist = new Date(istStr);
  const today = istDateKey(now);
  const dayOfWeek = ist.getDay();

  switch (preset) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "yesterday": {
      const y = new Date(ist);
      y.setDate(y.getDate() - 1);
      return { start: y.toLocaleDateString("en-CA"), end: y.toLocaleDateString("en-CA"), label: "Yesterday" };
    }
    case "this-week": {
      const mon = new Date(ist);
      mon.setDate(mon.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { start: mon.toLocaleDateString("en-CA"), end: today, label: "This Week" };
    }
    case "last-week": {
      const thisMon = new Date(ist);
      thisMon.setDate(thisMon.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const lastSun = new Date(thisMon);
      lastSun.setDate(lastSun.getDate() - 1);
      const lastMon = new Date(lastSun);
      lastMon.setDate(lastMon.getDate() - 6);
      return { start: lastMon.toLocaleDateString("en-CA"), end: lastSun.toLocaleDateString("en-CA"), label: "Last Week" };
    }
    case "this-month": {
      const firstDay = new Date(ist.getFullYear(), ist.getMonth(), 1);
      return { start: firstDay.toLocaleDateString("en-CA"), end: today, label: "This Month" };
    }
    case "last-month": {
      const firstDayLastMonth = new Date(ist.getFullYear(), ist.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(ist.getFullYear(), ist.getMonth(), 0);
      return { start: firstDayLastMonth.toLocaleDateString("en-CA"), end: lastDayLastMonth.toLocaleDateString("en-CA"), label: "Last Month" };
    }
    default:
      return { start: today, end: today, label: "Today" };
  }
}

// Access is no longer a passcode typed into the page. Everything under /owner
// is behind an owner JWT, checked by proxy.js before this renders and again by
// /api/dashboard when it is called - so by the time this component runs, the
// visitor is already the owner.
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("today");
  const [dateRange, setDateRange] = useState(() => getPresetRange("today"));
  const [customDate, setCustomDate] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showReport, setShowReport] = useState(false);



  const fetchDashboard = async (start, end) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(dateRange.start, dateRange.end);
  }, [dateRange]);

  const handlePreset = (preset) => {
    setActivePreset(preset);
    setCustomDate("");
    setDateRange(getPresetRange(preset));
  };

  const handleCustomDate = (e) => {
    const val = e.target.value;
    setCustomDate(val);
    setActivePreset("custom");
    setDateRange({ start: val, end: val });
  };

  // Report functions
  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const date = dateRange.start === dateRange.end ? dateRange.start : istDateKey();
      const res = await fetch(`/api/report?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setReportText(data.text);
        setShowReport(true);
      } else {
        alert("Failed to generate report");
      }
    } catch {
      alert("Error generating report");
    } finally {
      setReportLoading(false);
    }
  };

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(reportText)}`;
    window.open(url, "_blank");
  };

  const copyReport = () => {
    navigator.clipboard.writeText(reportText);
    alert("Report copied to clipboard!");
  };

  const presets = [
    { id: "today", label: "Today", icon: "📅" },
    { id: "yesterday", label: "Yesterday", icon: "⏪" },
    { id: "this-week", label: "This Week", icon: "📆" },
    { id: "last-week", label: "Last Week", icon: "🗓️" },
    { id: "this-month", label: "This Month", icon: "📊" },
    { id: "last-month", label: "Last Month", icon: "📉" },
  ];

  return (
    <div className="page dashboard-page">
      <header className="page-head page-head-left">
        <span className="section-eyebrow">Owner view</span>
        <h2>Dashboard</h2>
        <p>Sales overview &amp; revenue stats</p>
      </header>

      {/* Range picker sits above the numbers it controls */}
      <div className="toolbar">
        <div className="filter-buttons">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`filter-btn ${activePreset === p.id ? "active" : ""}`}
              onClick={() => handlePreset(p.id)}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        <div className="filter-custom">
          <label htmlFor="date-select">Custom date</label>
          <input id="date-select" type="date" value={customDate} onChange={handleCustomDate} max={istDateKey()} />
        </div>
      </div>

      {loading && !stats ? (
        <div className="loading-state">Loading dashboard…</div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="dashboard-stats">
            <div className="stat-card stat-total">
              <div className="stat-card-icon">💰</div>
              <div className="stat-card-content">
                <div className="stat-card-value">₹{stats?.totalRevenue?.toLocaleString("en-IN") || 0}</div>
                <div className="stat-card-label">Total Revenue</div>
              </div>
            </div>
            <div className="stat-card stat-total">
              <div className="stat-card-icon">📦</div>
              <div className="stat-card-content">
                <div className="stat-card-value">{stats?.totalSales || 0}</div>
                <div className="stat-card-label">Total Orders</div>
              </div>
            </div>
            <div className="stat-card stat-daily">
              <div className="stat-card-icon">🔥</div>
              <div className="stat-card-content">
                <div className="stat-card-value" style={{ color: "var(--green)" }}>
                  ₹{stats?.filteredRevenue?.toLocaleString("en-IN") || 0}
                </div>
                <div className="stat-card-label">{dateRange.label} Revenue</div>
              </div>
            </div>
            <div className="stat-card stat-daily">
              <div className="stat-card-icon">🧾</div>
              <div className="stat-card-content">
                <div className="stat-card-value" style={{ color: "var(--gold)" }}>
                  {stats?.filteredSales || 0}
                </div>
                <div className="stat-card-label">{dateRange.label} Orders</div>
              </div>
            </div>
          </div>

          {/* Daily Report */}
          <div className="report-section">
            <button className="report-btn" onClick={fetchReport} disabled={reportLoading}>
              {reportLoading ? "Generating…" : "📊 Generate Daily Report"}
            </button>

            {showReport && (
              <div className="report-modal">
                <div className="report-modal-content">
                  <div className="report-modal-header">
                    <h3>📊 Daily Report</h3>
                    <button className="report-close" onClick={() => setShowReport(false)}>✕</button>
                  </div>
                  <pre className="report-text">{reportText}</pre>
                  <div className="report-actions">
                    <button className="report-action-btn whatsapp" onClick={shareWhatsApp}>
                      📲 Send via WhatsApp
                    </button>
                    <button className="report-action-btn copy" onClick={copyReport}>
                      📋 Copy Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
