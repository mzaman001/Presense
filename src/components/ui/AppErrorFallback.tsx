"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

interface AppErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  sectionName?: string;
}

export function AppErrorFallback({
  error,
  reset,
  sectionName = "this section",
}: AppErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Same reason as global-error.tsx: the boundary catches the error, so
    // nothing else reports it. Every route-level error.tsx renders through
    // this component, so one call covers them all.
    Sentry.captureException(error, { tags: { section: sectionName } });
    logger.error(`App error in ${sectionName}:`, error);
  }, [error, sectionName]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-1)]">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-3)]">
          An unexpected error occurred in {sectionName}. Your data is safe.
        </p>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mb-6 text-xs text-[var(--color-text-3)] underline transition-colors hover:text-[var(--color-text-1)]"
        >
          {showDetails ? "Hide Error Details" : "Show Error Details"}
        </button>

        {showDetails && (
          <div className="mb-6 max-h-40 overflow-auto rounded-lg border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.1)] p-4 text-left">
            <p className="font-mono text-sm whitespace-pre-wrap text-[#F87171]">
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-500">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => reset()}
          className="w-full rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--color-background)] transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
