"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";

// One list drives the desktop links and the mobile sheet, so the two can never
// drift apart the way they had (Menu appeared in both, Dashboard in only one).
const NAV_LINKS = [
  { href: "/menu", label: "Menu", icon: "📋" },
  { href: "/unpaid", label: "Unpaid", icon: "⏳", badge: "unpaid" },
  { href: "/history", label: "History", icon: "📜" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { totalItems, totalPrice } = useCart();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchUnpaid = async () => {
      try {
        const res = await fetch("/api/orders?status=unpaid");
        const data = await res.json();
        if (data.success) setUnpaidCount(data.orders?.length || 0);
      } catch {}
    };
    fetchUnpaid();
    const interval = setInterval(fetchUnpaid, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const badgeFor = (link) =>
    link.badge === "unpaid" && unpaidCount > 0 ? unpaidCount : null;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo">
          <Image
            src="/brand/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            aria-hidden="true"
            priority
          />
          Taste N&apos; RoLLs
        </Link>

        <div className="navbar-links">
          {NAV_LINKS.map((link) => {
            const badge = badgeFor(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`navbar-link ${pathname === link.href ? "active" : ""} ${
                  badge ? "has-badge" : ""
                }`}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
                {badge && <span className="nav-badge">{badge}</span>}
              </Link>
            );
          })}
        </div>

        <div className="navbar-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <Link href="/cart" className="cart-btn">
            🧾
            <span className="cart-btn-label">Bill</span>
            {totalItems > 0 && (
              <>
                <span className="cart-badge">{totalItems}</span>
                <span className="cart-price">₹{totalPrice}</span>
              </>
            )}
          </Link>

          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <div className="navbar-sheet">
          {NAV_LINKS.map((link) => {
            const badge = badgeFor(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
                {badge && <span className="nav-badge">{badge}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
