"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom-center";
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ trigger, content, placement = "bottom-start", className, isOpen: controlledIsOpen, onOpenChange }: PopoverProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;
  
  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) setUncontrolledIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 8;
    const next: React.CSSProperties = {
      position: "fixed",
      zIndex: 220,
      minWidth: Math.max(rect.width, 200),
    };

    if (placement.startsWith("top")) next.bottom = window.innerHeight - rect.top + gap;
    else next.top = rect.bottom + gap;

    if (placement.endsWith("end")) next.right = window.innerWidth - rect.right;
    else if (placement.endsWith("center")) {
      next.left = rect.left + rect.width / 2;
      next.transform = "translateX(-50%)";
    } else next.left = rect.left;

    setPosition(next);
  }, [isOpen, placement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const placementClasses = {
    "bottom-start": "top-full left-0 mt-2",
    "bottom-end": "top-full right-0 mt-2",
    "bottom-center": "top-full left-1/2 -translate-x-1/2 mt-2",
    "top-start": "bottom-full left-0 mb-2",
    "top-end": "bottom-full right-0 mb-2",
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div onClick={() => handleOpenChange(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "min-w-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl",
              className
            )}
            style={position}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside popover from bubbling and closing it
          >
            {content}
          </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
