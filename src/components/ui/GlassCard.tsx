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
          // DS-30 (Aug 17, 2026) — overflow is fixed at the source:
          // cropping is only needed by the genuinely-clipping hero
          // variant. Hoverable cards use translateY lift, which repositions
          // rather than grows, so nothing is ever clipped mid-hover —
          // not inside a Kanban column, not inside a scrollable list.
          variant === "hero"
            ? "relative overflow-hidden transition-all duration-200 p-6"
            : "relative p-6 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",

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

          /* DS-30 — the one hover system: translateY lift only, matching
             TaskCard's `whileHover={{ y: -2 }}` exactly (same distance,
             same duration, same easing token). A hoverable card also
             steps up to the hover shadow on hover. Scale() hover is
             banned for cards: it grows the rendered box past the layout
             box, which is what triggers clipping inside overflow-hidden
             ancestors like Do's horizontally-scrollable board columns. */
          hoverable &&
            "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover,var(--elev-raised-shadow,var(--shadow-card)))]",
          className,
        )}
        {...props}
      />
    );
  },
);
GlassCard.displayName = "GlassCard";
