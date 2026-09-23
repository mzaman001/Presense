"use client";
import React, { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  placement?:
    "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom-center";
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  content,
  placement = "bottom-start",
  className,
  isOpen: controlledIsOpen,
  onOpenChange,
}: PopoverProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) setUncontrolledIsOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  const floatingPlacement =
    placement === "bottom-center" ? "bottom" : placement;

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: handleOpenChange,
    placement: floatingPlacement as Placement,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
    // Position with top/left: framer-motion owns `transform` for the enter
    // animation, and a floating-ui translate() there got overwritten, which
    // pinned the popover to the top-left corner of the viewport.
    transform: false,
  });
  const { setReference, setFloating, reference, floating } = refs;

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reference.current &&
        !(reference.current as Element).contains(event.target as Node) &&
        (!floating.current || !floating.current.contains(event.target as Node))
      ) {
        handleOpenChange(false);
      }
    };
    // Escape closes just this popover; defaultPrevented tells an enclosing
    // Sheet or dialog not to close as well.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, reference, floating, handleOpenChange]);

  return (
    <div className="relative inline-block" ref={setReference}>
      <div onClick={() => handleOpenChange(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {mounted && (
        <FloatingPortal>
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={setFloating}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -2,
                  scale: 0.98,
                  transition: { duration: 0.1 },
                }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "dropdown-panel z-[220] min-w-[200px]",
                  className,
                )}
                style={{ ...floatingStyles, transformOrigin: "top left" }}
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside popover from bubbling and closing it
              >
                {content}
              </m.div>
            )}
          </AnimatePresence>
        </FloatingPortal>
      )}
    </div>
  );
}
