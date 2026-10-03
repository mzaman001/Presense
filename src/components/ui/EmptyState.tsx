import { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  mark,
  title,
  description,
  action,
  pointer,
  className,
}: {
  icon?: React.ElementType;
  // Artwork shown instead of the icon bubble, e.g. the drawn ensō when the
  // day is done. Takes precedence over `icon`.
  mark?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  // BUG-08 / CONF-10 (Option C): thin pointer to the global trash surface —
  // e.g. a "N items in trash" link. Rendered as a caption row under the
  // description; stays empty when no pointer is given.
  pointer?: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard
      className={cn(
        "flex flex-col items-center justify-center border-[var(--border-subtle)] bg-transparent px-6 py-14 text-center shadow-none sm:px-12",
        className,
      )}
    >
      {mark ? (
        <div className="mb-5">{mark}</div>
      ) : Icon ? (
        // .empty-mark: the bubble settles in and the icon's strokes draw
        // themselves once, in the ensō's brush timing. CSS only.
        <div className="empty-mark mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--accent-dim)]">
          <Icon
            aria-hidden="true"
            className="size-6 text-[var(--accent-text)]"
            strokeWidth={1.5}
          />
        </div>
      ) : null}
      <h3 className="font-heading mb-2 text-[length:var(--text-title-xl)] font-medium text-[var(--text-1)]">
        {title}
      </h3>
      <p className="text-body mb-6 max-w-sm text-[var(--text-3)]">
        {description}
      </p>
      {pointer && (
        <p className="text-caption mb-6 text-[var(--text-muted)]">{pointer}</p>
      )}
      {action}
    </GlassCard>
  );
}
