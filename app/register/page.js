"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../context/SessionContext";

// Mirrors the server rules in app/lib/password.js. The server is the one that
// decides; this just saves a round trip and tells people the rules up front.
function passwordProblem(pw) {
  if (pw.length < 8) return "At least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Needs at least one letter";
  if (!/[0-9]/.test(pw)) return "Needs at least one number";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useSession();

  const [form, setForm] = useState({ name: "", phone: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const pwProblem = form.password ? passwordProblem(form.password) : null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (pwProblem) return setError(pwProblem);
    if (form.password !== form.confirm) return setError("The two passwords do not match");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create your account");
        setLoading(false);
        return;
      }
      await refresh();
      router.replace("/customer");
    } catch {
      setError("Network problem. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/login/customer" className="auth-back">← Back to sign in</Link>

        <div className="auth-head">
          <span className="auth-icon" aria-hidden="true">✨</span>
          <h1>Create your account</h1>
          <p>Takes a moment. Your number is how we find your order.</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label className="auth-field">
            <span>Your name</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={change}
              placeholder="Name for the order"
              required
            />
          </label>

          <label className="auth-field">
            <span>Mobile number</span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={form.phone}
              onChange={change}
              placeholder="10-digit mobile number"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-password">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={change}
                placeholder="8+ characters, with a number"
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
            {pwProblem && <span className="auth-hint">{pwProblem}</span>}
          </label>

          <label className="auth-field">
            <span>Confirm password</span>
            <input
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirm}
              onChange={change}
              required
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="auth-alt">
          Already have an account? <Link href="/login/customer">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
