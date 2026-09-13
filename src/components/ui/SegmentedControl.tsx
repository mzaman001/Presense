"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
  /** Optional prefetch hooks for the view this segment reveals. */
  onMouseEnter?: () => void;
  onFocus?: () => void;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Accessible name, e.g. "Task view". */
  label?: string;
}

/**
 * The app's single view-switch control.
 *
 * Implements the ARIA radiogroup keyboard contract: one tab stop for the
 * group, arrow keys move between segments and select as they go, Home/End
 * jump to the ends.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const focusAndSelect = (index: number) => {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    const buttons =
      groupRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    buttons?.[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const current = options.findIndex((option) => option.value === value);
    if (current === -1) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect((current + 1) % options.length);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect((current - 1 + options.length) % options.length);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(options.length - 1);
        break;
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the group is a single tab stop.
            tabIndex={selected ? 0 : -1}
            onMouseEnter={option.onMouseEnter}
            onFocus={option.onFocus}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[32px] rounded-full px-4 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              selected
                ? "bg-[var(--color-text-1)] text-[var(--color-background)] shadow"
                : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
