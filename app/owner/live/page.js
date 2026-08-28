"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveOrdersContext } from "../../context/LiveOrdersContext";
import { PAYMENT, FULFILLMENT, FULFILLMENT_LABEL } from "../../lib/orderStatus";

// ---------------------------------------------------------------------------
// The live board. The popup in the owner layout interrupts; this is where the
// owner works through the queue properly.
//
// Three columns, in the order the owner actually cares about them:
//   Needs you   — a payment claimed and waiting to be checked
//   Kitchen     — paid, being made
//   Waiting     — placed, customer has not paid yet
// ---------------------------------------------------------------------------
export default function LiveOrdersPage() {
  const { orders, transport, loading, refresh, applyOrder } = useLiveOrdersContext();
  const [busyId, setBusyId] = useState(null);

  // One clock for the whole board, ticked on an interval, so the "12 min ago"
  // labels stay honest without any card reading the clock during render.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const act = useCallback(
    async (orderId, action) => {
      setBusyId(orderId);
      try {
        const res = await fetch(`/api/owner/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.order) applyOrder(data.order);
        else refresh();
      } catch {
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [applyOrder, refresh]
  );

  const columns = useMemo(() => {
    const needsYou = orders.filter((o) => o.payment_status === PAYMENT.SUBMITTED);
    const kitchen = orders.filter(
      (o) =>
        o.payment_status === PAYMENT.PAID &&
        [FULFILLMENT.PREPARING, FULFILLMENT.READY, FULFILLMENT.NEW].includes(o.order_status)
    );
    const waiting = orders.filter(
      (o) =>
        o.payment_status === PAYMENT.PENDING || o.payment_status === PAYMENT.REJECTED
    );
    return { needsYou, kitchen, waiting };
  }, [orders]);

  return (
    <div className="page live-page">
      <div className="page-header live-header">
        <div>
          <h1>Live orders</h1>
          <p>Online orders as they come in. Confirm the money before the food.</p>
        </div>
        <div className="live-transport">
          <span className={`live-dot live-dot-${transport}`} aria-hidden="true" />
          {transport === "realtime"
            ? "Live"
            : transport === "polling"
              ? "Polling"
              : "Connecting…"}
          <button className="live-refresh" onClick={refresh} aria-label="Refresh now">
            ↻
          </button>
        </div>
      </div>

      {transport === "polling" && (
        <p className="live-notice">
          Realtime is not connected, so this board refreshes every few seconds
          instead. Set <code>SUPABASE_JWT_SECRET</code> and enable Realtime on
          the <code>orders</code> table to get instant updates.
        </p>
      )}

      {loading ? (
        <div className="pay-loading">Loading the board…</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🔔</div>
          <h2>Nothing waiting</h2>
          <p>New online orders will appear here, and pop up wherever you are.</p>
        </div>
      ) : (
        <div className="live-columns">
          <LiveColumn
            title="Needs you"
            tone="urgent"
            hint="Check your UPI app, then confirm"
            orders={columns.needsYou}
            busyId={busyId}
            act={act}
            now={now}
          />
          <LiveColumn
            title="Kitchen"
            tone="active"
            hint="Paid and being made"
            orders={columns.kitchen}
            busyId={busyId}
            act={act}
            now={now}
          />
          <LiveColumn
            title="Waiting on payment"
            tone="idle"
            hint="Placed, not paid yet"
            orders={columns.waiting}
            busyId={busyId}
            act={act}
            now={now}
          />
        </div>
      )}
    </div>
  );
}

function LiveColumn({ title, tone, hint, orders, busyId, act, now }) {
  return (
    <section className={`live-column live-column-${tone}`}>
      <header className="live-column-head">
        <h2>
          {title} <span className="live-column-count">{orders.length}</span>
        </h2>
        <p>{hint}</p>
      </header>

      {orders.length === 0 ? (
        <p className="live-column-empty">Nothing here</p>
      ) : (
        orders.map((order) => (
          <LiveOrderCard
            key={order.order_id}
            order={order}
            busy={busyId === order.order_id}
            act={act}
            now={now}
          />
        ))
      )}
    </section>
  );
}

function LiveOrderCard({ order, busy, act, now }) {
  const submitted = order.payment_status === PAYMENT.SUBMITTED;
  const paid = order.payment_status === PAYMENT.PAID;

  // `now` is passed down rather than read from the clock here: calling
  // Date.now() during render is impure, and it would also make the server and
  // client markup disagree on hydration.
  const minutesAgo = Math.max(
    0,
    Math.round((now - new Date(order.created_at).getTime()) / 60000)
  );

  return (
    <article className={`live-card ${submitted ? "live-card-urgent" : ""}`}>
      <header className="live-card-head">
        <span className="live-card-token">#{order.daily_order_number}</span>
        <span className="live-card-amount">₹{order.total_amount}</span>
      </header>

      <p className="live-card-who">
        <strong>{order.customer_name}</strong>
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="live-card-phone">
            📞 {order.customer_phone}
          </a>
        )}
      </p>

      <p className="live-card-type">
        {order.order_type === "dine-in"
          ? `🍽️ Dine-in · Table ${order.table_number}`
          : "🛍️ Pickup"}
        <span className="live-card-age">{minutesAgo} min ago</span>
      </p>

      <ul className="live-card-items">
        {(order.items || []).map((item, i) => (
          <li key={`${item.key || item.id}-${i}`}>
            <span>{item.qty}×</span> {item.name}
            {item.variant && item.variant !== "regular" && <em> · {item.variant}</em>}
          </li>
        ))}
      </ul>

      {order.customer_note && <p className="live-card-note">📝 {order.customer_note}</p>}

      {submitted && (
        <div className="live-card-utr">
          <span>UPI reference</span>
          <code>{order.transaction_id || "—"}</code>
        </div>
      )}

      {order.payment_status === PAYMENT.REJECTED && (
        <p className="live-card-rejected">
          Marked not received. The customer has been asked to pay again.
        </p>
      )}

      <div className="live-card-actions">
        {submitted && (
          <>
            <button className="btn-danger btn-small" onClick={() => act(order.order_id, "reject-payment")} disabled={busy}>
              Not received
            </button>
            <button className="btn-primary btn-small" onClick={() => act(order.order_id, "confirm-payment")} disabled={busy}>
              {busy ? "…" : "Confirm payment"}
            </button>
          </>
        )}

        {paid && order.order_status === FULFILLMENT.PREPARING && (
          <button className="btn-primary btn-small" onClick={() => act(order.order_id, "ready")} disabled={busy}>
            Mark ready
          </button>
        )}

        {paid && order.order_status === FULFILLMENT.READY && (
          <button className="btn-primary btn-small" onClick={() => act(order.order_id, "complete")} disabled={busy}>
            Handed over
          </button>
        )}

        {!submitted && !paid && (
          <button className="btn-danger btn-small" onClick={() => act(order.order_id, "cancel")} disabled={busy}>
            Cancel order
          </button>
        )}
      </div>

      <p className="live-card-status">{FULFILLMENT_LABEL[order.order_status] || order.order_status}</p>
    </article>
  );
}
