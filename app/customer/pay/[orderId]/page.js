"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildUpiLink, UPI_VPA, UPI_PAYEE_NAME } from "../../../lib/upi";
import { PAYMENT, FULFILLMENT, FULFILLMENT_LABEL } from "../../../lib/orderStatus";

// ---------------------------------------------------------------------------
// The payment screen.
//
// There is no gateway in this flow, so nothing calls back to say the money
// landed. What we can do is make paying as close to one tap as possible — a
// scannable QR on a laptop, a real upi:// intent on a phone — and then collect
// the UPI reference so the owner can match it against their own app.
//
// Until the owner confirms, this page tells the customer exactly that, rather
// than pretending the order is paid.
// ---------------------------------------------------------------------------
const POLL_MS = 5000;

export default function PayPage() {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState("");
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Could not load this order");
        return;
      }
      setOrder(data.order);
    } catch {
      setLoadError("Network problem. Pull down to retry.");
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const upiLink = useMemo(() => {
    if (!order) return null;
    return buildUpiLink({
      amount: order.total_amount,
      txnRef: order.upi_txn_ref,
      note: `Order ${order.order_id}`,
    });
  }, [order]);

  // The QR encodes the same intent URL as the button, amount included, so a
  // scan from any UPI app opens with the right figure already filled in.
  useEffect(() => {
    if (!upiLink) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(upiLink, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#111111", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  // Once the customer says they have paid, watch for the owner confirming it.
  const waitingOnOwner = order?.payment_status === PAYMENT.SUBMITTED;
  useEffect(() => {
    if (!waitingOnOwner) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [waitingOnOwner, load]);

  const copy = async (value, what) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      /* clipboard blocked; the value is on screen to read anyway */
    }
  };

  const submitUtr = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Could not record your payment");
        setSubmitting(false);
        return;
      }
      setOrder(data.order);
      setUtr("");
    } catch {
      setFormError("Network problem. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="page pay-page">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">😕</div>
          <h2>{loadError}</h2>
          <Link href="/customer/orders" className="btn-primary">My Orders</Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page pay-page">
        <div className="pay-loading">Loading your order…</div>
      </div>
    );
  }

  const paid = order.payment_status === PAYMENT.PAID;
  const rejected = order.payment_status === PAYMENT.REJECTED;
  const cancelled = order.order_status === FULFILLMENT.CANCELLED;

  // ---------------------- paid ----------------------
  if (paid) {
    return (
      <div className="page pay-page">
        <div className="pay-result pay-result-good">
          <div className="pay-result-icon" aria-hidden="true">✅</div>
          <h1>Payment confirmed</h1>
          <p>
            Order <strong>#{order.daily_order_number}</strong> is with the
            kitchen. {order.order_type === "dine-in"
              ? `We will bring it to table ${order.table_number}.`
              : "We will have it ready at the counter."}
          </p>
          <div className="pay-status-chip">
            {FULFILLMENT_LABEL[order.order_status] || "Preparing"}
          </div>
          <div className="pay-result-actions">
            <Link href="/customer/orders" className="btn-primary">Track my orders</Link>
            <Link href="/customer/menu" className="btn-secondary">Order something else</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------- cancelled ----------------------
  if (cancelled) {
    return (
      <div className="page pay-page">
        <div className="pay-result">
          <div className="pay-result-icon" aria-hidden="true">🚫</div>
          <h1>This order was cancelled</h1>
          <p>Nothing has been charged. You can place a fresh order any time.</p>
          <Link href="/customer/menu" className="btn-primary">Back to the menu</Link>
        </div>
      </div>
    );
  }

  // ---------------------- waiting on the owner ----------------------
  if (waitingOnOwner) {
    return (
      <div className="page pay-page">
        <div className="pay-result pay-result-waiting">
          <div className="pay-result-icon pay-spinner" aria-hidden="true">⏳</div>
          <h1>Checking your payment</h1>
          <p>
            We have your reference <code>{order.transaction_id}</code>. The cafe
            is matching it against their UPI app — this usually takes under a
            minute. This page updates on its own.
          </p>
          <OrderSummary order={order} />
          <p className="pay-fineprint">
            Do not pay again. If something looks wrong, call the cafe and quote
            order {order.order_id}.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------- pay now ----------------------
  return (
    <div className="page pay-page">
      <div className="page-header">
        <h1>Pay ₹{order.total_amount}</h1>
        <p>
          Order <strong>#{order.daily_order_number}</strong> is held for you.
          It reaches the kitchen once the payment is confirmed.
        </p>
      </div>

      {rejected && (
        <div className="pay-alert" role="alert">
          <strong>The cafe could not find that payment.</strong> Check your UPI
          app, then pay again below or re-enter the correct reference number.
        </div>
      )}

      <div className="pay-layout">
        <div className="pay-main">
          {!UPI_VPA ? (
            <div className="pay-alert" role="alert">
              <strong>Online payment is not configured yet.</strong> The cafe
              needs to set its UPI ID. Please pay at the counter and quote order{" "}
              {order.order_id}.
            </div>
          ) : (
            <>
              <section className="pay-card">
                <h2>1 · Pay by UPI</h2>

                <a className="pay-intent-btn" href={upiLink}>
                  <span aria-hidden="true">📲</span>
                  Open my UPI app and pay ₹{order.total_amount}
                </a>
                <p className="pay-hint">
                  On a phone this opens GPay, PhonePe, Paytm or whichever UPI app
                  you use, with the amount already filled in.
                </p>

                <div className="pay-or"><span>or scan</span></div>

                <div className="pay-qr">
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrDataUrl}
                      alt={`UPI QR code to pay ₹${order.total_amount} to ${UPI_PAYEE_NAME}`}
                      width={260}
                      height={260}
                    />
                  ) : (
                    <div className="pay-qr-placeholder">Generating QR…</div>
                  )}
                  <p className="pay-qr-caption">
                    Scan with any UPI app · ₹{order.total_amount} pre-filled
                  </p>
                </div>

                <div className="pay-vpa">
                  <div>
                    <span className="pay-vpa-label">UPI ID</span>
                    <strong>{UPI_VPA}</strong>
                  </div>
                  <button type="button" onClick={() => copy(UPI_VPA, "vpa")}>
                    {copied === "vpa" ? "Copied ✓" : "Copy"}
                  </button>
                </div>

                <div className="pay-vpa">
                  <div>
                    <span className="pay-vpa-label">Reference to quote</span>
                    <strong>{order.upi_txn_ref}</strong>
                  </div>
                  <button type="button" onClick={() => copy(order.upi_txn_ref, "ref")}>
                    {copied === "ref" ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </section>

              <section className="pay-card">
                <h2>2 · Tell us it is done</h2>
                <p className="pay-hint">
                  After paying, your UPI app shows a UTR or transaction reference
                  number. Enter it here so the cafe can match it.
                </p>

                <form className="pay-utr-form" onSubmit={submitUtr}>
                  <label className="checkout-field">
                    <span>UPI reference / UTR number</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      placeholder="e.g. 412345678901"
                      maxLength={30}
                      required
                    />
                  </label>

                  {formError && <p className="auth-error" role="alert">{formError}</p>}

                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Sending…" : "I have paid"}
                  </button>
                </form>
              </section>
            </>
          )}
        </div>

        <aside className="order-aside">
          <OrderSummary order={order} />
        </aside>
      </div>
    </div>
  );
}

function OrderSummary({ order }) {
  return (
    <div className="summary-card">
      <h3>Order {order.order_id}</h3>
      <ul className="summary-items">
        {(order.items || []).map((item, i) => (
          <li key={`${item.key || item.id}-${i}`}>
            <span className="summary-item-qty">{item.qty}×</span>
            <span className="summary-item-name">{item.name}</span>
            <span className="summary-item-price">₹{item.price * item.qty}</span>
          </li>
        ))}
      </ul>
      <div className="summary-row total">
        <span>Total</span>
        <span>₹{order.total_amount}</span>
      </div>
      <p className="summary-note">
        {order.order_type === "dine-in"
          ? `Dine-in · Table ${order.table_number}`
          : "Pickup at the counter"}
      </p>
    </div>
  );
}
