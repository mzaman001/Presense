"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon as UiIcon } from "@/components/ui/Icon";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({
      position: "fixed",
      zIndex: 220,
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 160),
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target as Node))
      ) {
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
        {mounted && createPortal(
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={dropdownRef}
                initial={{ opacity: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.9 }}
                transition={{ duration: 0.18 }}
                className="fixed z-[220] bg-[var(--elev-floating-bg,var(--surface-dropdown))] border-[0.5px] border-[var(--elev-floating-border,var(--border-strong))] rounded-[var(--radius-md)] shadow-[var(--elev-floating-shadow,var(--shadow-dropdown))] [backdrop-filter:var(--elev-floating-blur,var(--glass-blur))] [-webkit-backdrop-filter:var(--elev-floating-blur,var(--glass-blur))]"
                style={{ ...position, transformOrigin: "top" }}
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
          </AnimatePresence>,
          document.body
        )}
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
          <UiIcon className="w-4 h-4 text-[var(--color-text-3)]" icon={ChevronDown} />
        </m.div>
      </button>
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <m.div
              ref={dropdownRef}
              initial={{ opacity: 0, scaleY: 0.9 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.9 }}
              transition={{ duration: 0.18 }}
              className="fixed z-[220] bg-[var(--elev-floating-bg,var(--surface-dropdown))] border-[0.5px] border-[var(--elev-floating-border,var(--border-strong))] rounded-[var(--radius-md)] shadow-[var(--elev-floating-shadow,var(--shadow-dropdown))] [backdrop-filter:var(--elev-floating-blur,var(--glass-blur))] [-webkit-backdrop-filter:var(--elev-floating-blur,var(--glass-blur))]"
              style={{ ...position, transformOrigin: "top" }}
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
