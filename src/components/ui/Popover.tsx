"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
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
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const { setReference, setFloating, reference, floating } = refs;

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // reference.current is the trigger container, floating.current is the popover panel
      if (
        reference.current &&
        !(reference.current as Element).contains(event.target as Node) &&
        (!floating.current || !floating.current.contains(event.target as Node))
      ) {
        handleOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, reference, floating, handleOpenChange]);

  return (
    <div className="relative inline-block" ref={setReference}>
      <div onClick={() => handleOpenChange(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={setFloating}
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                  "dropdown-panel z-[220] min-w-[200px]",
                  className,
                )}
                style={floatingStyles}
                onClick={(e) => e.stopPropagation()}
              >
                {content}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
