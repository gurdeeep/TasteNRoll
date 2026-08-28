"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveOrdersContext } from "../context/LiveOrdersContext";
import { PAYMENT, FULFILLMENT } from "../lib/orderStatus";

// ---------------------------------------------------------------------------
// The thing that taps the owner on the shoulder.
//
// Mounted from the owner layout, so it is watching on every counter screen. Two
// kinds of interruption:
//   - a new order arrives (informational: the customer has not paid yet)
//   - a customer submits their UPI reference (actionable: confirm or reject)
//
// `seen_by_owner` is stored per order, so a popup dismissed on the laptop does
// not come back on the next page load — and an order that arrived while nobody
// was looking is still waiting when someone opens the counter.
// ---------------------------------------------------------------------------
export default function NewOrderWatcher() {
  const { orders, transport, applyOrder } = useLiveOrdersContext();
  const router = useRouter();

  const [dismissed, setDismissed] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const alerted = useRef(new Set());

  // Anything unseen and still live deserves attention. Oldest first, so a
  // queue is worked through in the order it formed.
  const queue = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            !o.seen_by_owner &&
            !dismissed.has(`${o.order_id}:${o.payment_status}`) &&
            o.order_status !== FULFILLMENT.CANCELLED &&
            o.order_status !== FULFILLMENT.COMPLETED &&
            (o.payment_status === PAYMENT.SUBMITTED || o.payment_status === PAYMENT.PENDING)
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [orders, dismissed]
  );

  const current = queue[0] || null;

  // Ask once, quietly. If permission is refused, the on-screen popup still works.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Chime plus desktop notification, once per order per state change.
  useEffect(() => {
    if (!current) return;
    const key = `${current.order_id}:${current.payment_status}`;
    if (alerted.current.has(key)) return;
    alerted.current.add(key);

    chime(current.payment_status === PAYMENT.SUBMITTED);

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(
          current.payment_status === PAYMENT.SUBMITTED
            ? `Payment submitted — ₹${current.total_amount}`
            : `New order — ₹${current.total_amount}`,
          {
            body: `${current.customer_name} · ${labelForType(current)}`,
            tag: current.order_id, // replaces rather than stacks
          }
        );
      } catch {
        /* notifications are a nicety, never a requirement */
      }
    }
  }, [current]);

  const act = useCallback(
    async (action) => {
      if (!current || busy) return;
      setBusy(true);
      const key = `${current.order_id}:${current.payment_status}`;
      try {
        const res = await fetch(`/api/owner/orders/${current.order_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.order) applyOrder(data.order);
        // If the write failed, still stop nagging about this exact state —
        // otherwise a server error turns into an un-closeable modal.
        if (!res.ok) setDismissed((prev) => new Set(prev).add(key));
      } catch {
        setDismissed((prev) => new Set(prev).add(key));
      } finally {
        setBusy(false);
      }
    },
    [current, busy, applyOrder]
  );

  // Dismiss locally and mark seen on the server, so a second counter screen
  // stops showing it too.
  const dismiss = useCallback(() => {
    if (!current) return;
    setDismissed((prev) => new Set(prev).add(`${current.order_id}:${current.payment_status}`));
    act("seen");
  }, [current, act]);

  // Escape closes it, the way every other dialog on a laptop does.
  useEffect(() => {
    if (!current) return;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dismiss]);

  if (!current) return null;

  const awaitingPayment = current.payment_status === PAYMENT.PENDING;
  const itemCount = (current.items || []).reduce((sum, i) => sum + (i.qty || 0), 0);

  return (
    <div className="order-popup-backdrop" role="presentation" onClick={dismiss}>
      <div
        className={`order-popup ${awaitingPayment ? "is-pending" : "is-actionable"}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="order-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="order-popup-head">
          <span className="order-popup-pulse" aria-hidden="true" />
          <div>
            <h2 id="order-popup-title">
              {awaitingPayment ? "New online order" : "Payment submitted"}
            </h2>
            <p className="order-popup-sub">
              {awaitingPayment
                ? "Not paid yet. It will chime again when the payment comes in."
                : "Check your UPI app, then confirm or reject below."}
            </p>
          </div>
          <button className="order-popup-close" onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>

        <div className="order-popup-body">
          <div className="order-popup-headline">
            <span className="order-popup-amount">₹{current.total_amount}</span>
            <span className="order-popup-token">#{current.daily_order_number}</span>
          </div>

          <dl className="order-popup-facts">
            <div>
              <dt>Customer</dt>
              <dd>{current.customer_name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                {current.customer_phone ? (
                  <a href={`tel:${current.customer_phone}`}>{current.customer_phone}</a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{labelForType(current)}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{itemCount}</dd>
            </div>
          </dl>

          <ul className="order-popup-items">
            {(current.items || []).map((item, i) => (
              <li key={`${item.key || item.id}-${i}`}>
                <span className="order-popup-qty">{item.qty}×</span>
                <span className="order-popup-item-name">
                  {item.name}
                  {item.variant && item.variant !== "regular" && <em> · {item.variant}</em>}
                </span>
                <span className="order-popup-item-price">₹{item.price * item.qty}</span>
              </li>
            ))}
          </ul>

          {current.customer_note && (
            <p className="order-popup-note">📝 {current.customer_note}</p>
          )}

          {!awaitingPayment && (
            <div className="order-popup-utr">
              <span>UPI reference from the customer</span>
              <code>{current.transaction_id || "—"}</code>
            </div>
          )}
        </div>

        <div className="order-popup-actions">
          {awaitingPayment ? (
            <>
              <button className="btn-secondary" onClick={dismiss} disabled={busy}>
                Got it
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  dismiss();
                  router.push("/owner/live");
                }}
                disabled={busy}
              >
                Open live orders
              </button>
            </>
          ) : (
            <>
              <button className="btn-danger" onClick={() => act("reject-payment")} disabled={busy}>
                Not received
              </button>
              <button className="btn-primary" onClick={() => act("confirm-payment")} disabled={busy}>
                {busy ? "Saving…" : `Confirm ₹${current.total_amount} received`}
              </button>
            </>
          )}
        </div>

        <p className="order-popup-transport">
          {transport === "realtime"
            ? "🟢 Live"
            : transport === "polling"
              ? "🟡 Checking every few seconds"
              : "⚪ Connecting…"}
          {queue.length > 1 && ` · ${queue.length - 1} more waiting`}
        </p>
      </div>
    </div>
  );
}

function labelForType(order) {
  if (order.order_type === "dine-in") {
    return order.table_number ? `Dine-in · Table ${order.table_number}` : "Dine-in";
  }
  return "Pickup";
}

// A short two-tone chime built with the Web Audio API, so there is no audio
// file to ship and nothing to 404. Browsers block audio until the page has been
// interacted with; when that bites, the popup and the desktop notification
// still do the job.
function chime(urgent) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = urgent ? [880, 1174, 880] : [660, 880];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });

    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* silent is fine */
  }
}
