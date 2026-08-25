"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../context/CartContext";

const getISTDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function getPresetRange(preset) {
  const now = new Date();
  const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const ist = new Date(istStr);
  const today = getISTDate(now);
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

export default function HistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("today");
  const [dateRange, setDateRange] = useState(() => getPresetRange("today"));
  const [customDate, setCustomDate] = useState("");
  const router = useRouter();
  const { setCart, setDiscount } = useCart();

  const fetchOrders = async (start, end) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(dateRange.start, dateRange.end);
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
    setDateRange({ start: val, end: val, label: formatDate(val) });
  };

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

  const handleEditOrder = (order) => {
    const cartItems = order.items.map((item) => ({ ...item, key: `${item.id}-${item.variant}` }));
    setCart(cartItems);
    if (order.discount_percent) setDiscount(order.discount_percent);
    sessionStorage.setItem("editingOrderId", order.order_id);
    router.push("/cart");
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchOrders(dateRange.start, dateRange.end);
      } else {
        alert("Failed to delete order");
      }
    } catch {
      alert("Error deleting order");
    }
  };

  const presets = [
    { id: "today", label: "Today", icon: "📅" },
    { id: "yesterday", label: "Yesterday", icon: "⏪" },
    { id: "this-week", label: "This Week", icon: "📆" },
    { id: "last-week", label: "Last Week", icon: "🗓️" },
    { id: "this-month", label: "This Month", icon: "📊" },
    { id: "last-month", label: "Last Month", icon: "📉" },
  ];

  const rangeLabel = dateRange.start === dateRange.end
    ? (activePreset === "today" ? "Today" : formatDate(dateRange.start))
    : `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`;

  return (
    <div className="page dashboard-page">
      <header className="page-head page-head-left">
        <span className="section-eyebrow">Records</span>
        <h2>Order History</h2>
        <p>Every order placed, by date</p>
      </header>

      <div className="toolbar">
        <div className="filter-buttons">
          {presets.map((p) => (
            <button key={p.id} className={`filter-btn ${activePreset === p.id ? "active" : ""}`} onClick={() => handlePreset(p.id)}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        <div className="filter-custom">
          <label htmlFor="hist-date">Custom date</label>
          <input id="hist-date" type="date" value={customDate} onChange={handleCustomDate} max={getISTDate()} />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="loading-state">Loading orders…</div>
      ) : (
        <div className="dashboard-orders">
          <h3 className="dashboard-orders-title">
            {rangeLabel} Orders
            <span className="dashboard-orders-count">{orders.length}</span>
          </h3>

          {orders.length === 0 ? (
            <div className="dashboard-empty">
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📭</div>
              <p>No orders for this period</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div className="order-card-id">
                      {order.daily_order_number && (
                        <span className="daily-order-badge">#{order.daily_order_number}</span>
                      )}
                      {order.order_id}
                    </div>
                    <div className="order-card-time">{formatTime(order.created_at)}</div>
                  </div>
                  <div className="order-card-body">
                    <div className="order-card-customer">
                      <span>👤 {order.customer_name}</span>
                      {order.customer_phone && (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          📞 {order.customer_phone}
                        </span>
                      )}
                    </div>
                    <div className="order-card-items">
                      {order.items?.map((item, i) => (
                        <span key={i} className="order-card-item-tag">
                          {item.name} × {item.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="order-card-footer">
                    <span className={`order-card-payment ${order.payment_method === "Split" ? "split" : order.payment_method === "UPI" ? "upi" : "cash"}`}>
                      {order.payment_method === "Split"
                        ? `💳 Split (₹${order.cash_amount || 0} + ₹${order.upi_amount || 0})`
                        : order.payment_method === "UPI" ? "📱 UPI" : "💵 Cash"}
                    </span>
                    {order.discount_applied && (
                      <span className="order-card-discount">{order.discount_percent || 5}% off</span>
                    )}
                    <span className="order-card-total">₹{order.total_amount}</span>
                    <button className="order-card-edit" onClick={() => handleEditOrder(order)}>
                      ✏️ Edit
                    </button>
                    <Link href={`/bill/${order.order_id}`} className="order-card-view">
                      View →
                    </Link>
                    <button className="order-card-delete" onClick={() => handleDeleteOrder(order.order_id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
