import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  /** "list" = no blur, for list items. "elevated" = blur, for modals/sidebar/hero. Default: "list" */
  variant?: "list" | "elevated";
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, variant = "list", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "elevated" ? "glass-card-elevated p-6" : "glass-card p-6",
          hoverable && "cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
