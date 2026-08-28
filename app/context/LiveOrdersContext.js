"use client";
import { createContext, useContext } from "react";
import { useLiveOrders } from "../hooks/useLiveOrders";

// The popup lives in the owner layout and the board lives in a page beneath it,
// so on /owner/live both are mounted at once. Calling the hook twice would open
// two websockets and run two polling loops over the same data. This provider
// runs it once in the layout and hands the same state to both.
const LiveOrdersContext = createContext(null);

export function LiveOrdersProvider({ children }) {
  const value = useLiveOrders({ includeFinished: false });
  return (
    <LiveOrdersContext.Provider value={value}>{children}</LiveOrdersContext.Provider>
  );
}

export const useLiveOrdersContext = () => useContext(LiveOrdersContext);
