"use client";
import Link from "next/link";
import { menuData } from "../data/menu";
import { useCart } from "../context/CartContext";
import DishArt from "../components/DishArt";
import {
  SHOP_ADDRESS,
  SHOP_ENQUIRY,
  SHOP_LOCALITY,
  SHOP_PHONE,
  SHOP_TAGLINE,
} from "../data/shop";

// Artwork drifting behind the hero. Positioned off the reading column so the
// wordmark stays clean on every width.
const heroDishes = [
  { categoryId: "veg-rolls", left: "6%", top: "16%", size: 132, delay: "0s" },
  { categoryId: "basic-pizza", left: "80%", top: "13%", size: 148, delay: "1.2s" },
  { categoryId: "burgers", left: "84%", top: "62%", size: 120, delay: "2.4s" },
  { categoryId: "fries", left: "9%", top: "66%", size: 112, delay: "0.8s" },
  { categoryId: "mojitos", left: "72%", top: "84%", size: 96, delay: "3s" },
  { categoryId: "momos", left: "20%", top: "86%", size: 100, delay: "1.8s" },
];

// The counter favourites, shown with their real menu prices.
const signatures = [
  { catId: "veg-rolls", itemId: "vr7", blurb: "Soft paneer, fresh masala, rolled hot" },
  { catId: "chicken-rolls", itemId: "ckr6", blurb: "Smoky tandoori chicken in a warm wrap" },
  { catId: "amazing-pizza", itemId: "ap3", blurb: "Our house special, loaded to the edge" },
  { catId: "momos", itemId: "mm3", blurb: "Crunchy kurkure coating, spicy chutney" },
  { catId: "fries", itemId: "fr6", blurb: "Overloaded, cheesy, impossible to share" },
  { catId: "mojitos", itemId: "mj1", blurb: "Cold mint mojito to cut the spice" },
];

// Lowest listed price for an item, whatever pricing shape its category uses.
function startingPrice(item) {
  const candidates = [item.price, item.half, item.full, item.price1, item.price2, item.regular];
  const found = candidates.find((p) => typeof p === "number");
  return found ?? null;
}

function useSignatureDishes() {
  return signatures
    .map(({ catId, itemId, blurb }) => {
      const category = menuData.find((c) => c.id === catId);
      const item = category?.items.find((i) => i.id === itemId);
      if (!item) return null;
      return { item, categoryId: catId, blurb, from: startingPrice(item) };
    })
    .filter(Boolean);
}

