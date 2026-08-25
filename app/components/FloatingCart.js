"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";

// Pages that already show the cart and its call to action. Repeating the bar
// there duplicated the button and covered the page's own footer.
const HIDDEN_ON = ["/cart", "/checkout", "/order-success"];

export default function FloatingCart() {
  const { totalItems, totalPrice } = useCart();
  const pathname = usePathname();

  if (totalItems === 0) return null;
  if (HIDDEN_ON.some((path) => pathname.startsWith(path))) return null;

  return (
    <div className="floating-cart">
      <div className="floating-cart-info">
        <span className="floating-cart-count">
          {totalItems} item{totalItems > 1 ? "s" : ""}
        </span>
        <span className="floating-cart-divider">•</span>
        <span className="floating-cart-total">₹{totalPrice}</span>
      </div>
      <Link href="/cart" className="floating-cart-btn">
        Review Order →
      </Link>
    </div>
  );
}
