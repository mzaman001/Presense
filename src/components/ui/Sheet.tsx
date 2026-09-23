"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Pinned under the scrolling body (primary actions). */
  footer?: React.ReactNode;
  className?: string;
  /** Replaces the body's default padding, e.g. "p-0" for edge-to-edge lists. */
  bodyClassName?: string;
  /** Accessible name when there is no visible string title. */
  ariaLabel?: string;
}

/**
 * Bottom sheet on phones, centred card on wider screens.
 *
 * Rendered into document.body. It used to render in place, inside <main>,
 * whose `relative z-10` creates a stacking context — so the sheet's own
 * z-index couldn't rise above the app shell and the mobile dock sat on top
 * of it, covering its Save button.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  bodyClassName,
  ariaLabel,
}: SheetProps) {
  const dialogRef = useDialogFocus(isOpen);
  const vp = useVisualViewport();
  const dragControls = useDragControls();
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(isOpen);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Lift the sheet above the on-screen keyboard on phones.
  const keyboardOffset =
    typeof window !== "undefined" && window.visualViewport
      ? Math.max(
          0,
          (window.innerHeight || 0) -
            (vp.height || 0) -
            (window.visualViewport.offsetTop || 0),
        )
      : 0;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      // A menu or confirm inside the sheet claims its own Escape.
      if (e.key === "Escape" && isOpen && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-[var(--bg-overlay)]"
          />

          <div
            className="pointer-events-none fixed inset-0 z-[100] flex flex-col justify-end md:items-center md:justify-center md:p-6"
            style={{ paddingBottom: `${keyboardOffset}px` }}
          >
            <m.div
              ref={dialogRef}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) onClose();
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{
                y: "100%",
                transition: { duration: 0.22, ease: [0.55, 0, 0.75, 0.2] },
              }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "modal pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden",
                "rounded-t-[var(--sheet-radius)] rounded-b-none md:rounded-[var(--radius-xl)]",
                "md:max-h-[86vh] md:max-w-xl",
                className,
              )}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === "string" ? title : ariaLabel}
            >
              {/* Drag handle: the only element that starts swipe-to-dismiss */}
              <div
                className="flex w-full shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing md:hidden"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="h-1 w-9 rounded-full bg-[var(--border-strong)]" />
              </div>

              {title && (
                <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-2 pb-3 md:px-6 md:pt-5">
                  <h2 className="font-heading text-[length:var(--text-title-xl)] leading-tight font-medium text-[var(--text-1)]">
                    {title}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                  >
                    <X aria-hidden="true" className="size-[18px]" />
                  </button>
                </div>
              )}

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6",
                  !footer && "pb-[calc(env(safe-area-inset-bottom,0px)+20px)]",
                  bodyClassName,
                )}
              >
                {children}
              </div>

              {footer && (
                <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:px-6 md:pb-4">
                  {footer}
                </div>
              )}
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
