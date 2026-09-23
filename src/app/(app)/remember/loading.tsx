import { PersonCardSkeleton } from "@/components/ui/Skeleton";

export default function RememberLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[var(--surface-hover)]" />
          <div className="h-7 w-28 animate-pulse rounded-lg bg-[var(--surface-active)]" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
      </div>

      {/* Tab pills */}
      <div className="flex gap-2">
        {[80, 100].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-full bg-[var(--surface-hover)]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Person cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <PersonCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
