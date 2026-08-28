"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./context/SessionContext";
import { SHOP_LOCALITY, SHOP_TAGLINE } from "./data/shop";

// The entry gate. Two doors, nothing else: order as a customer, or open the
// counter as the owner. Anyone already signed in is sent straight through
// rather than being asked to pick again.
export default function EntryGate() {
  const { owner, customer, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (owner) router.replace("/owner/live");
    else if (customer) router.replace("/customer");
  }, [loading, owner, customer, router]);

  return (
    <main className="gate">
      <div className="gate-glow" aria-hidden="true" />

      <div className="gate-inner">
        <div className="gate-brand">
          <Image
            src="/brand/logo-mark.svg"
            alt=""
            width={64}
            height={64}
            priority
            aria-hidden="true"
          />
          <h1>Taste N&apos; RoLLs</h1>
          <p className="gate-tagline">{SHOP_TAGLINE}</p>
          <p className="gate-locality">📍 {SHOP_LOCALITY}</p>
        </div>

        <div className="gate-doors">
          <Link href="/login/customer" className="gate-door gate-door-customer">
            <span className="gate-door-icon" aria-hidden="true">🍽️</span>
            <span className="gate-door-title">Customer</span>
            <span className="gate-door-desc">
              Browse the menu, order from your seat or ahead of time, and pay
              online by UPI.
            </span>
            <span className="gate-door-cta">Sign in to order →</span>
          </Link>

          <Link href="/login/owner" className="gate-door gate-door-owner">
            <span className="gate-door-icon" aria-hidden="true">🧾</span>
            <span className="gate-door-title">Owner</span>
            <span className="gate-door-desc">
              Open the counter: take orders, watch live online orders, confirm
              payments and check the day&apos;s takings.
            </span>
            <span className="gate-door-cta">Owner sign in →</span>
          </Link>
        </div>

        <p className="gate-footnote">
          New here? <Link href="/register">Create a customer account</Link>
        </p>
      </div>
    </main>
  );
}
