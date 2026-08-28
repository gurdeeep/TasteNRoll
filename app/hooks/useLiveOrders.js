"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "../lib/supabase";
import { FULFILLMENT } from "../lib/orderStatus";

const ACTIVE = [
  FULFILLMENT.AWAITING_PAYMENT,
  FULFILLMENT.NEW,
  FULFILLMENT.PREPARING,
  FULFILLMENT.READY,
];

const POLL_MS = 8000;
const SUBSCRIBE_TIMEOUT_MS = 7000;

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// ---------------------------------------------------------------------------
// The owner's live view of online orders.
//
// Primary transport is Supabase Realtime: the browser opens a websocket with
// the public anon key, then upgrades it with a short-lived token from
// /api/auth/realtime-token so the RLS policy on `orders` lets it read. That
// gives a genuinely instant popup.
//
// If that never connects — no SUPABASE_JWT_SECRET configured, a blocked
// websocket, a flaky network — the hook falls back to polling the owner API.
// The board keeps working either way; only the latency changes.
// ---------------------------------------------------------------------------
export function useLiveOrders({ includeFinished = false } = {}) {
  const [orders, setOrders] = useState([]);
  const [transport, setTransport] = useState("connecting"); // connecting | realtime | polling
  const [loading, setLoading] = useState(true);

  const supabaseRef = useRef(null);
  const channelRef = useRef(null);
  const pollRef = useRef(null);

  // Merges one row into state without disturbing the rest of the board.
  const upsert = useCallback(
    (row) => {
      if (!row || row.source !== "online") return;
      setOrders((prev) => {
        const rest = prev.filter((o) => o.order_id !== row.order_id);
        const keep = includeFinished || ACTIVE.includes(row.order_status);
        return keep ? [row, ...rest].sort(byNewest) : rest;
      });
    },
    [includeFinished]
  );

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/owner/orders${includeFinished ? "?all=1" : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setOrders((data.orders || []).sort(byNewest));
    } catch {
      /* transient; the next tick tries again */
    } finally {
      setLoading(false);
    }
  }, [includeFinished]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setTransport("polling");
    pollRef.current = setInterval(fetchAll, POLL_MS);
  }, [fetchAll]);

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return;
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    // Always load the current board first, so the owner sees something
    // immediately rather than waiting on a websocket handshake.
    fetchAll();

    const connect = async () => {
      let token = null;
      try {
        const res = await fetch("/api/auth/realtime-token", { cache: "no-store" });
        if (res.ok) token = (await res.json()).token;
      } catch {
        /* fall through to polling */
      }
      if (cancelled) return;

      if (!token) {
        startPolling();
        return;
      }

      const supabase = createBrowserClient();
      supabaseRef.current = supabase;

      // Swap the anon identity for the owner token before subscribing.
      // setAuth returns a promise in newer supabase-js and undefined in older.
      try {
        await supabase.realtime.setAuth(token);
      } catch {
        if (!cancelled) startPolling();
        return;
      }
      if (cancelled) return;

      const channel = supabase
        .channel("rollbox-online-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: "source=eq.online" },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setOrders((prev) => prev.filter((o) => o.id !== payload.old?.id));
              return;
            }
            upsert(payload.new);
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            clearTimeout(timeoutId);
            stopPolling();
            setTransport("realtime");
            fetchAll(); // catch anything that landed during the handshake
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            startPolling();
          }
        });

      channelRef.current = channel;

      // Belt and braces: if SUBSCRIBED never arrives, start polling anyway.
      timeoutId = setTimeout(() => {
        if (!cancelled) startPolling();
      }, SUBSCRIBE_TIMEOUT_MS);
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      stopPolling();
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  }, [fetchAll, startPolling, stopPolling, upsert]);

  // A laptop that has been asleep misses every websocket event. Refetch on
  // wake so the board is never quietly stale.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fetchAll);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fetchAll);
    };
  }, [fetchAll]);

  return { orders, transport, loading, refresh: fetchAll, applyOrder: upsert };
}
