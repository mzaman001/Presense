"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type OnboardingPhase = 1 | 2 | 3 | 4 | 5;

interface OnboardingBackgroundProps {
  phase?: OnboardingPhase;
  className?: string;
}

// Per-phase glow configurations
const PHASE_CONFIG: Record<OnboardingPhase, {
  glowColor: string;
  glowX: string;
  glowY: string;
  glowOpacity: number;
  glowOpacityLight: number;
}> = {
  1: { glowColor: "radial-gradient(ellipse, #E5B41E 0%, #EB4233 35%, transparent 70%)", glowX: "15%", glowY: "-20%", glowOpacity: 0.55, glowOpacityLight: 0.35 },
  2: { glowColor: "radial-gradient(ellipse, #EB6B1E 0%, #EB4233 35%, transparent 70%)", glowX: "10%", glowY: "-20%", glowOpacity: 0.55, glowOpacityLight: 0.30 },
  3: { glowColor: "radial-gradient(ellipse, #F0C830 0%, #E5B41E 40%, transparent 70%)", glowX: "15%", glowY: "-20%", glowOpacity: 0.60, glowOpacityLight: 0.35 },
  4: { glowColor: "radial-gradient(ellipse, #E5B41E 0%, #EB4233 30%, transparent 70%)", glowX: "15%", glowY: "-20%", glowOpacity: 0.70, glowOpacityLight: 0.45 },
  5: { glowColor: "radial-gradient(ellipse, #F0C830 0%, #E5B41E 30%, #EB4233 60%, transparent 75%)", glowX: "15%", glowY: "-20%", glowOpacity: 0.80, glowOpacityLight: 0.50 },
};

export function OnboardingBackground({ phase = 1, className }: OnboardingBackgroundProps) {
  const glowRef = useRef<HTMLDivElement>(null);

  // Phase 4 glow burst
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (phase === 4 && prevPhaseRef.current !== 4 && glowRef.current) {
      glowRef.current.classList.add("onboarding-glow-burst");
      const t = setTimeout(() => {
        glowRef.current?.classList.remove("onboarding-glow-burst");
      }, 650);
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  const cfg = PHASE_CONFIG[phase];

  return (
    <div className={cn("fixed inset-0 overflow-hidden", className)} style={{ zIndex: 0 }}>
      {/* Layer 1 — Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 140% 100% at 50% 120%, #3B1814 0%, #1A0800 40%, #0F0A00 100%)",
        }}
      />

      {/* Layer 1 Light — warm sunrise base */}
      <div
        className="absolute inset-0 opacity-0 html-light:opacity-100"
        style={{
          background: "radial-gradient(ellipse 140% 100% at 50% 120%, #F5A032 0%, #FBD89A 35%, #FBF6EE 70%, #F7EDD8 100%)",
        }}
      />

      {/* Layer 2 — The warm glow rising */}
      <div
        ref={glowRef}
        className="absolute"
        style={{
          width: "70%",
          height: "60%",
          left: cfg.glowX,
          bottom: cfg.glowY,
          background: cfg.glowColor,
          filter: "blur(60px)",
          opacity: cfg.glowOpacity,
          transition: "opacity 400ms ease, background 400ms ease, left 400ms ease",
          animation: "orb-pulse 4s ease-in-out infinite alternate",
          transformOrigin: "center center",
        }}
      />

      {/* Layer 3 — Light columns */}
      <div
        className="absolute bottom-0"
        style={{
          left: "44%",
          width: 2,
          height: "40%",
          background: "linear-gradient(to top, var(--accent) 0%, transparent 100%)",
          filter: "blur(4px)",
          opacity: 0.4,
          animation: "drift-column 6s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute bottom-0"
        style={{
          left: "52%",
          width: 2,
          height: "40%",
          background: "linear-gradient(to top, var(--accent) 0%, transparent 100%)",
          filter: "blur(4px)",
          opacity: 0.4,
          animation: "drift-column 6s ease-in-out infinite alternate-reverse",
        }}
      />

      {/* Layer 4 — Noise */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.04,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />

      {/* Layer 5 — Glass fog vignette at top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: "30%",
          background: "linear-gradient(to bottom, var(--bg-base) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// Split layout wrapper for onboarding screens
interface OnboardingSplitProps {
  phase?: OnboardingPhase;
  children: React.ReactNode; // right panel content
  quote?: string;
}

export function OnboardingSplit({
  phase = 1,
  children,
  quote = "Your thoughts, finally somewhere safe.",
}: OnboardingSplitProps) {
  return (
    <div className="min-h-screen flex relative">
      <OnboardingBackground phase={phase} />

      {/* Left panel — 45% on desktop, hidden on mobile */}
      <div className="hidden md:flex md:w-[45%] flex-col justify-between p-10 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <PresenseLogo />
          <span className="text-[18px] font-semibold text-[var(--text-1)] tracking-tight">Presense</span>
        </div>

        {/* Quote */}
        <p
          className="text-[26px] font-medium leading-[1.3] tracking-tight max-w-[320px]"
          style={{ color: "var(--text-1)" }}
        >
          {quote}
        </p>
      </div>

      {/* Right panel — 55% on desktop, 100% on mobile */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-6 md:p-10 relative z-10 min-h-screen">
        <div
          className="w-full max-w-[420px] rounded-[var(--radius-xl)] p-8"
          style={{
            background: "var(--surface-modal)",
            backdropFilter: "blur(32px)",
            border: "0.5px solid var(--border-strong)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Reusable Presense logo mark SVG
export function PresenseLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#0F0A00" />
      <defs>
        <linearGradient id="pg1" x1="100" y1="100" x2="380" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E5B41E" />
          <stop offset="100%" stopColor="#EB4233" />
        </linearGradient>
        <linearGradient id="pg2" x1="380" y1="120" x2="140" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EB4233" />
          <stop offset="100%" stopColor="#E5B41E" />
        </linearGradient>
      </defs>
      {/* Primary teardrop */}
      <path
        d="M230 170 C280 120, 360 160, 340 240 C320 310, 240 350, 190 310 C140 270, 180 220, 230 170Z"
        fill="url(#pg1)"
        opacity="1"
      />
      {/* Secondary teardrop */}
      <path
        d="M290 140 C340 110, 400 160, 370 230 C345 295, 270 320, 235 275 C200 230, 240 170, 290 140Z"
        fill="url(#pg2)"
        opacity="0.85"
        style={{ mixBlendMode: "screen" }}
      />
    </svg>
  );
}
