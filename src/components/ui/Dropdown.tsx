"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
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
  /** Optional swatch colour per value, shown as a dot beside the label. */
  colors?: Record<string, string>;
  className?: string;
  /** Kept for call-site compatibility; "select" is the only variant. */
  variant?: "select";
  /** Accessible name when there is no visible <label> wired to it. */
  "aria-label"?: string;
  /**
   * Opt-in for dropdowns inside a container that may still be mid-
   * transform-animation when opened (e.g. SettingsModal's spring-in):
   * autoUpdate polls via requestAnimationFrame so the panel tracks the
   * trigger through the animation. Costs rAF work while open, so only
   * set it where needed.
   */
  trackAnimatedAncestor?: boolean;
}

const normalize = (
  options: DropdownOption[] | string[],
  colors: Record<string, string>,
): DropdownOption[] =>
  (options as Array<string | DropdownOption>).map((opt) =>
    typeof opt === "string"
      ? { value: opt, label: opt, color: colors[opt] }
      : { ...opt, color: opt.color ?? colors[opt.value] },
  );

/**
 * The app's select. A trigger that looks like an input, and a portalled
 * listbox that opens under it at the trigger's width.
 *
 * Positioning uses top/left (`transform: false`): framer-motion owns the
 * panel's transform for its enter animation, and letting floating-ui also
 * write `transform: translate(…)` meant the animation overwrote it and the
 * panel rendered at the top-left corner of the viewport.
 */
export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  colors = {},
  className = "",
  trackAnimatedAncestor = false,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listId = useId();
  const searchBuffer = useRef("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    strategy: "fixed",
    transform: false,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${Math.max(rects.reference.width, 180)}px`,
            maxHeight: `${Math.min(320, Math.max(availableHeight, 160))}px`,
          });
        },
      }),
    ],
    whileElementsMounted: trackAnimatedAncestor
      ? (referenceEl, floatingEl, update) =>
          autoUpdate(referenceEl, floatingEl, update, {
            animationFrame: true,
          })
      : autoUpdate,
  });
  const { setReference, setFloating, reference, floating } = refs;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const items = normalize(options, colors);
  const selected = items.find((o) => o.value === value);
  const hasSwatches = items.some((o) => o.color);

  const optionButtons = () =>
    Array.from(
      floating.current?.querySelectorAll<HTMLButtonElement>(
        "[role='option']",
      ) ?? [],
    );

  const close = (refocus: boolean) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // On open, move focus to the selected option (or the first) so arrow keys
  // and Enter work immediately, and the current choice is scrolled into view.
  useEffect(() => {
    if (!isOpen) {
      searchBuffer.current = "";
      return;
    }
    const raf = requestAnimationFrame(() => {
      const buttons = optionButtons();
      const target =
        buttons.find((b) => b.getAttribute("aria-selected") === "true") ??
        buttons[0];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !(reference.current as Element | null)?.contains(target) &&
        !floating.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const buttons = optionButtons();
      const current = buttons.findIndex((b) => b === document.activeElement);

      switch (e.key) {
        case "Escape":
        case "Tab":
          if (e.key === "Escape") e.preventDefault();
          close(e.key === "Escape");
          return;
        case "ArrowDown":
          e.preventDefault();
          buttons[Math.min(current + 1, buttons.length - 1)]?.focus();
          return;
        case "ArrowUp":
          e.preventDefault();
          buttons[current <= 0 ? 0 : current - 1]?.focus();
          return;
        case "Home":
          e.preventDefault();
          buttons[0]?.focus();
          return;
        case "End":
          e.preventDefault();
          buttons[buttons.length - 1]?.focus();
          return;
      }

      // Type-ahead: jump to the first option starting with what was typed.
      if (e.key.length === 1) {
        e.preventDefault();
        searchBuffer.current += e.key.toLowerCase();
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
          searchBuffer.current = "";
        }, 500);
        const match = items.findIndex((o) =>
          o.label.toLowerCase().startsWith(searchBuffer.current),
        );
        if (match >= 0) buttons[match]?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reference, floating, options]);

  const swatch = (color?: string) =>
    hasSwatches ? (
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: color ?? "var(--border-strong)" }}
      />
    ) : null;

  return (
    <div className={cn("relative w-full", className)} ref={setReference}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        data-open={isOpen || undefined}
        className="select-trigger"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {swatch(selected?.color)}
          <span
            className={cn("truncate", !selected && "text-[var(--text-muted)]")}
          >
            {selected?.label ?? (value || placeholder)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="select-chevron size-4 shrink-0"
        />
      </button>

      {mounted && (
        <FloatingPortal>
          <AnimatePresence>
            {isOpen && (
              <m.div
                ref={setFloating}
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -2,
                  scale: 0.98,
                  transition: { duration: 0.1 },
                }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="select-panel z-[220]"
                style={{ ...floatingStyles, transformOrigin: "top" }}
              >
                {items.length === 0 ? (
                  <div className="px-3 py-2.5 text-[length:var(--text-ui)] text-[var(--text-3)]">
                    No options
                  </div>
                ) : (
                  items.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => {
                          onChange(opt.value);
                          close(true);
                        }}
                        className="select-option"
                      >
                        {swatch(opt.color)}
                        <span className="min-w-0 flex-1 truncate">
                          {opt.label}
                        </span>
                        {isSelected && (
                          <Check
                            aria-hidden="true"
                            className="size-4 shrink-0 text-[var(--accent-text)]"
                            strokeWidth={2.25}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </m.div>
            )}
          </AnimatePresence>
        </FloatingPortal>
      )}
    </div>
  );
}
