"use client";

import React from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

/**
 * Beautiful orbital loading spinner using Framer Motion.
 * Three rings orbit at different speeds creating a fluid, premium feel.
 */
export function LoadingSpinner({ size = "md", className, label }: LoadingSpinnerProps) {
  const dimensions = { sm: 20, md: 32, lg: 48 };
  const dim = dimensions[size];
  const r = dim / 2;

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      role="status"
      aria-label={label ?? "Loading..."}
    >
      <div style={{ width: dim, height: dim }} className="relative">
        {/* Outer ring */}
        <m.svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx={r}
            cy={r}
            r={r - 2}
            fill="none"
            stroke="url(#spinner-gradient-outer)"
            strokeWidth={size === "sm" ? 1.5 : 2}
            strokeLinecap="round"
            strokeDasharray={`${(r - 2) * 2 * Math.PI * 0.65} ${(r - 2) * 2 * Math.PI * 0.35}`}
          />
          <defs>
            <linearGradient id="spinner-gradient-outer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
            </linearGradient>
          </defs>
        </m.svg>

        {/* Inner ring (counter-rotation) */}
        {size !== "sm" && (
          <m.svg
            width={dim}
            height={dim}
            viewBox={`0 0 ${dim} ${dim}`}
            className="absolute inset-0"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx={r}
              cy={r}
              r={r - 6}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={`${(r - 6) * 2 * Math.PI * 0.3} ${(r - 6) * 2 * Math.PI * 0.7}`}
              opacity={0.5}
            />
          </m.svg>
        )}

        {/* Center dot */}
        <m.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="rounded-full bg-[var(--accent)]"
            style={{
              width: size === "sm" ? 4 : size === "md" ? 5 : 7,
              height: size === "sm" ? 4 : size === "md" ? 5 : 7,
            }}
          />
        </m.div>
      </div>

      {label && (
        <span className="text-xs text-[var(--color-text-3)] font-medium">{label}</span>
      )}
    </div>
  );
}

/**
 * Inline button spinner — replaces icon inside buttons during async ops.
 */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <m.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={cn("text-current", className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="22 12"
        opacity={0.9}
      />
    </m.svg>
  );
}
