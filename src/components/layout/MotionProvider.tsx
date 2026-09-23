"use client";

import { LazyMotion, domMax, MotionConfig } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

/**
 * `reducedMotion="user"` only follows the OS setting. Presense also has its
 * own Settings → Appearance → Reduce motion toggle, which CSS honours via
 * `html.reduce-motion`; without this, every framer-motion animation ignored
 * it. When the in-app toggle is on we force "always"; otherwise defer to OS.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useAppStore((s) =>
    Boolean(s.userSettings.reduce_motion),
  );
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
