"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../context/CartContext";

export default function UnpaidPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [splitOpen, setSplitOpen] = useState(null); // order_id of open split form
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const router = useRouter();
  const { setCart, setDiscount } = useCart();

  const fetchUnpaid = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders?status=unpaid");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch unpaid orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnpaid();
  }, []);

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

  const handleMarkPaid = async (orderId, method, cashAmt = 0, upiAmt = 0) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentMethod: method,
          status: "completed",
          cashAmount: cashAmt,
          upiAmount: upiAmt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSplitOpen(null);
        fetchUnpaid();
      } else {
        alert("Failed to update payment");
      }
    } catch {
      alert("Error updating payment");
    }
  };

  const handleSplitPay = (order) => {
    const cash = parseFloat(splitCash) || 0;
    const upi = parseFloat(splitUpi) || 0;
    if (Math.round(cash + upi) !== order.total_amount) {
      return alert(`Cash (₹${cash}) + UPI (₹${upi}) must equal ₹${order.total_amount}`);
    }
    handleMarkPaid(order.order_id, "Split", cash, upi);
  };

  const openSplit = (orderId, total) => {
    setSplitOpen(orderId);
    setSplitCash(String(total));
    setSplitUpi("0");
  };

  const handleSplitCashChange = (val, total) => {
    setSplitCash(val);
    const num = parseFloat(val) || 0;
    if (num >= 0 && num <= total) setSplitUpi(String(total - num));
  };

  const handleSplitUpiChange = (val, total) => {
    setSplitUpi(val);
    const num = parseFloat(val) || 0;
    if (num >= 0 && num <= total) setSplitCash(String(total - num));
  };

  const handleDelete = async (orderId) => {
    if (!confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchUnpaid();
      } else {
        alert("Failed to delete order");
      }
    } catch {
      alert("Error deleting order");
    }
  };

  const handleEditOrder = (order) => {
    const cartItems = order.items.map((item) => ({ ...item, key: `${item.id}-${item.variant}` }));
    setCart(cartItems);
    if (order.discount_percent) setDiscount(order.discount_percent);
    sessionStorage.setItem("editingOrderId", order.order_id);
    router.push("/owner/cart");
  };

  const totalUnpaid = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="page page-narrow unpaid-page">
      <header className="page-head page-head-left">
        <span className="section-eyebrow">Running tabs</span>
        <h2>Unpaid Orders</h2>
        <p>Orders waiting to be settled</p>
      </header>

      {orders.length > 0 && (
        <div className="unpaid-summary">
          <div className="unpaid-summary-item">
            <span className="unpaid-summary-label">Pending Orders</span>
            <span className="unpaid-summary-value">{orders.length}</span>
          </div>
          <div className="unpaid-summary-item">
            <span className="unpaid-summary-label">Total Due</span>
            <span className="unpaid-summary-value unpaid-amount">₹{totalUnpaid.toLocaleString("en-IN")}</span>
          </div>
          <button className="btn-refresh" onClick={fetchUnpaid}>🔄 Refresh</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading unpaid orders…</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">✨</div>
          <h2>All Clear</h2>
          <p>No unpaid orders — every bill is settled.</p>
          <Link href="/owner/menu" className="btn-primary">
            Take New Order
          </Link>
        </div>
      ) : (
        <div className="unpaid-list">
          {orders.map((order) => (
            <div key={order.id} className="unpaid-card">
              <div className="unpaid-card-header">
                <div className="unpaid-card-id">
                  {order.daily_order_number && (
                    <span className="daily-order-badge">#{order.daily_order_number}</span>
                  )}
                  {order.order_id}
                </div>
                <div className="unpaid-card-meta">
                  <span className="unpaid-card-date">{formatDate(order.created_at)}</span>
                  <span className="unpaid-card-time">{formatTime(order.created_at)}</span>
                </div>
              </div>

              <div className="unpaid-card-body">
                <div className="unpaid-card-customer">
                  <span>👤 {order.customer_name}</span>
                  {order.customer_phone && (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      📞 {order.customer_phone}
                    </span>
                  )}
                </div>
                <div className="unpaid-card-items">
                  {order.items?.map((item, i) => (
                    <span key={i} className="order-card-item-tag">
                      {item.name} × {item.qty}
                    </span>
                  ))}
                </div>
              </div>

              <div className="unpaid-card-total">
                <span>Total Due</span>
                <span className="unpaid-amount-big">₹{order.total_amount}</span>
              </div>

              <div className="unpaid-card-actions">
                <div className="unpaid-pay-buttons">
                  <span className="pay-label">Mark Paid:</span>
                  <button className="mark-paid-btn cash" onClick={() => handleMarkPaid(order.order_id, "Cash", order.total_amount, 0)}>
                    💵 Cash
                  </button>
                  <button className="mark-paid-btn upi" onClick={() => handleMarkPaid(order.order_id, "UPI", 0, order.total_amount)}>
                    📱 UPI
                  </button>
                  <button
                    className={`mark-paid-btn split ${splitOpen === order.order_id ? "active" : ""}`}
                    onClick={() => splitOpen === order.order_id ? setSplitOpen(null) : openSplit(order.order_id, order.total_amount)}
                  >
                    💳 Split
                  </button>
                </div>
                <div className="unpaid-other-actions">
                  <button className="order-card-edit" onClick={() => handleEditOrder(order)}>
                    ✏️ Edit
                  </button>
                  <Link href={`/bill/${order.order_id}`} className="order-card-view">
                    View Bill →
                  </Link>
                  <button className="order-card-delete" onClick={() => handleDelete(order.order_id)}>
                    🗑️
                  </button>
                </div>
              </div>

              {/* Split payment form */}
              {splitOpen === order.order_id && (
                <div className="split-inputs" style={{ marginTop: "0.75rem" }}>
                  <div className="split-field">
                    <label>💵 Cash</label>
                    <input type="number" min="0" max={order.total_amount} value={splitCash}
                      onChange={(e) => handleSplitCashChange(e.target.value, order.total_amount)} placeholder="0" />
                  </div>
                  <div className="split-field">
                    <label>📱 UPI</label>
                    <input type="number" min="0" max={order.total_amount} value={splitUpi}
                      onChange={(e) => handleSplitUpiChange(e.target.value, order.total_amount)} placeholder="0" />
                  </div>
                  <button className="mark-paid-btn cash" onClick={() => handleSplitPay(order)}
                    style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}>
                    ✅ Confirm Split Pay
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
