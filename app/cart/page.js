"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../context/CartContext";
import DishArt from "../components/DishArt";

export default function CartPage() {
  const {
    cart,
    updateQty,
    removeItem,
    totalItems,
    totalPrice,
    subtotal,
    discountPercent,
    discountAmount,
    setDiscount,
  } = useCart();
  const router = useRouter();

  if (cart.length === 0) {
    return (
      <div className="page cart-page">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🧾</div>
          <h2>No items in the order</h2>
          <p>Pick dishes from the menu and they will show up here.</p>
          <Link href="/menu" className="btn-primary">
            Open Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <header className="page-head page-head-left">
        <span className="section-eyebrow">Step 1 of 2</span>
        <h2>Review Order</h2>
        <p>
          {totalItems} item{totalItems > 1 ? "s" : ""} · ₹{totalPrice}
        </p>
      </header>

      <div className="order-layout">
        {/* Items */}
        <div className="order-main">
          <ul className="cart-items">
            {cart.map((item) => (
              <li className="cart-item" key={item.key}>
                <DishArt id={item.id} name={item.name} size={54} />

                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-variant">
                    <span className="variant-word">{item.variant}</span> · ₹{item.price} each
                  </span>
                </div>

                <div className="qty-controls">
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(item.key, -1)}
                    aria-label={`Reduce ${item.name}`}
                  >
                    −
                  </button>
                  <span className="qty-value">{item.qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(item.key, 1)}
                    aria-label={`Add another ${item.name}`}
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-total">₹{item.price * item.qty}</div>

                <button
                  className="cart-item-remove"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remove ${item.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <Link href="/menu" className="add-more-link">
            ＋ Add more items
          </Link>
        </div>

        {/* Bill */}
        <aside className="order-aside">
          <div className="summary-card">
            <h3>Bill Summary</h3>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>

            <div className="discount-input-row">
              <label className="discount-label" htmlFor="discount">
                <span>🏷️ Discount</span>
                {discountAmount > 0 && <span className="discount-badge">−₹{discountAmount}</span>}
              </label>
              <div className="discount-input-group">
                <input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ""}
                  placeholder="0"
                  onChange={(e) => setDiscount(e.target.value)}
                  className="discount-input"
                />
                <span className="discount-input-suffix">%</span>
              </div>
            </div>

            {discountAmount > 0 && (
              <div className="summary-row discount-row">
                <span>Discount ({discountPercent}%)</span>
                <span>−₹{discountAmount}</span>
              </div>
            )}

            <div className="summary-row total">
              <span>Total</span>
              <span>₹{totalPrice}</span>
            </div>

            <button className="pay-btn" onClick={() => router.push("/checkout")}>
              Proceed to Payment →
            </button>
            <p className="summary-note">Customer details and payment come next.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
