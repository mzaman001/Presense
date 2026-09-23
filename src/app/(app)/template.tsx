"use client";

import { m } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Page entrance. Enter-only on purpose: the previous `AnimatePresence
 * mode="wait"` held every navigation for a 200ms fade-out before the next
 * page could even start, which read as lag rather than calm. Now the new
 * page is there immediately and settles in with a short rise.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
