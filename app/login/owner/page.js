"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../../context/SessionContext";

function OwnerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextParam = params.get("next");
  const destination =
    nextParam &&
    /^\/(?![/\\])/.test(nextParam) // same-site path only: rejects "//evil" and "/\evil"
      ? nextParam
      : "/owner/live";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
    <div className="auth-card auth-card-owner">
      <Link href="/" className="auth-back">← Back</Link>

      <div className="auth-head">
        <span className="auth-icon" aria-hidden="true">🧾</span>
        <h1>Owner sign in</h1>
        <p>The counter, the live orders board and the day&apos;s takings.</p>
      </div>

      <form onSubmit={submit} className="auth-form">
        <label className="auth-field">
          <span>Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="owner"
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
          {loading ? "Signing in…" : "Open the counter"}
        </button>
      </form>

      <p className="auth-alt auth-alt-muted">
        Customer? <Link href="/login/customer">Customer sign in</Link>
      </p>
    </div>
  );
}

export default function OwnerLoginPage() {
  return (
    <main className="auth-page auth-page-owner">
      <Suspense fallback={<div className="auth-card">Loading…</div>}>
        <OwnerLoginForm />
      </Suspense>
    </main>
  );
}
