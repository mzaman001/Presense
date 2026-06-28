import { TaskCardSkeleton } from "@/components/ui/Skeleton";

// Root-level loading skeleton — shown during Server Component streaming
export default function AppLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-2.5 w-10 skeleton-shimmer rounded-full" />
          <div className="h-7 w-24 skeleton-shimmer rounded-lg" />
        </div>
        <div className="h-9 w-28 skeleton-shimmer rounded-xl" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[70, 50, 80, 65].map((w, i) => (
          <div key={i} className="h-7 skeleton-shimmer rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
