"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    logger.error("App error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-[#111111] p-6 text-white font-sans">
          <div className="w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] p-8 text-center shadow-2xl">
            <div className="mb-4 text-5xl">âš ï¸</div>
            <h2 className="mb-2 text-2xl font-bold">Fatal Application Error</h2>
            <p className="mb-6 text-sm text-gray-400">
              Presense encountered an unexpected error. Your data is safe.
            </p>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-300 mb-6 underline transition-colors"
            >
              {showDetails ? "Hide Error Details" : "Show Error Details"}
            </button>

            {showDetails && (
              <div className="mb-6 p-4 rounded-lg bg-black/50 border border-red-500/20 text-left overflow-auto max-h-40">
                <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error.message || "Unknown error"}</p>
                {error.digest && <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/'}
                className="rounded-xl bg-[rgba(255,255,255,0.1)] px-6 py-2.5 text-sm font-medium transition hover:bg-[rgba(255,255,255,0.15)]"
              >
                Go Home
              </button>
              <button
                onClick={() => {
                  reset();
                  window.location.reload();
                }}
                className="rounded-xl bg-[#2DD4BF] px-6 py-2.5 text-sm font-medium text-black transition hover:bg-[#34d399]"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
