import { TaskCardSkeleton } from "@/components/ui/Skeleton";

export default function DoLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="mb-2 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[var(--surface-hover)]" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-[var(--surface-active)]" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
      </div>

      {/* Category filter pills skeleton */}
      <div className="flex gap-2">
        {[70, 50, 80, 65, 75].map((w, i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded-full bg-[var(--surface-hover)]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Board columns skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {["Overdue", "Today", "Upcoming"].map((col) => (
          <div key={col} className="space-y-3">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-[var(--surface-hover)]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-hover)]" />
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
