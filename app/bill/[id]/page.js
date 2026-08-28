"use client";
import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import {
  SHOP_NAME,
  SHOP_ADDRESS,
  SHOP_PHONE,
  SHOP_ENQUIRY,
  SHOP_TAGLINE,
} from "../../data/shop";

export default function BillPage({ params }) {
  const { id } = use(params);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.success) {
          setOrder(data.order);
        } else {
          setError(data.error || "Order not found");
        }
      } catch {
        setError("Failed to load order");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="success-page">
        <div className="success-icon" style={{ animation: "none" }}>⏳</div>
        <h1 style={{ color: "var(--text-primary)" }}>Loading Bill...</h1>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="success-page">
        <div className="success-icon" style={{ animation: "none" }}>❌</div>
        <h1 style={{ color: "var(--red)" }}>Bill Not Found</h1>
        <p>{error || "This order does not exist."}</p>
        <Link href="/" className="btn-primary" style={{ marginTop: "1.5rem" }}>Go Home</Link>
      </div>
    );
  }

  const items = order.items || [];
  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "—";

  return (
    <div className="success-page">
      <div className="success-icon no-print">🧾</div>
      <h1 className="no-print" style={{ color: "var(--accent-light)" }}>Your Bill</h1>

      <div className="receipt" ref={receiptRef}>
        <div className="receipt-header">
          <h2>🥡 {SHOP_NAME}</h2>
          <p>{SHOP_TAGLINE}</p>
          <p className="receipt-address">{SHOP_ADDRESS}</p>
          <p className="receipt-address">📞 {SHOP_PHONE} | Enquiry: {SHOP_ENQUIRY}</p>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-info">
          <div className="receipt-row">
            <span>Order No</span>
            <span className="order-id" style={{ fontWeight: 700 }}>
              {order.daily_order_number && `#${order.daily_order_number} · `}{order.order_id}
            </span>
          </div>
          <div className="receipt-row">
            <span>Date & Time</span>
            <span>{createdAt}</span>
          </div>
          <div className="receipt-row">
            <span>Customer</span>
            <span style={{ fontWeight: 600 }}>{order.customer_name || "—"}</span>
          </div>
          <div className="receipt-row">
            <span>Payment</span>
            <span style={{ fontWeight: 600 }}>
              {order.payment_method === "Split"
                ? "💳 Split"
                : order.payment_method === "Unpaid"
                  ? "⏳ Unpaid"
                  : order.payment_method === "UPI" ? "📱 UPI" : "💵 Cash"}
            </span>
          </div>
          {order.payment_method === "Split" && (
            <>
              <div className="receipt-row">
                <span>  └ Cash</span>
                <span>₹{order.cash_amount || 0}</span>
              </div>
              <div className="receipt-row">
                <span>  └ UPI</span>
                <span>₹{order.upi_amount || 0}</span>
              </div>
            </>
          )}
        </div>

        <div className="receipt-divider" />

        <div className="receipt-items">
          <div className="receipt-items-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
          </div>
          {items.map((item, i) => (
            <div className="receipt-item-row" key={i}>
              <span className="receipt-item-name">
                {item.name}
                <small> ({item.variant})</small>
              </span>
              <span>×{item.qty}</span>
              <span>₹{item.price * item.qty}</span>
            </div>
          ))}
        </div>

        <div className="receipt-divider" />

        {order.discount_applied && order.discount_amount > 0 && (
          <>
            <div className="receipt-row">
              <span>Subtotal</span>
              <span>₹{order.subtotal}</span>
            </div>
            <div className="receipt-row" style={{ color: "var(--green)" }}>
              <span>🏷️ Discount ({order.discount_percent || 5}%)</span>
              <span>−₹{order.discount_amount}</span>
            </div>
          </>
        )}

        <div className="receipt-total">
          <span>TOTAL</span>
          <span>₹{order.total_amount}</span>
        </div>

        <div className="receipt-footer">
          <p>Thank you! Visit again 🙏</p>
        </div>
      </div>

      {/* Actions — hidden in print */}
      <div className="receipt-actions no-print">
        <button className="btn-primary" onClick={handlePrint} style={{ flex: 1 }}>
          🖨️ Download / Print
        </button>
      </div>
    </div>
  );
}
