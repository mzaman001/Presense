"use client";

import { useCallback, useSyncExternalStore } from "react";
import { X, Lightbulb } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

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

/**
 * A quiet, one-time orientation note for a space. It used to be a gold
 * gradient card with a drop shadow that took a quarter of a phone screen;
 * it's now a slim note in the page's own surface, with the title run into
 * the sentence. Collapses smoothly when dismissed.
 */
export function ContextualTip({ id, title, description }: ContextualTipProps) {
  const getSnapshot = useCallback(() => isDismissed(id), [id]);
  // Server renders nothing; the tip appears on the client only if not dismissed.
  const getServerSnapshot = useCallback(() => true, []);
  const dismissed = useSyncExternalStore(
    subscribeDismissals,
    getSnapshot,
    getServerSnapshot,
  );

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`hide_tip_${id}`, "true");
    } catch {
      // Storage unavailable — the tip simply reappears next visit.
    }
    dismissListeners.forEach((listener) => listener());
  }, [id]);

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <m.aside
          aria-label={title}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] py-2.5 pr-1.5 pl-3.5">
            <Lightbulb
              aria-hidden="true"
              className="mt-[3px] size-4 shrink-0 text-[var(--accent-text)]"
              strokeWidth={1.75}
            />
            <p className="min-w-0 flex-1 py-px text-[length:var(--text-body)] leading-[1.55] text-[var(--text-3)]">
              <span className="font-medium text-[var(--text-1)]">{title}.</span>{" "}
              {description}
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss tip"
              className="-my-1 flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
