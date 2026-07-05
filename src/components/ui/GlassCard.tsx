import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  /** "list" = no blur, for list items. "elevated" = blur, for modals/sidebar. "hero" = gradient/glow. Default: "list" */
  variant?: "list" | "elevated" | "hero";
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, variant = "list", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden transition-all duration-200 p-6",
          
          // Background & Border & Radius
          variant === "hero" 
            ? "bg-[linear-gradient(135deg,var(--accent-dim)_0%,var(--surface-card)_100%)] border-[0.5px] border-[var(--accent-border)] rounded-[var(--radius-xl)]" 
            : "bg-[var(--elev-raised-bg,var(--surface-card))] border border-[var(--elev-raised-border,rgba(255,255,255,0.14))] rounded-[var(--radius-lg)]",
          
          // Blur & Shadow
          variant === "hero"
            ? "[backdrop-filter:var(--glass-blur-heavy)] [-webkit-backdrop-filter:var(--glass-blur-heavy)] shadow-[var(--shadow-card),var(--shadow-accent-glow)]"
            : variant === "elevated" 
              ? "[backdrop-filter:var(--glass-blur)] [-webkit-backdrop-filter:var(--glass-blur)] shadow-[var(--shadow-card-hover)]"
              : "shadow-[var(--elev-raised-shadow,var(--shadow-card))] [backdrop-filter:var(--elev-raised-blur,blur(12px))] [-webkit-backdrop-filter:var(--elev-raised-blur,blur(12px))]",
              
          hoverable && "cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
