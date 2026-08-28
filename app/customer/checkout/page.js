"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../context/CartContext";
import { useSession } from "../../context/SessionContext";

// Customer checkout. Deliberately much smaller than the counter one: no cash,
// no split, no unpaid tab, no discount. Online orders are UPI-only, which is
// what makes the flow safe to hand to a stranger with a phone.
export default function CustomerCheckoutPage() {
  const { cart, totalPrice, clearCart } = useCart();
  const { customer } = useSession();
  const router = useRouter();

  const [orderType, setOrderType] = useState("pickup");
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const placeOrder = async (e) => {
    e.preventDefault();
    setError("");

    if (cart.length === 0) return setError("Your cart is empty");
    if (orderType === "dine-in" && !tableNumber.trim()) {
      return setError("Enter your table number so we know where to bring it");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only ids, variants and quantities matter. The server re-prices the
          // whole cart from its own copy of the menu, so a tampered price here
          // changes nothing.
          items: cart.map(({ id, name, variant, qty }) => ({ id, name, variant, qty })),
          orderType,
          tableNumber,
          note,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not place your order");
        setLoading(false);
        return;
      }

      clearCart();
      router.replace(`/customer/pay/${data.orderId}`);
    } catch {
      setError("Network problem. Please try again.");
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="page checkout-page">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🧾</div>
          <h2>Nothing to order yet</h2>
          <p>Add a few things from the menu and come back.</p>
          <Link href="/customer/menu" className="btn-primary">
            Open Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page checkout-page">
      <div className="page-header">
        <h1>Confirm your order</h1>
        <p>Pickup or dine-in, then pay by UPI on the next screen.</p>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={placeOrder}>
          <section className="checkout-section">
            <h2>Who is it for</h2>
            <div className="checkout-identity">
              <div>
                <span className="checkout-identity-label">Name</span>
                <strong>{customer?.name || "—"}</strong>
              </div>
              <div>
                <span className="checkout-identity-label">Mobile</span>
                <strong>{customer?.phone || "—"}</strong>
              </div>
            </div>
            <p className="checkout-hint">
              Taken from your account, so there is nothing to retype.
            </p>
          </section>

          <section className="checkout-section">
            <h2>How would you like it</h2>
            <div className="order-type-choice">
              <button
                type="button"
                className={`order-type-btn ${orderType === "pickup" ? "active" : ""}`}
                onClick={() => setOrderType("pickup")}
              >
                <span aria-hidden="true">🛍️</span>
                <strong>Pickup</strong>
                <em>Collect at the counter</em>
              </button>
              <button
                type="button"
                className={`order-type-btn ${orderType === "dine-in" ? "active" : ""}`}
                onClick={() => setOrderType("dine-in")}
              >
                <span aria-hidden="true">🍽️</span>
                <strong>Dine-in</strong>
                <em>We bring it to your table</em>
              </button>
            </div>

            {orderType === "dine-in" && (
              <label className="checkout-field">
                <span>Table number</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 4"
                  maxLength={10}
                  required
                />
              </label>
            )}
          </section>

          <section className="checkout-section">
            <h2>Anything else</h2>
            <label className="checkout-field">
              <span>Note for the kitchen (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Less spicy, no onion, extra chutney…"
                maxLength={200}
                rows={3}
              />
            </label>
          </section>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="btn-primary checkout-submit" disabled={loading}>
            {loading ? "Placing…" : `Place order · ₹${totalPrice}`}
          </button>

          <Link href="/customer/cart" className="back-link">
            ← Back to cart
          </Link>
        </form>

        <aside className="order-aside">
          <div className="summary-card">
            <h3>Your order</h3>
            <ul className="summary-items">
              {cart.map((item) => (
                <li key={item.key}>
                  <span className="summary-item-qty">{item.qty}×</span>
                  <span className="summary-item-name">{item.name}</span>
                  <span className="summary-item-price">₹{item.price * item.qty}</span>
                </li>
              ))}
            </ul>

            <div className="summary-row total">
              <span>Total</span>
              <span>₹{totalPrice}</span>
            </div>

            <p className="summary-note">
              Payment is online only. The next screen shows the QR code and UPI
              ID to pay with.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
