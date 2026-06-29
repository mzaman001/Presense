import { PersonCardSkeleton } from "@/components/ui/Skeleton";

export default function RememberLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="h-7 w-28 animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* Tab pills */}
      <div className="flex gap-2">
        {[80, 100].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]"
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
