import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-[100] min-w-[200px] rounded-xl border border-[var(--color-border)] bg-[#111111] shadow-2xl [color-scheme:dark]",
              placementClasses[placement],
              className
            )}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside popover from bubbling and closing it
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
