"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

/**
 * The animation, layout and drag features (domMax) were bundled into every
 * page's initial JavaScript, ~25 KiB gz that had to parse before first
 * paint. Loaded asynchronously instead: `m.*` elements render in their final
 * state straight away and start animating once the features arrive, a
 * moment after hydration.
 */
const loadFeatures = () =>
  import("./motion-features").then((mod) => mod.default);

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
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
