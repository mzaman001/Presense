import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ThinkLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[var(--surface-hover)]" />
          <div className="h-7 w-20 animate-pulse rounded-lg bg-[var(--surface-active)]" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
      </div>

      {/* Thread cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
