"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const { setReference, setFloating, reference, floating } = refs;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        reference.current &&
        !(reference.current as Element).contains(e.target as Node) &&
        (!floating.current || !floating.current.contains(e.target as Node))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, reference, floating]);

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
        {mounted &&
          createPortal(
            <AnimatePresence>
              {isOpen && (
                <m.div
                  ref={setFloating}
                  initial={{ opacity: 0, scaleY: 0.9 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="dropdown-panel fixed z-[220] min-w-[160px]"
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
            </AnimatePresence>,
            document.body,
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
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={setFloating}
                initial={{ opacity: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.9 }}
                transition={{ duration: 0.18 }}
                className="dropdown-panel fixed z-[220] min-w-[160px]"
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
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
