import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ExploreLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="h-7 w-24 animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-xl bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-12 w-full animate-pulse rounded-2xl bg-[rgba(255,255,255,0.06)]" />

      {/* Explore cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
