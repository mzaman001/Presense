import React, { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  variant?: "chip" | "select";
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  colors = {},
  className = "",
  variant = "select",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selectedOption = (() => {
    if (!Array.isArray(options)) return { value, label: value };
    if (typeof options[0] === "string") return { value, label: value, color: colors[value] };
    return (options as DropdownOption[]).find((o) => o.value === value) || { value, label: value, color: colors[value] };
  })();

  if (variant === "chip") {
    const currentColor = selectedOption.color || colors[selectedOption.value] || "rgba(255,255,255,0.5)";
    const isPlaceholder = !value || value === placeholder;
    return (
      <div className={cn("relative", className)} ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1 rounded-full border text-xs font-semibold transition-colors flex items-center gap-1"
          style={{
            borderColor: isPlaceholder ? "rgba(255,255,255,0.2)" : currentColor,
            color: isPlaceholder ? "rgba(255,255,255,0.5)" : currentColor,
            backgroundColor: isPlaceholder ? "transparent" : `${currentColor}20`,
          }}
        >
          {isPlaceholder ? placeholder : selectedOption.label} ▼
        </button>
        <AnimatePresence>
          {isOpen && (
            <m.div
              initial={{ opacity: 0, scaleY: 0.9 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.9 }}
              transition={{ duration: 0.18 }}
              className="dropdown-panel absolute top-full left-0 mt-1 z-[220]"
              style={{ minWidth: 160, transformOrigin: "top" }}
            >
              {options.map((opt) => {
                const optValue = typeof opt === "string" ? opt : opt.value;
                const optLabel = typeof opt === "string" ? opt : opt.label;
                const optColor = (typeof opt !== "string" ? opt.color : undefined) || colors[optValue] || "currentColor";
                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => { onChange(optValue); setIsOpen(false); }}
                    className={cn("dropdown-item w-full text-left", value === optValue && "selected")}
                    style={value === optValue && optColor !== "currentColor" ? { borderColor: optColor, color: optColor } : {}}
                  >
                    <div
                      className={cn("w-2 h-2 rounded-full border border-current shrink-0", value === optValue ? "bg-current" : "bg-transparent")}
                      style={{ borderColor: optColor, backgroundColor: value === optValue ? optColor : "transparent" }}
                    />
                    {optLabel}
                  </button>
                );
              })}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
      >
        <span className={(!value || value === placeholder) ? "text-[var(--color-text-3)]" : ""}>
          {selectedOption.label || placeholder}
        </span>
        <m.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-[var(--color-text-3)]" />
        </m.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, scaleY: 0.9 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.9 }}
            transition={{ duration: 0.18 }}
            className="dropdown-panel absolute top-full left-0 mt-1 z-[220]"
            style={{ minWidth: 160, transformOrigin: "top" }}
          >
            {options.map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const optColor = (typeof opt !== "string" ? opt.color : undefined) || colors[optValue] || "currentColor";
              return (
                <button
                  key={optValue}
                  type="button"
                  onClick={() => { onChange(optValue); setIsOpen(false); }}
                  className={cn("dropdown-item w-full text-left", value === optValue && "selected")}
                  style={variant === "select" && value === optValue && optColor !== "currentColor" ? { borderColor: optColor, color: optColor } : {}}
                >
                  <div
                    className={cn("w-2 h-2 rounded-full border border-current shrink-0", value === optValue ? "bg-current" : "bg-transparent")}
                    style={variant === "select" ? { borderColor: optColor, backgroundColor: value === optValue ? optColor : "transparent" } : {}}
                  />
                  {optLabel}
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
