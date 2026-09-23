"use client";

import React, { useEffect, useState } from "react";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Realtime sockets drop and recover in a second or two all the time (tab
// switches, network handoffs). Only speak up if it stays down.
const SHOW_AFTER_MS = 4000;

export function ConnectionStatus() {
  const status = useRealtimeStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "connected") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <AnimatePresence>
      {visible && status !== "connected" && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          // Below the phone top bar (it sat on top of the bar's icons); at
          // the top edge on desktop, where there is no top bar.
          className={cn(
            "fixed left-1/2 z-50 -translate-x-1/2",
            "top-[calc(env(safe-area-inset-top,0px)+var(--mobile-top-bar-h)+8px)] md:top-4",
            "flex items-center gap-2 rounded-full border px-3.5 py-1.5",
            "bg-[var(--surface-dropdown)] shadow-[var(--shadow-dropdown)]",
            "text-[length:var(--text-ui)] font-medium",
            status === "reconnecting"
              ? "border-[var(--status-today-border)] text-[var(--status-today)]"
              : "border-[var(--status-danger-border)] text-[var(--status-danger)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full bg-current",
              status === "reconnecting" && "animate-pulse",
            )}
          />
          {status === "reconnecting" ? "Reconnecting…" : "Live updates paused"}
        </m.div>
      )}
    </AnimatePresence>
  );
}
