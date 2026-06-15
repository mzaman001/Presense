import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DropdownOption {
  value: string;
  label: string;
  color?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[] | string[];
  placeholder?: string;
  colors?: Record<string, string>;
  className?: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  colors = {},
  className = "",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = Array.isArray(options)
    ? typeof options[0] === "string"
      ? { value, label: value, color: colors[value] }
      : (options as DropdownOption[]).find((o) => o.value === value) || {
          value,
          label: value,
          color: colors[value],
        }
    : { value, label: value, color: colors[value] };

  const currentColor =
    selectedOption.color || colors[selectedOption.value] || "rgba(255,255,255,0.5)";

  const isPlaceholder = !value || value === placeholder;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="px-3 py-1 rounded-full border text-xs font-semibold transition-colors flex items-center gap-1"
        style={{
          borderColor: isPlaceholder ? "rgba(255,255,255,0.2)" : currentColor,
          color: isPlaceholder ? "rgba(255,255,255,0.5)" : currentColor,
          backgroundColor: isPlaceholder ? "transparent" : `${currentColor}20`,
        }}
      >
        {isPlaceholder ? placeholder : selectedOption.label} ▾
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-48 glass-panel p-1 z-50"
          >
            {options.map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const optColor =
                (typeof opt !== "string" ? opt.color : undefined) ||
                colors[optValue] ||
                "white";

              return (
                <button
                  key={optValue}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(optValue);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-2"
                  style={{ color: optColor }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: optColor === "white" ? "transparent" : optColor }}
                  />
                  {optLabel}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
