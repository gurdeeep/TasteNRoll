"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PAYMENT, FULFILLMENT, FULFILLMENT_LABEL, PAYMENT_LABEL } from "../../lib/orderStatus";

// A customer following their own orders. Polls while anything is still moving
// and stops once everything has settled, so a phone left open on this page is
// not pinging the server all afternoon.
const POLL_MS = 10000;

const LIVE_STATES = [
  FULFILLMENT.AWAITING_PAYMENT,
  FULFILLMENT.NEW,
  FULFILLMENT.PREPARING,
  FULFILLMENT.READY,
];

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/orders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load your orders");
        return;
      }
      setOrders(data.orders || []);
      setError("");
    } catch {
      setError("Network problem. Retrying…");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasLive = orders.some((o) => LIVE_STATES.includes(o.order_status));
  useEffect(() => {
    if (!hasLive) return;
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [hasLive, load]);

  if (loading) {
    return (
      <div className="page orders-page">
        <div className="pay-loading">Loading your orders…</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="page orders-page">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🧾</div>
          <h2>No orders yet</h2>
          <p>Once you order, it shows up here with its live status.</p>
          <Link href="/customer/menu" className="btn-primary">Open Menu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page orders-page">
      <div className="page-header">
        <h1>My orders</h1>
        <p>{hasLive ? "Updating live while an order is in progress." : "Your past orders."}</p>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="myorders-list">
        {orders.map((order) => (
          <OrderCard key={order.order_id} order={order} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order }) {
  const needsPayment =
    order.payment_status === PAYMENT.PENDING || order.payment_status === PAYMENT.REJECTED;
  const isLive = LIVE_STATES.includes(order.order_status);

  return (
    <article className={`myorder-card ${isLive ? "is-live" : ""}`}>
      <header className="myorder-card-head">
        <div>
          <span className="myorder-card-token">#{order.daily_order_number}</span>
          <span className="myorder-card-id">{order.order_id}</span>
        </div>
        <span className="myorder-card-amount">₹{order.total_amount}</span>
      </header>

      <div className="myorder-card-statuses">
        <span className={`status-chip status-${order.order_status}`}>
          {FULFILLMENT_LABEL[order.order_status] || order.order_status}
        </span>
        <span className={`status-chip status-pay-${order.payment_status}`}>
          {PAYMENT_LABEL[order.payment_status] || order.payment_status}
        </span>
      </div>

      <ul className="myorder-card-items">
        {(order.items || []).map((item, i) => (
          <li key={`${item.key || item.id}-${i}`}>
            {item.qty}× {item.name}
          </li>
        ))}
      </ul>

      <footer className="myorder-card-foot">
        <span className="myorder-card-meta">
          {order.order_type === "dine-in"
            ? `Dine-in · Table ${order.table_number}`
            : "Pickup"}
          {" · "}
          {new Date(order.created_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>

        {needsPayment && order.order_status !== FULFILLMENT.CANCELLED ? (
          <Link href={`/customer/pay/${order.order_id}`} className="btn-primary btn-small">
            Pay now →
          </Link>
        ) : (
          <Link href={`/customer/pay/${order.order_id}`} className="btn-secondary btn-small">
            Details
          </Link>
        )}
      </footer>
    </article>
  );
}
