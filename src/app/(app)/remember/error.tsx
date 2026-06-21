"use client";

import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function RememberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorFallback error={error} reset={reset} sectionName="the Remember space" />;
}
