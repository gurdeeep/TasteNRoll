"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";

// Pages that already show the cart and its call to action. Repeating the bar
// there duplicated the button and covered the page's own footer.
const HIDDEN_SEGMENTS = ["/cart", "/checkout", "/order-success", "/pay", "/orders"];

export default function FloatingCart() {
  const { totalItems, totalPrice } = useCart();
  const pathname = usePathname();

  // The counter and the customer site each keep their own basket, so the bar
  // has to send you to the cart for the area you are actually in.
  const isOwner = pathname.startsWith("/owner");
  const base = isOwner ? "/owner" : "/customer";

  if (totalItems === 0) return null;
  if (HIDDEN_SEGMENTS.some((seg) => pathname.startsWith(`${base}${seg}`))) return null;
  // Never over the entry gate or the login screens.
  if (!pathname.startsWith("/owner") && !pathname.startsWith("/customer")) return null;

  return (
    <div className="floating-cart">
      <div className="floating-cart-info">
        <span className="floating-cart-count">
          {totalItems} item{totalItems > 1 ? "s" : ""}
        </span>
        <span className="floating-cart-divider">•</span>
        <span className="floating-cart-total">₹{totalPrice}</span>
      </div>
      <Link href={`${base}/cart`} className="floating-cart-btn">
        Review Order →
      </Link>
    </div>
  );
}
