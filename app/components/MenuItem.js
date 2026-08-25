"use client";
import { useState } from "react";
import { useCart } from "../context/CartContext";
import { pizzaAddOns, generalAddOns } from "../data/menu";
import DishArt from "./DishArt";

export default function MenuItem({ item, categoryType, labels, isPizza, addonEligible }) {
  const { addToCart, cart } = useCart();
  const [popup, setPopup] = useState(null); // { variant, price, sizeKey, type: 'pizza' | 'general' }
  const [selectedAddOns, setSelectedAddOns] = useState({});

  const isInCart = (variant) => cart.some((c) => c.key === `${item.id}-${variant}`);

  const handleAdd = (variant, price) => {
    if (price === null || price === undefined) return;

    // Pizza items — show pizza add-on popup
    if (isPizza && categoryType === "triple-size") {
      const sizeKey = variant;
      setSelectedAddOns({});
      setPopup({ variant, price, sizeKey, type: "pizza" });
      return;
    }

    // Addon-eligible items (rolls, burgers, sandwiches) — show general addon popup
    if (addonEligible) {
      setSelectedAddOns({});
      setPopup({ variant, price, type: "general" });
      return;
    }

    addToCart({ id: item.id, name: item.name, variant, price });
  };

  const toggleAddOn = (addOnId) => {
    setSelectedAddOns((prev) => ({ ...prev, [addOnId]: !prev[addOnId] }));
  };

  const changeAddOnQty = (id, delta) => {
    setSelectedAddOns((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  // Confirm pizza order with add-ons
  const confirmPizzaOrder = () => {
    const { variant, price, sizeKey } = popup;
    addToCart({ id: item.id, name: item.name, variant, price });

    const sizeLabel = sizeKey === "regular" ? "Regular" : sizeKey === "medium" ? "Medium" : "Large";
    pizzaAddOns.forEach((ao) => {
      if (selectedAddOns[ao.id]) {
        addToCart({
          id: `${item.id}-${ao.id}`,
          name: `${ao.name} (${item.name} - ${sizeLabel})`,
          variant: sizeKey,
          price: ao[sizeKey],
        });
      }
    });

    setPopup(null);
    setSelectedAddOns({});
  };

  // Confirm general add-on order (rolls, burgers, sandwiches)
  const confirmGeneralOrder = () => {
    const { variant, price } = popup;
    addToCart({ id: item.id, name: item.name, variant, price });

    generalAddOns.forEach((ao) => {
      const qty = selectedAddOns[ao.id] || 0;
      if (qty > 0) {
        for (let i = 0; i < qty; i++) {
          addToCart({
            id: `${item.id}-${ao.id}`,
            name: `${ao.name} (${item.name})`,
            variant: "add-on",
            price: ao.price,
          });
        }
      }
    });

    setPopup(null);
    setSelectedAddOns({});
  };

  const skipAddOns = () => {
    const { variant, price } = popup;
    addToCart({ id: item.id, name: item.name, variant, price });
    setPopup(null);
    setSelectedAddOns({});
  };

  const renderPrices = () => {
    if (categoryType === "single") {
      return (
        <div className="menu-item-prices">
          <div className="price-option">
            <button
              className={`price-add-btn ${isInCart("regular") ? "in-cart" : ""}`}
              onClick={() => handleAdd("regular", item.price)}
            >
              ₹{item.price} {isInCart("regular") ? "✓" : "+"}
            </button>
          </div>
        </div>
      );
    }

    if (categoryType === "half-full") {
      return (
        <div className="menu-item-prices">
          {item.half !== null && item.half !== undefined && (
            <div className="price-option">
              <span className="price-label">Half</span>
              <button
                className={`price-add-btn ${isInCart("half") ? "in-cart" : ""}`}
                onClick={() => handleAdd("half", item.half)}
              >
                ₹{item.half} {isInCart("half") ? "✓" : "+"}
              </button>
            </div>
          )}
          <div className="price-option">
            <span className="price-label">Full</span>
            <button
              className={`price-add-btn ${isInCart("full") ? "in-cart" : ""}`}
              onClick={() => handleAdd("full", item.full)}
            >
              ₹{item.full} {isInCart("full") ? "✓" : "+"}
            </button>
          </div>
        </div>
      );
    }

    if (categoryType === "dual-label") {
      return (
        <div className="menu-item-prices">
          <div className="price-option">
            <span className="price-label">{labels?.[0] || "Option 1"}</span>
            <button
              className={`price-add-btn ${isInCart("option1") ? "in-cart" : ""}`}
              onClick={() => handleAdd("option1", item.price1)}
            >
              ₹{item.price1} {isInCart("option1") ? "✓" : "+"}
            </button>
          </div>
          <div className="price-option">
            <span className="price-label">{labels?.[1] || "Option 2"}</span>
            <button
              className={`price-add-btn ${isInCart("option2") ? "in-cart" : ""}`}
              onClick={() => handleAdd("option2", item.price2)}
            >
              ₹{item.price2} {isInCart("option2") ? "✓" : "+"}
            </button>
          </div>
        </div>
      );
    }

    if (categoryType === "triple-size") {
      return (
        <div className="menu-item-prices">
          <div className="price-option">
            <span className="price-label">Regular</span>
            <button
              className={`price-add-btn ${isInCart("regular") ? "in-cart" : ""}`}
              onClick={() => handleAdd("regular", item.regular)}
            >
              ₹{item.regular} {isInCart("regular") ? "✓" : "+"}
            </button>
          </div>
          <div className="price-option">
            <span className="price-label">Medium</span>
            <button
              className={`price-add-btn ${isInCart("medium") ? "in-cart" : ""}`}
              onClick={() => handleAdd("medium", item.medium)}
            >
              ₹{item.medium} {isInCart("medium") ? "✓" : "+"}
            </button>
          </div>
          <div className="price-option">
            <span className="price-label">Large</span>
            <button
              className={`price-add-btn ${isInCart("large") ? "in-cart" : ""}`}
              onClick={() => handleAdd("large", item.large)}
            >
              ₹{item.large} {isInCart("large") ? "✓" : "+"}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const sizeLabel = popup?.sizeKey === "regular" ? "Regular" : popup?.sizeKey === "medium" ? "Medium" : "Large";

  // Calculate general add-on total
  const generalAddOnTotal = popup?.type === "general"
    ? generalAddOns.reduce((sum, ao) => sum + (selectedAddOns[ao.id] || 0) * ao.price, 0)
    : 0;

  return (
    <>
      <div className={`menu-item ${item.veg ? "veg-item" : "nonveg-item"}`}>
        <DishArt id={item.id} name={item.name} size={66} />
        <div className="menu-item-body">
          <div className="menu-item-top">
            <span className="menu-item-name">{item.name}</span>
            <span className={item.veg ? "veg-badge" : "nonveg-badge"}></span>
          </div>
          {item.description && <div className="menu-item-desc">{item.description}</div>}
          {renderPrices()}
        </div>
      </div>

      {/* Pizza Add-On Popup */}
      {popup && popup.type === "pizza" && (
        <div className="addon-overlay" onClick={skipAddOns}>
          <div className="addon-modal" onClick={(e) => e.stopPropagation()}>
            <button className="qr-close" onClick={skipAddOns}>✕</button>
            <div className="addon-modal-icon">
              <DishArt id={item.id} name={item.name} size={76} />
            </div>
            <h3>Customize Your Pizza</h3>
            <p className="addon-modal-sub">
              <strong>{item.name}</strong> — {sizeLabel} (₹{popup.price})
            </p>
            <p className="addon-modal-hint">Would you like to add extras?</p>

            <div className="addon-options">
              {pizzaAddOns.map((ao) => {
                const aoPrice = ao[popup.sizeKey];
                const checked = !!selectedAddOns[ao.id];
                return (
                  <label key={ao.id} className={`addon-option ${checked ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddOn(ao.id)}
                    />
                    <span className="addon-check">{checked ? "✓" : ""}</span>
                    <span className="addon-option-name">{ao.name}</span>
                    <span className="addon-option-price">+ ₹{aoPrice}</span>
                  </label>
                );
              })}
            </div>

            <div className="addon-modal-actions">
              <button className="btn-secondary" onClick={skipAddOns} style={{ flex: 1 }}>
                Skip
              </button>
              <button className="btn-primary" onClick={confirmPizzaOrder} style={{ flex: 1 }}>
                {Object.values(selectedAddOns).some(Boolean) ? "Add with Extras" : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Add-On Popup (for rolls, burgers, sandwiches) */}
      {popup && popup.type === "general" && (
        <div className="addon-overlay" onClick={skipAddOns}>
          <div className="addon-modal addon-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button className="qr-close" onClick={skipAddOns}>✕</button>
            <div className="addon-modal-icon">
              <DishArt id={item.id} name={item.name} size={76} />
            </div>
            <h3>Any add-ons?</h3>
            <p className="addon-modal-sub">
              <strong>{item.name}</strong> — {popup.variant} (₹{popup.price})
            </p>
            <p className="addon-modal-hint">Add extras to this item</p>

            <div className="addon-options">
              {generalAddOns.map((ao) => {
                const qty = selectedAddOns[ao.id] || 0;
                return (
                  <div key={ao.id} className={`addon-option-row ${qty > 0 ? "selected" : ""}`}>
                    <div className="addon-row-left">
                      <span className={ao.veg ? "veg-badge" : "nonveg-badge"} style={{ width: 14, height: 14, borderWidth: 1.5 }}></span>
                      <span className="addon-option-name">{ao.name}</span>
                    </div>
                    <span className="addon-option-price">₹{ao.price}</span>
                    {qty === 0 ? (
                      <button className="addon-add-btn" onClick={() => changeAddOnQty(ao.id, 1)}>
                        ADD
                      </button>
                    ) : (
                      <div className="addon-qty-controls">
                        <button onClick={() => changeAddOnQty(ao.id, -1)}>−</button>
                        <span>{qty}</span>
                        <button onClick={() => changeAddOnQty(ao.id, 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {generalAddOnTotal > 0 && (
              <div className="addon-total">
                Add-ons total: <strong>₹{generalAddOnTotal}</strong>
              </div>
            )}

            <div className="addon-modal-actions">
              <button className="btn-secondary" onClick={skipAddOns} style={{ flex: 1 }}>
                No Extras
              </button>
              <button className="btn-primary" onClick={confirmGeneralOrder} style={{ flex: 1 }}>
                {generalAddOnTotal > 0 ? `Add with ₹${generalAddOnTotal} Extras` : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
