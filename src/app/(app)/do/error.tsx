"use client";

import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function DoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorFallback error={error} reset={reset} sectionName="the Do space" />;
}
