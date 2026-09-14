import { cn } from "@/lib/utils";

interface StaleResurfaceBadgeProps {
  /** The staleness message to display (e.g. a stale-prompt string or a computed "hasn't moved in 30 days" note). */
  message: string;
  className?: string;
}

/**
 * Shared "stale, gently resurfaced" display treatment (design spec §3).
 *
 * Renders a staleness message in the accent-family tokens used across the
 * design system. Purely presentational — callers own the staleness signal
 * (a pre-computed string today, from Think's `stale_prompt` column; a
 * timestamp-derived message from a future consumer such as Remember's
 * Locations staleness check).
 */
export function StaleResurfaceBadge({
  message,
  className,
}: StaleResurfaceBadgeProps) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed font-medium text-[var(--accent)]",
        className,
      )}
    >
      {message}
    </p>
  );
}
