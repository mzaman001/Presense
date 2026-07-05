import React from "react";
import { cn } from "@/lib/utils";

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center text-caption font-mono text-[var(--text-3)] whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]",
          className
        )}
        {...props}
      >
        {children}
      </kbd>
    );
  }
);
Kbd.displayName = "Kbd";
