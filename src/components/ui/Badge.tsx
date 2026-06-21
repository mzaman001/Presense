import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "do" | "people" | "think" | "explore";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    
    const variants = {
      default: "bg-[var(--color-surface)] text-[var(--color-text-2)] border-[var(--color-border)]",
      do: "bg-[var(--space-do-dim)] text-[var(--color-do)] border-[var(--space-do-border)]",
      people: "bg-[var(--space-remember-dim)] text-[var(--color-people)] border-[var(--space-remember-border)]",
      think: "bg-[var(--space-think-dim)] text-[var(--color-think)] border-[var(--space-think-border)]",
      explore: "bg-[var(--space-explore-dim)] text-[var(--color-explore)] border-[var(--space-explore-border)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full border text-label",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
