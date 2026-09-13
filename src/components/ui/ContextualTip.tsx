"use client";

import { useCallback, useSyncExternalStore } from "react";
import { X, Lightbulb } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface ContextualTipProps {
  id: string;
  title: string;
  description: string;
}

// Dismissals live in localStorage. A tiny external store lets the component
// read them during render (hydration-safe via getServerSnapshot) instead of
// flashing the tip in and then hiding it from an effect.
const dismissListeners = new Set<() => void>();

function subscribeDismissals(onChange: () => void) {
  dismissListeners.add(onChange);
  return () => dismissListeners.delete(onChange);
}

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(`hide_tip_${id}`) !== null;
  } catch {
    // Private mode / storage blocked — show the tip rather than crash.
    return false;
  }
}

export function ContextualTip({ id, title, description }: ContextualTipProps) {
  const getSnapshot = useCallback(() => isDismissed(id), [id]);
  // Server renders nothing; the tip appears on the client only if not dismissed.
  const getServerSnapshot = useCallback(() => true, []);
  const dismissed = useSyncExternalStore(
    subscribeDismissals,
    getSnapshot,
    getServerSnapshot,
  );
  const isVisible = !dismissed;

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`hide_tip_${id}`, "true");
    } catch {
      // Storage unavailable — the tip simply reappears next visit.
    }
    dismissListeners.forEach((listener) => listener());
  }, [id]);

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
          className="relative mb-6 flex items-start gap-3 overflow-hidden rounded-xl border border-[rgba(229,180,30,0.2)] bg-gradient-to-r from-[rgba(229,180,30,0.1)] to-[rgba(235,66,51,0.05)] p-4 shadow-lg"
        >
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(229,180,30,0.2)] text-[#E5B41E]">
            <UiIcon className="h-4 w-4" icon={Lightbulb} />
          </div>
          <div className="flex-1 pr-6">
            <h4 className="mb-1 text-sm font-semibold text-[#E5B41E]">
              {title}
            </h4>
            <p className="text-sm leading-relaxed text-[var(--color-text-2)]">
              {description}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 rounded-full p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
          >
            <UiIcon className="h-4 w-4" icon={X} />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
