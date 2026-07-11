"use client";
import React, { useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon as UiIcon } from "@/components/ui/Icon";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  FloatingPortal,
} from "@floating-ui/react";

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
  const [mounted, setMounted] = useState(false);
  const searchBuffer = useRef("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    strategy: "fixed",
  });
  const { setReference, setFloating, reference, floating } = refs;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      searchBuffer.current = "";
      return;
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (
        reference.current &&
        !(reference.current as Element).contains(e.target as Node) &&
        (!floating.current || !floating.current.contains(e.target as Node))
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        setIsOpen(false);
        const trigger = (reference.current as HTMLElement)?.querySelector(
          "button",
        );
        if (trigger) trigger.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (floating.current) {
          const buttons = Array.from(
            floating.current.querySelectorAll("button"),
          );
          const currentIndex = buttons.findIndex(
            (b) => document.activeElement === b,
          );
          let nextIndex = 0;
          if (e.key === "ArrowDown") {
            nextIndex =
              currentIndex >= 0
                ? Math.min(currentIndex + 1, buttons.length - 1)
                : 0;
          } else {
            nextIndex =
              currentIndex >= 0
                ? Math.max(currentIndex - 1, 0)
                : buttons.length - 1;
          }
          if (buttons[nextIndex]) (buttons[nextIndex] as HTMLElement).focus();
        }
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        searchBuffer.current += e.key.toLowerCase();

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
          searchBuffer.current = "";
        }, 500);

        const opts = options as Array<string | DropdownOption>;
        const matchIndex = opts.findIndex((opt) => {
          const label = typeof opt === "string" ? opt : opt.label;
          return label.toLowerCase().startsWith(searchBuffer.current);
        });

        if (matchIndex >= 0 && floating.current) {
          const buttons = floating.current.querySelectorAll("button");
          if (buttons[matchIndex]) {
            (buttons[matchIndex] as HTMLElement).focus();
          }
        }
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, reference, floating, options]);

  const selectedOption = (() => {
    if (!Array.isArray(options)) return { value, label: value };
    if (typeof options[0] === "string")
      return { value, label: value, color: colors[value] };
    return (
      (options as DropdownOption[]).find((o) => o.value === value) || {
        value,
        label: value,
        color: colors[value],
      }
    );
  })();

  if (variant === "chip") {
    const currentColor =
      selectedOption.color ||
      colors[selectedOption.value] ||
      "rgba(255,255,255,0.5)";
    const isPlaceholder = !value || value === placeholder;
    return (
      <div className={cn("relative", className)} ref={setReference}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
          style={{
            borderColor: isPlaceholder ? "rgba(255,255,255,0.2)" : currentColor,
            color: isPlaceholder ? "rgba(255,255,255,0.5)" : currentColor,
            backgroundColor: isPlaceholder
              ? "transparent"
              : `${currentColor}20`,
          }}
        >
          {isPlaceholder ? placeholder : selectedOption.label} ▼
        </button>
        {mounted && (
          <FloatingPortal>
            <AnimatePresence>
              {isOpen && (
                <m.div
                  ref={setFloating}
                  initial={{ opacity: 0, scaleY: 0.9 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="dropdown-panel z-[220] max-h-[min(320px,60vh)] min-w-[160px] overflow-y-auto overscroll-contain"
                  style={{ ...floatingStyles, transformOrigin: "top" }}
                >
                  {options.map((opt) => {
                    const optValue = typeof opt === "string" ? opt : opt.value;
                    const optLabel = typeof opt === "string" ? opt : opt.label;
                    const optColor =
                      (typeof opt !== "string" ? opt.color : undefined) ||
                      colors[optValue] ||
                      "currentColor";
                    return (
                      <button
                        key={optValue}
                        type="button"
                        onClick={() => {
                          onChange(optValue);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "dropdown-item w-full text-left",
                          value === optValue && "selected",
                        )}
                        style={
                          value === optValue && optColor !== "currentColor"
                            ? { borderColor: optColor, color: optColor }
                            : {}
                        }
                      >
                        <div
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full border border-current",
                            value === optValue
                              ? "bg-current"
                              : "bg-transparent",
                          )}
                          style={{
                            borderColor: optColor,
                            backgroundColor:
                              value === optValue ? optColor : "transparent",
                          }}
                        />
                        {optLabel}
                      </button>
                    );
                  })}
                </m.div>
              )}
            </AnimatePresence>
          </FloatingPortal>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} ref={setReference}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-1)] transition-colors focus:border-[var(--color-accent)] focus:outline-none"
      >
        <span
          className={
            !value || value === placeholder ? "text-[var(--color-text-3)]" : ""
          }
        >
          {selectedOption.label || placeholder}
        </span>
        <m.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <UiIcon
            className="h-4 w-4 text-[var(--color-text-3)]"
            icon={ChevronDown}
          />
        </m.div>
      </button>
      {mounted && (
        <FloatingPortal>
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={setFloating}
                initial={{ opacity: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.9 }}
                transition={{ duration: 0.18 }}
                className="dropdown-panel z-[220] max-h-[min(320px,60vh)] min-w-[160px] overflow-y-auto overscroll-contain"
                style={{ ...floatingStyles, transformOrigin: "top" }}
              >
                {options.map((opt) => {
                  const optValue = typeof opt === "string" ? opt : opt.value;
                  const optLabel = typeof opt === "string" ? opt : opt.label;
                  const optColor =
                    (typeof opt !== "string" ? opt.color : undefined) ||
                    colors[optValue] ||
                    "currentColor";
                  return (
                    <button
                      key={optValue}
                      type="button"
                      onClick={() => {
                        onChange(optValue);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "dropdown-item w-full text-left",
                        value === optValue && "selected",
                      )}
                      style={
                        variant === "select" &&
                        value === optValue &&
                        optColor !== "currentColor"
                          ? { borderColor: optColor, color: optColor }
                          : {}
                      }
                    >
                      <div
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full border border-current",
                          value === optValue ? "bg-current" : "bg-transparent",
                        )}
                        style={
                          variant === "select"
                            ? {
                                borderColor: optColor,
                                backgroundColor:
                                  value === optValue ? optColor : "transparent",
                              }
                            : {}
                        }
                      />
                      {optLabel}
                    </button>
                  );
                })}
              </m.div>
            )}
          </AnimatePresence>
        </FloatingPortal>
      )}
    </div>
  );
}
