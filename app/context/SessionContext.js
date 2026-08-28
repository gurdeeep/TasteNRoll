"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// The session cookies are httpOnly, so page JS genuinely cannot read them.
// /api/auth/me is how the UI finds out who is signed in.
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ owner: null, customer: null });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setSession({ owner: data.owner || null, customer: data.customer || null });
    } catch {
      setSession({ owner: null, customer: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(
    async (role) => {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setSession((s) => ({ ...s, [role]: null }));
      router.push("/");
      router.refresh();
    },
    [router]
  );

  return (
    <SessionContext.Provider value={{ ...session, loading, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
