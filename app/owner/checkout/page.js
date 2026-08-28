"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../../context/CartContext";

export default function CheckoutPage() {
  const { cart, totalPrice, subtotal, discountPercent, discountAmount, clearCart } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Auto-fill the other split field
  const handleSplitCash = (val) => {
    setSplitCash(val);
    const num = parseFloat(val) || 0;
    if (num >= 0 && num <= totalPrice) {
      setSplitUpi(String(totalPrice - num));
    }
  };
  const handleSplitUpi = (val) => {
    setSplitUpi(val);
    const num = parseFloat(val) || 0;
    if (num >= 0 && num <= totalPrice) {
      setSplitCash(String(totalPrice - num));
    }
  };

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    if (!form.name) return alert("Please enter customer name");
    if (cart.length === 0) return alert("No items in the order");

    if (paymentMethod === "split") {
      const cash = parseFloat(splitCash) || 0;
      const upi = parseFloat(splitUpi) || 0;
      if (Math.round(cash + upi) !== totalPrice) {
        return alert(`Cash (₹${cash}) + UPI (₹${upi}) must equal ₹${totalPrice}`);
      }
      placeOrder("Split", cash, upi);
    } else {
      const methodMap = { upi: "UPI", unpaid: "Unpaid", cash: "Cash" };
      placeOrder(methodMap[paymentMethod] || "Cash");
    }
  };

  const placeOrder = async (method, cashAmount = 0, upiAmount = 0) => {
    setLoading(true);
    try {
      const editingOrderId = sessionStorage.getItem("editingOrderId");

      let res;
      let finalOrderId;

      if (editingOrderId) {
        res = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: editingOrderId,
            items: cart,
            total: totalPrice,
            subtotal,
            discountPercent,
            discountAmount,
          }),
        });
        finalOrderId = editingOrderId;
        sessionStorage.removeItem("editingOrderId");
      } else {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: form,
            items: cart,
            total: totalPrice,
            paymentMethod: method,
            subtotal,
            discountPercent,
            discountAmount,
            cashAmount: method === "Split" ? cashAmount : (method === "Cash" ? totalPrice : 0),
            upiAmount: method === "Split" ? upiAmount : (method === "UPI" ? totalPrice : 0),
          }),
        });
      }

      const data = await res.json();

      if (data.success) {
        const usedOrderId = finalOrderId || data.orderId;
        const orderData = {
          orderId: usedOrderId,
          dailyOrderNumber: data.dailyOrderNumber || null,
          method,
          cashAmount: method === "Split" ? cashAmount : 0,
          upiAmount: method === "Split" ? upiAmount : 0,
          customer: form,
          items: [...cart],
          subtotal,
          discountPercent,
          discountAmount,
          total: totalPrice,
          time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        };
        sessionStorage.setItem("lastOrder", JSON.stringify(orderData));
        clearCart();
        router.push(`/owner/order-success?id=${usedOrderId}&method=${encodeURIComponent(method)}`);
      } else {
        alert("Failed to place order. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="page checkout-page">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🧾</div>
          <h2>No items to bill</h2>
          <p>Add items from the menu first.</p>
          <Link href="/owner/menu" className="btn-primary">
            Open Menu
          </Link>
        </div>
      </div>
    );
  }

  const btnLabel = () => {
    if (loading) return "Placing Order...";
    if (paymentMethod === "split") return `Place Order – ₹${totalPrice} (Split)`;
    if (paymentMethod === "unpaid") return `Place Order – ₹${totalPrice} (Unpaid)`;
    return `Place Order – ₹${totalPrice} (${paymentMethod === "upi" ? "UPI" : "Cash"})`;
  };

  const splitEntered = (parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0);
  const splitBalanced = Math.round(splitEntered) === totalPrice;

  return (
    <div className="page checkout-page">
      <header className="page-head page-head-left">
        <span className="section-eyebrow">Step 2 of 2</span>
        <h2>Customer &amp; Payment</h2>
        <p>
          <Link href="/owner/cart" className="back-link">
            ← Back to order
          </Link>
        </p>
      </header>

      <div className="order-layout">
        {/* The form is the task on this page, so it leads */}
        {/* id lets the submit button live in the summary card on the right
            while still submitting this form */}
        <form id="checkout-form" className="order-main checkout-form" onSubmit={handlePlaceOrder}>
          <fieldset className="form-block">
            <legend>Customer details</legend>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Customer name *</label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Who is this order for?"
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Optional — enables SMS & WhatsApp bill"
                  type="tel"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-block">
            <legend>How is the customer paying?</legend>
            <div className="payment-methods">
              <label className={`payment-option ${paymentMethod === "cash" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                />
                <span className="payment-icon" aria-hidden="true">💵</span>
                <span className="payment-text">
                  <strong>Cash</strong>
                  <small>Paid at the counter</small>
                </span>
              </label>
              <label className={`payment-option ${paymentMethod === "upi" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="upi"
                  checked={paymentMethod === "upi"}
                  onChange={() => setPaymentMethod("upi")}
                />
                <span className="payment-icon" aria-hidden="true">📱</span>
                <span className="payment-text">
                  <strong>UPI</strong>
                  <small>Scan and pay</small>
                </span>
              </label>
              <label className={`payment-option ${paymentMethod === "split" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="split"
                  checked={paymentMethod === "split"}
                  onChange={() => {
                    setPaymentMethod("split");
                    setSplitCash(String(totalPrice));
                    setSplitUpi("0");
                  }}
                />
                <span className="payment-icon" aria-hidden="true">💳</span>
                <span className="payment-text">
                  <strong>Split</strong>
                  <small>Part cash, part UPI</small>
                </span>
              </label>
              <label className={`payment-option ${paymentMethod === "unpaid" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="unpaid"
                  checked={paymentMethod === "unpaid"}
                  onChange={() => setPaymentMethod("unpaid")}
                />
                <span className="payment-icon" aria-hidden="true">⏳</span>
                <span className="payment-text">
                  <strong>Unpaid</strong>
                  <small>Runs a tab, settle later</small>
                </span>
              </label>
            </div>

            {paymentMethod === "split" && (
              <div className="split-inputs">
                <div className="split-field">
                  <label htmlFor="split-cash">💵 Cash amount</label>
                  <input
                    id="split-cash"
                    type="number"
                    min="0"
                    max={totalPrice}
                    value={splitCash}
                    onChange={(e) => handleSplitCash(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="split-field">
                  <label htmlFor="split-upi">📱 UPI amount</label>
                  <input
                    id="split-upi"
                    type="number"
                    min="0"
                    max={totalPrice}
                    value={splitUpi}
                    onChange={(e) => handleSplitUpi(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className={`split-total ${splitBalanced ? "ok" : "off"}`}>
                  {splitBalanced ? "✓ Matches total" : `₹${splitEntered} of ₹${totalPrice}`}
                </div>
              </div>
            )}
          </fieldset>
        </form>

        {/* Bill recap stays visible while the form is filled in */}
        <aside className="order-aside">
          <div className="summary-card">
            <h3>Order Summary</h3>

            <ul className="summary-items">
              {cart.map((item) => (
                <li className="summary-item" key={item.key}>
                  <span className="summary-item-qty">{item.qty}×</span>
                  <span className="summary-item-name">
                    {item.name}
                    <small>{item.variant}</small>
                  </span>
                  <span className="summary-item-price">₹{item.price * item.qty}</span>
                </li>
              ))}
            </ul>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            {discountPercent > 0 && (
              <div className="summary-row discount-row">
                <span>Discount ({discountPercent}%)</span>
                <span>−₹{discountAmount}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total</span>
              <span>₹{totalPrice}</span>
            </div>

            <button type="submit" form="checkout-form" className="pay-btn" disabled={loading}>
              {btnLabel()}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
