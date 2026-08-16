import { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  pointer,
  className
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
    <GlassCard className={cn("p-12 text-center flex flex-col items-center justify-center border-dashed border-[var(--border-default)]", className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-[var(--color-text-3)]" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-title-md font-medium text-[var(--color-text-1)] mb-2">{title}</h3>
      <p className="text-body text-[var(--text-muted)] max-w-sm mb-6">{description}</p>
      {pointer && (
        <p className="text-caption mb-6 text-[var(--text-muted)]">{pointer}</p>
      )}
      {action}
    </GlassCard>
  );
}
