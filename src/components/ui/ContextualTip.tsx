"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextualTipProps {
  id: string;
  title: string;
  description: string;
}

// Dismissals live in localStorage. A tiny external store lets the component
// read them during render instead of from an effect.
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

/** How long the dismiss collapse runs (--dur-base). */
const COLLAPSE_MS = 220;

/**
 * A quiet, one-time orientation note for a space: a slim note in the page's
 * own surface, with the title run into the sentence.
 *
 * It's in the server HTML. It used to render on the client only and fade in
 * once framer-motion loaded, which made it the LCP element on /do: LCP
 * waited for all the page's JavaScript (6.3 s of 7.3 s was render delay),
 * and it pushed the page down when it appeared. A dismissed tip is hidden
 * before first paint by the boot script in app/layout.tsx, which adds a
 * `[data-tip="…"]{display:none}` rule for each `hide_tip_*` key.
 */
export function ContextualTip({ id, title, description }: ContextualTipProps) {
  const getSnapshot = useCallback(() => isDismissed(id), [id]);
  const getServerSnapshot = useCallback(() => false, []);
  const dismissed = useSyncExternalStore(
    subscribeDismissals,
    getSnapshot,
    getServerSnapshot,
  );
  const [closing, setClosing] = useState(false);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`hide_tip_${id}`, "true");
    } catch {
      // Storage unavailable — the tip simply reappears next visit.
    }
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      dismissListeners.forEach((listener) => listener());
    }, COLLAPSE_MS);
  }, [id]);

  // Storage already says dismissed while it collapses; stay until it's done.
  if (dismissed && !closing) return null;

  return (
    <aside
      data-tip={id}
      aria-label={title}
      className={cn("tip-collapse", closing && "is-closing")}
    >
      <div className="min-h-0 overflow-hidden">
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
      </div>
    </aside>
  );
}
