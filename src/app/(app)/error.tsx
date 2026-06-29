"use client";

import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorFallback error={error} reset={reset} sectionName="the app" />;
}
