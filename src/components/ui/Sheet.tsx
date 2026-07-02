"use client";

import React, { useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useVisualViewport } from "@/hooks/useVisualViewport";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ isOpen, onClose, title, children, className }: SheetProps) {
  const dialogRef = useDialogFocus(isOpen);
  const vp = useVisualViewport();

  // Calculate keyboard offset for mobile
  const keyboardOffset = typeof window !== "undefined" && window.visualViewport
    ? Math.max(0, (window.innerHeight || 0) - (vp.height || 0) - (window.visualViewport.offsetTop || 0))
    : 0;

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />

          {/* Sheet Container */}
          <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6" style={{ paddingBottom: `${keyboardOffset}px` }}>
            <m.div
              ref={dialogRef}
              drag="y"
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
                "pointer-events-auto w-full max-h-[90vh] bg-[var(--color-background)] flex flex-col",
                "rounded-t-[24px] md:rounded-[20px] shadow-2xl overflow-hidden border border-[var(--border-subtle)]",
                "md:max-w-xl md:max-h-[85vh]",
                className
              )}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === "string" ? title : undefined}
            >
              {/* Mobile Drag Handle */}
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-12 h-1.5 rounded-full bg-[var(--border-strong)] opacity-50" />
              </div>

              {/* Header - only show if title is provided */}
              {title && (
                <div className="flex items-center justify-between px-4 py-3 md:p-5 border-b border-[var(--border-subtle)] shrink-0">
                  <div className="text-[17px] font-semibold text-[var(--color-text-1)]">
                    {title}
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 rounded-full text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-4 md:p-5 overflow-y-auto overscroll-contain flex-1">
                {children}
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
