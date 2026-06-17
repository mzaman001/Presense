"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] p-8 text-center backdrop-blur-xl">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--text-1)]">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-[var(--text-2)]">
          An unexpected error occurred. Your data is safe.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--text-on-accent)] transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
