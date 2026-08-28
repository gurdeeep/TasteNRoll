"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

const CartContext = createContext();

// The counter and a customer are two different baskets. If the owner ever opens
// the customer site in the same browser, one must not overwrite the other, so
// each area gets its own localStorage key.
const storageKeyFor = (pathname) =>
  pathname?.startsWith("/owner") ? "rollbox-cart-owner" : "rollbox-cart";

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0); // 0-100

  const pathname = usePathname();
  const storageKey = storageKeyFor(pathname);
  // Which key the in-memory cart currently belongs to. Without this, moving
  // between the two areas would write the old basket into the new key before
  // the load below had a chance to run.
  const loadedKey = useRef(null);

  useEffect(() => {
    if (loadedKey.current === storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setCart(saved ? JSON.parse(saved) : []);
    } catch {
      setCart([]);
    }
    setDiscountPercent(0);
    loadedKey.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey.current !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const key = `${item.id}-${item.variant}`;
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, key, qty: 1 }];
    });
    showToast(`${item.name} added to cart!`);
  }, []);

  const updateQty = useCallback((key, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }, []);

  const removeItem = useCallback((key) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountPercent(0);
  }, []);

  const setDiscount = useCallback((val) => {
    const num = Math.max(0, Math.min(100, parseInt(val) || 0));
    setDiscountPercent(num);
  }, []);

  const showToast = useCallback((message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }, []);

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100)) : 0;
  const totalPrice = subtotal - discountAmount;

  return (
    <CartContext.Provider
      value={{
        cart, addToCart, updateQty, removeItem, clearCart,
        totalItems, totalPrice, subtotal,
        discountPercent, discountAmount, setDiscount,
        toasts, setCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
