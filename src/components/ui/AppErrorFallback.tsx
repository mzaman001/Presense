"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

interface AppErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  sectionName?: string;
}

export function AppErrorFallback({ error, reset, sectionName = "this section" }: AppErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    logger.error(`App error in ${sectionName}:`, error);
  }, [error, sectionName]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center backdrop-blur-xl shadow-2xl">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-1)]">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-3)]">
          An unexpected error occurred in {sectionName}. Your data is safe.
        </p>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] mb-6 underline transition-colors"
        >
          {showDetails ? "Hide Error Details" : "Show Error Details"}
        </button>

        {showDetails && (
          <div className="mb-6 p-4 rounded-lg bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] text-left overflow-auto max-h-40">
            <p className="text-[#F87171] text-sm font-mono whitespace-pre-wrap">{error.message || "Unknown error"}</p>
            {error.digest && <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>}
          </div>
        )}

        <button
          onClick={() => reset()}
          className="rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--color-background)] transition hover:opacity-90 w-full"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
