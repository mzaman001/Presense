import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  variant = "chip",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      minWidth: Math.max(rect.width, 160),
      zIndex: 220,
      transformOrigin: "top",
    });
  }, [isOpen]);

  useEffect(() => {
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = useCallback((optValue: string) => {
    onChangeRef.current(optValue);
    setIsOpen(false);
  }, []);

  const selectedOption = (() => {
    if (!Array.isArray(options)) return { value, label: value };
    if (typeof options[0] === "string") return { value, label: value, color: colors[value] };
    return (options as DropdownOption[]).find((o) => o.value === value) || { value, label: value, color: colors[value] };
  })();

  const currentColor = selectedOption.color || colors[selectedOption.value] || "rgba(255,255,255,0.5)";
  const isPlaceholder = !value || value === placeholder;

  const renderMenu = () => (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0, scaleY: 0.9 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.9 }}
          transition={{ duration: 0.18 }}
          style={position}
          className="dropdown-panel"
        >
          {options.map((opt) => {
            const optValue = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : opt.label;
            const optColor = (typeof opt !== "string" ? opt.color : undefined) || colors[optValue] || "currentColor";

            return (
              <button
                key={optValue}
                type="button"
                onClick={() => handleSelect(optValue)}
                className={cn("dropdown-item w-full text-left", value === optValue && "selected")}
                style={variant === "chip" && value === optValue && optColor !== "currentColor" ? { borderColor: optColor, color: optColor } : {}}
              >
                <div
                  className={cn("w-2 h-2 rounded-full border border-current shrink-0", value === optValue ? "bg-current" : "bg-transparent")}
                  style={variant === "chip" ? { borderColor: optColor, backgroundColor: value === optValue ? optColor : "transparent" } : {}}
                />
                {optLabel}
              </button>
            );
          })}
        </m.div>
      )}
    </AnimatePresence>
  );

  if (variant === "select") {
    return (
      <div className={cn("relative w-full", className)} ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
        >
          <span className={isPlaceholder ? "text-[var(--color-text-3)]" : ""}>
            {selectedOption.label || placeholder}
          </span>
          <m.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-[var(--color-text-3)]" />
          </m.div>
        </button>
        {mounted && createPortal(renderMenu(), document.body)}
      </div>
    );
  }

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
      {mounted && createPortal(renderMenu(), document.body)}
    </div>
  );
}
