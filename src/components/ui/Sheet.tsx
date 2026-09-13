"use client";

import React, { useEffect } from "react";
import { m, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: SheetProps) {
  const dialogRef = useDialogFocus(isOpen);
  const vp = useVisualViewport();
  const dragControls = useDragControls();
  useBodyScrollLock(isOpen);

  // Calculate keyboard offset for mobile
  const keyboardOffset =
    typeof window !== "undefined" && window.visualViewport
      ? Math.max(
          0,
          (window.innerHeight || 0) -
            (vp.height || 0) -
            (window.visualViewport.offsetTop || 0),
        )
      : 0;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/50"
          />

          {/* Sheet Container */}
          <div
            className="pointer-events-none fixed inset-0 z-[100] flex flex-col justify-end p-0 md:items-center md:justify-center md:p-6"
            style={{ paddingBottom: `${keyboardOffset}px` }}
          >
            <m.div
              ref={dialogRef}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  onClose();
                }
              }}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                "modal pointer-events-auto flex max-h-[90vh] w-full flex-col",
                "overflow-hidden rounded-t-[24px] md:rounded-[20px]",
                "md:max-h-[85vh] md:max-w-xl",
                className,
              )}
              style={{
                paddingBottom: `${keyboardOffset}px`,
                backdropFilter: "blur(48px)",
                WebkitBackdropFilter: "blur(48px)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === "string" ? title : undefined}
            >
              {/* Mobile Drag Handle — only this element can initiate swipe-to-dismiss */}
              <div
                className="flex w-full cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing md:hidden"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="h-1.5 w-12 rounded-full bg-[var(--border-strong)] opacity-50" />
              </div>

              {/* Header - only show if title is provided */}
              {title && (
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 md:p-5">
                  <div className="text-title-lg font-semibold text-[var(--color-text-1)]">
                    {title}
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-full p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--color-text-1)]"
                  >
                    <UiIcon size={20} strokeWidth={2} icon={X} />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-5">
                {children}
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
