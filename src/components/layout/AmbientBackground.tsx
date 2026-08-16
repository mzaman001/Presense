"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const MOBILE_CAP_QUERY = "(max-width: 767px)";

/**
 * PERF-03: pause orb animation when the tab is hidden so a backgrounded
 * mobile tab can't accumulate compositor work, and cap the visible orb
 * count on small screens where the extra orbs are mostly clipped off-
 * screen and burn paint for nothing.
 */
export function AmbientBackground() {
  const userSettings = useAppStore(s => s.userSettings);
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const isMobile = useMediaQuery(MOBILE_CAP_QUERY);

  useEffect(() => {
    setMounted(true);
  }, []);

  // PERF-03: pause all orb animation while the tab is hidden.
  useEffect(() => {
    const handleVisibility = () => {
      setPaused(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (!mounted) {
    return (
      <div className="ambient-bg">
        <div className="noise-layer" />
      </div>
    );
  }

  const enabled = userSettings?.ambient_bg !== false && !paused;

  return (
    <div className="ambient-bg">
      {enabled && (
        <>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          {!isMobile && (
            <>
              <div className="orb orb-3" />
              <div className="orb orb-4" />
            </>
          )}
        </>
      )}
      <div className="noise-layer" />
    </div>
  );
}
