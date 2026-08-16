import React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlProps<T extends string> {
  options: (OptionProps<T> & { label: string; value: T })[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export interface OptionProps<T extends string> {
  onMouseEnter?: () => void;
  onFocus?: () => void;
}


export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" className={cn("flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full p-0.5 shrink-0", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          onMouseEnter={option.onMouseEnter}
          onFocus={option.onFocus}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-1 text-xs font-semibold rounded-full transition-all",
            value === option.value
              ? "bg-[var(--color-text-1)] text-[var(--color-background)] shadow"
              : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
