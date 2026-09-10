"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useSession } from "../context/SessionContext";

// One navbar, two areas. The links are handed in by whichever area layout
// rendered it, so the counter's Dashboard link can never appear on the
// customer site and vice versa.
export default function Navbar({ links = [], role = "customer", homeHref = "/" }) {
  const pathname = usePathname();
  const { totalItems, totalPrice } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { owner, customer, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState({ unpaid: 0, live: 0 });

  const who = role === "owner" ? owner : customer;
  const cartHref = role === "owner" ? "/owner/cart" : "/customer/cart";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Only the counter has counters to poll. A customer's navbar makes no
  // background requests at all.
  useEffect(() => {
    if (role !== "owner") return;

    let cancelled = false;
    const load = async () => {
      try {
        const [unpaidRes, liveRes] = await Promise.all([
          fetch("/api/orders?status=unpaid"),
          fetch("/api/owner/orders"),
        ]);
        const unpaid = unpaidRes.ok ? await unpaidRes.json() : null;
        const live = liveRes.ok ? await liveRes.json() : null;
        if (cancelled) return;
        setBadges({
          unpaid: unpaid?.orders?.length || 0,
          live: live?.orders?.length || 0,
        });
      } catch {
        /* a failed badge poll is not worth interrupting anyone over */
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [role, pathname]);

  const badgeFor = (link) => {
    const count = link.badge ? badges[link.badge] : 0;
    return count > 0 ? count : null;
  };

  const renderLink = (link, onNavigate) => {
    const badge = badgeFor(link);
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`${pathname === link.href ? "active" : ""} ${badge ? "has-badge" : ""}`}
        onClick={onNavigate}
      >
        <span aria-hidden="true">{link.icon}</span>
        {link.label}
        {badge && <span className="nav-badge">{badge}</span>}
      </Link>
    );
  };

  return (
    <nav className={`navbar ${role === "owner" ? "navbar-owner" : ""}`}>
      <div className="navbar-inner">
        <Link href={homeHref} className="navbar-logo">
          <Image
            src="/brand/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            aria-hidden="true"
            priority
          />
          <span className="navbar-brand-text">Taste N&apos; RoLLs</span>
          {role === "owner" && <span className="navbar-role-tag">Counter</span>}
        </Link>

        <div className="navbar-links">
          {links.map((link) => {
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

          <Link href={cartHref} className="cart-btn">
            🧾
            <span className="cart-btn-label">Bill</span>
            {totalItems > 0 && (
              <>
                <span className="cart-badge">{totalItems}</span>
                <span className="cart-price">₹{totalPrice}</span>
              </>
            )}
          </Link>

          {who && (
            <button
              className="navbar-logout"
              onClick={() => logout(role)}
              title={role === "owner" ? "Sign out of the counter" : `Signed in as ${who.name}`}
            >
              <span aria-hidden="true">⏻</span>
              <span className="navbar-logout-label">Sign out</span>
            </button>
          )}

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
          {links.map((link) => renderLink(link, () => setOpen(false)))}
          {who && (
            <button className="navbar-sheet-logout" onClick={() => logout(role)}>
              <span aria-hidden="true">⏻</span> Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