export default function CustomerHome() {
  const totalItems = menuData.reduce((sum, cat) => sum + cat.items.length, 0);
  const { totalItems: cartCount, totalPrice } = useCart();
  const dishes = useSignatureDishes();

  return (
    <>
      <section className="hero" id="hero">
        {/* Steam rising off the counter */}
        <div className="hero-steam" aria-hidden="true">
          <span style={{ left: "18%", animationDelay: "0s" }} />
          <span style={{ left: "46%", animationDelay: "4s" }} />
          <span style={{ left: "72%", animationDelay: "8s" }} />
        </div>

        {/* Dish illustrations, dimmed into the background */}
        <div className="hero-dishes" aria-hidden="true">
          {heroDishes.map((dish, i) => (
            <div
              key={i}
              className="hero-dish"
              style={{
                left: dish.left,
                top: dish.top,
                animationDelay: dish.delay,
                animationDuration: `${8 + i * 0.9}s`,
              }}
            >
              <DishArt categoryId={dish.categoryId} size={dish.size} />
            </div>
          ))}
        </div>

        <div className="hero-content">
          <p className="hero-eyebrow">Cafe &amp; Rolls</p>
          <h1>Taste N&apos; RoLLs</h1>
          <div className="hero-rule" aria-hidden="true">
            <span>✦</span>
          </div>
          <p className="hero-tagline">{SHOP_TAGLINE}</p>
          <p>
            Rolls off the tawa, wood-fired pizzas, steaming momos and cold
            mojitos — made fresh to order, never sitting under a lamp.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value" style={{ color: "var(--gold)" }}>
                {totalItems}+
              </div>
              <div className="hero-stat-label">On the Menu</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value" style={{ color: "var(--green)" }}>
                {cartCount}
              </div>
              <div className="hero-stat-label">In Cart</div>
            </div>
            {cartCount > 0 && (
              <div className="hero-stat">
                <div className="hero-stat-value" style={{ color: "var(--accent-light)" }}>
                  ₹{totalPrice}
                </div>
                <div className="hero-stat-label">Bill Amount</div>
              </div>
            )}
          </div>

          <div className="hero-actions">
            <Link
              href="/customer/menu"
              className="btn-primary"
              style={{ fontSize: "1.05rem", padding: "1.05rem 2.6rem" }}
            >
              Explore the Menu
            </Link>
            {cartCount > 0 && (
              <Link
                href="/customer/cart"
                className="btn-secondary"
                style={{ fontSize: "1.05rem", padding: "1.05rem 2.6rem" }}
              >
                🧾 View Bill ({cartCount})
              </Link>
            )}
          </div>

          <p className="hero-locality">📍 {SHOP_LOCALITY}</p>
        </div>

        <div className="hero-scroll" aria-hidden="true">
          <span>Menu</span>
          <i />
        </div>
      </section>

      {/* ===== Signature dishes ===== */}
      <section className="signature">
        <div className="section-header">
          <span className="section-eyebrow">From our counter</span>
          <h2>Signature Favourites</h2>
          <p>The ones regulars order without looking at the menu</p>
          <div className="section-flourish" aria-hidden="true">
            <span>✦</span>
          </div>
        </div>

        <div className="signature-grid">
          {dishes.map(({ item, categoryId, blurb, from }) => (
            <Link href="/customer/menu" className="dish-card" key={item.id}>
              <DishArt id={item.id} name={item.name} categoryId={categoryId} size={104} />
              <span className="dish-card-name">{item.name}</span>
              <span className="dish-card-desc">{blurb}</span>
              {from !== null && <span className="dish-card-price">from ₹{from}</span>}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== Why us + visit ===== */}
      <section className="story">
        <div className="section-header">
          <span className="section-eyebrow">Why Taste N&apos; RoLLs</span>
          <h2>Made Fresh, Every Order</h2>
          <div className="section-flourish" aria-hidden="true">
            <span>✦</span>
          </div>
        </div>

        <div className="story-inner">
          <div className="story-card">
            <div className="story-card-icon">🔥</div>
            <h3>Cooked to Order</h3>
            <p>
              Nothing is pre-made. Your roll hits the tawa when you order it,
              which is why it reaches you hot and still crisp at the edges.
            </p>
          </div>
          <div className="story-card">
            <div className="story-card-icon">🌿</div>
            <h3>Fresh Ingredients</h3>
            <p>
              Vegetables chopped the same morning, paneer and cheese from
              trusted local suppliers, and masalas ground in-house.
            </p>
          </div>
          <div className="story-card">
            <div className="story-card-icon">🧾</div>
            <h3>Honest Billing</h3>
            <p>
              Every order gets a printed bill with the exact items and prices
              you see on the menu. No surprises at the counter.
            </p>
          </div>
        </div>

        <div className="visit-card">
          <div className="visit-card-main">
            <h3>Come Visit Us</h3>
            <p>{SHOP_ADDRESS}</p>
            <div className="visit-card-contacts">
              <a className="visit-chip" href={`tel:${SHOP_PHONE.replace(/-/g, "")}`}>
                📞 {SHOP_PHONE}
              </a>
              <a className="visit-chip" href={`tel:${SHOP_ENQUIRY.replace(/-/g, "")}`}>
                💬 {SHOP_ENQUIRY}
              </a>
            </div>
          </div>
          <Link href="/customer/menu" className="btn-primary">
            Start an Order
          </Link>
        </div>
      </section>
    </>
  );
}
