import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "do" | "think" | "remember" | "explore" | "today" | "overdue" | "upcoming" | "someday";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    
    const variants = {
      default: "bg-[var(--color-surface)] text-[var(--color-text-2)] border-[var(--color-border)]",
      do: "bg-[var(--space-do-dim)] text-[var(--space-do)] border-[var(--space-do-border)]",
      think: "bg-[var(--space-think-dim)] text-[var(--space-think)] border-[var(--space-think-border)]",
      remember: "bg-[var(--space-remember-dim)] text-[var(--space-remember)] border-[var(--space-remember-border)]",
      explore: "bg-[var(--space-explore-dim)] text-[var(--space-explore)] border-[var(--space-explore-border)]",
      today: "bg-[var(--status-today-dim)] text-[var(--status-today)] border-[var(--status-today-border)]",
      overdue: "bg-[var(--status-overdue-dim)] text-[var(--status-overdue)] border-[var(--status-overdue-border)]",
      upcoming: "bg-[var(--status-upcoming-dim)] text-[var(--status-upcoming)] border-[var(--status-upcoming-border)]",
      someday: "bg-[var(--status-someday-dim)] text-[var(--status-someday)] border-[var(--status-someday-border)]",
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
