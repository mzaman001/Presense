import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ThinkLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="h-7 w-20 animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-[rgba(255,255,255,0.06)]" />
      </div>

      {/* Thread cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
