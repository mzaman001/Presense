import { TaskCardSkeleton } from "@/components/ui/Skeleton";

export default function DoLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* Category filter pills skeleton */}
      <div className="flex gap-2">
        {[70, 50, 80, 65, 75].map((w, i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Board columns skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["Overdue", "Today", "Upcoming"].map((col) => (
          <div key={col} className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            </div>
            {Array.from({ length: col === "Today" ? 3 : 2 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
