import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "do" | "people" | "think" | "explore";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    
    const variants = {
      default: "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-2)] border-[rgba(255,255,255,0.15)]",
      do: "bg-[rgba(248,113,113,0.15)] text-[var(--color-do)] border-[rgba(248,113,113,0.3)]",
      people: "bg-[rgba(244,114,182,0.15)] text-[var(--color-people)] border-[rgba(244,114,182,0.3)]",
      think: "bg-[rgba(45,212,191,0.15)] text-[var(--color-think)] border-[rgba(45,212,191,0.3)]",
      explore: "bg-[rgba(251,191,36,0.15)] text-[var(--color-explore)] border-[rgba(251,191,36,0.3)]",
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
