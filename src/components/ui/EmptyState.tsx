import { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  pointer,
  className,
}: {
  icon?: React.ElementType;
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
        "flex flex-col items-center justify-center border-dashed border-[var(--border-default)] p-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-1)]">
          <Icon
            className="h-6 w-6 text-[var(--color-text-3)]"
            strokeWidth={1.5}
          />
        </div>
      )}
      <h3 className="text-title-md mb-2 font-medium text-[var(--color-text-1)]">
        {title}
      </h3>
      <p className="text-body mb-6 max-w-sm text-[var(--text-muted)]">
        {description}
      </p>
      {pointer && (
        <p className="text-caption mb-6 text-[var(--text-muted)]">{pointer}</p>
      )}
      {action}
    </GlassCard>
  );
}
