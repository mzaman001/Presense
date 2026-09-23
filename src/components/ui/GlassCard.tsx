import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  /** "list" = default flat card. "elevated" = modals/sidebar surfaces.
   *  "hero" = the single largest card on a page (e.g. Home's Focus Now).
   *  All three are flat: no blur, no gradient, no glow — a background,
   *  a hairline border, and a shadow token only. Default: "list" */
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
            ? "relative overflow-hidden p-6 transition duration-200"
            : "relative p-6 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",

          // Background & Border & Radius — flat surfaces only, no gradient.
          variant === "hero"
            ? "rounded-[var(--radius-xl)] border-[0.5px] border-[var(--accent-border)] bg-[var(--surface-hero)]"
            : "rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--elev-raised-bg,var(--surface-card))]",

          // Shadow — flat shadow tokens only, no blur, no glow.
          variant === "hero"
            ? "shadow-[var(--shadow-card-hover)]"
            : variant === "elevated"
              ? "shadow-[var(--shadow-card-hover)]"
              : "shadow-[var(--elev-raised-shadow,var(--shadow-card))]",

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
