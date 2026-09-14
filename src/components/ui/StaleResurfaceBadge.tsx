import { Sparkles } from "lucide-react";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface StaleResurfaceBadgeProps {
  /** The staleness message to display (e.g. a stale-prompt string or a computed "hasn't moved in 30 days" note). Falsy values render nothing. */
  message: string | null | undefined;
  /**
   * "badge" (default) is the bordered pill with an accent wash and a Sparkles
   * icon — the representative treatment. "text" is the bare accent-colored
   * text with no border/background/icon, for contexts that already provide
   * their own visual chrome (e.g. a card that already has a border).
   */
  variant?: "badge" | "text";
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
  variant = "badge",
  className,
}: StaleResurfaceBadgeProps) {
  if (!message) return null;

  if (variant === "text") {
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

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1",
        className,
      )}
    >
      <UiIcon className="h-3.5 w-3.5 text-[var(--accent)]" icon={Sparkles} />
      <span className="text-xs font-medium text-[var(--accent)]">
        {message}
      </span>
    </div>
  );
}
