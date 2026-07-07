"use client";

import React from "react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)]">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-text-3)]"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-1)]">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-sm text-[var(--color-text-3)]">
        Check your internet connection and try again. Your data is safe and will
        sync when you&apos;re back online.
      </p>
    </div>
  );
}
