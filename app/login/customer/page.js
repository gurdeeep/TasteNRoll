"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../../context/SessionContext";

function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Where the proxy was trying to send them before it asked them to sign in.
  // Only same-site paths are honoured, so this cannot be used to bounce
  // someone to another domain after login.
  const nextParam = params.get("next");
  const destination =
    nextParam &&
    /^\/(?![/\\])/.test(nextParam) // same-site path only: rejects "//evil" and "/\evil"
      ? nextParam
      : "/customer";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign you in");
        setLoading(false);
        return;
      }
      await refresh();
      router.replace(destination);
    } catch {
      setError("Network problem. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <Link href="/" className="auth-back">← Back</Link>

      <div className="auth-head">
        <span className="auth-icon" aria-hidden="true">🍽️</span>
        <h1>Customer sign in</h1>
        <p>Order ahead, pay by UPI, and track it from your phone.</p>
      </div>

      <form onSubmit={submit} className="auth-form">
        <label className="auth-field">
          <span>Mobile number</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className="auth-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
            <button
              type="button"
              className="auth-peek"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="btn-primary auth-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-alt">
        No account yet? <Link href="/register">Create one</Link>
      </p>
      <p className="auth-alt auth-alt-muted">
        Staff? <Link href="/login/owner">Owner sign in</Link>
      </p>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={<div className="auth-card">Loading…</div>}>
        <CustomerLoginForm />
      </Suspense>
    </main>
  );
}
