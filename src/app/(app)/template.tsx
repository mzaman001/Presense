"use client";

import { m } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/animations";

/**
 * Route template — wraps every page in this route segment.
 * Unlike layout.tsx, template.tsx re-mounts on navigation, which 
 * triggers the enter/exit animation on every route change.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="h-full w-full"
    >
      {children}
    </m.div>
  );
}
