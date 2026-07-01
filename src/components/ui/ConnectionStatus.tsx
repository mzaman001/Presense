"use client";

import React from "react";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const status = useRealtimeStatus();

  return (
    <AnimatePresence>
      {status !== "connected" && (
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50",
            "px-4 py-2 rounded-full",
            "backdrop-blur-md border",
            "text-xs font-medium",
            "flex items-center gap-2",
            status === "reconnecting" 
              ? "bg-amber-500/20 border-amber-500/30 text-amber-400" 
              : "bg-red-500/20 border-red-500/30 text-red-400"
          )}
        >
          {status === "reconnecting" && (
            <m.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full"
            />
          )}
          {status === "reconnecting" ? "Reconnecting..." : "Disconnected"}
        </m.div>
      )}
    </AnimatePresence>
  );
}
