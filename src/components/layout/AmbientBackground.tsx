"use client";

import React, { useCallback, useSyncExternalStore } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const MOBILE_CAP_QUERY = "(max-width: 767px)";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * PERF-03: pause orb animation when the tab is hidden so a backgrounded
 * mobile tab can't accumulate compositor work, and cap the visible orb
 * count on small screens where the extra orbs are mostly clipped off-screen
 * and burn paint for nothing.
 *
 * Both signals are read through useSyncExternalStore rather than
 * useState + useEffect. The previous version gated the whole component on a
 * `mounted` flag set from an effect, which forced a second render of the
 * background on every page load just to reach its real state.
 */
export function AmbientBackground() {
  const ambientEnabled = useAppStore(
    (s) => s.userSettings?.ambient_bg !== false,
  );
  const isMobile = useMediaQuery(MOBILE_CAP_QUERY);

  const hidden = useSyncExternalStore(
    subscribeVisibility,
    useCallback(() => document.visibilityState === "hidden", []),
    useCallback(() => false, []),
  );

  const showOrbs = ambientEnabled && !hidden;

  return (
    <div className="ambient-bg">
      {showOrbs && (
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
