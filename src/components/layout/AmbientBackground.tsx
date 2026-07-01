"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function AmbientBackground() {
  const userSettings = useAppStore(s => s.userSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="ambient-bg">
        <div className="noise-layer" />
      </div>
    );
  }

  const enabled = userSettings?.ambient_bg !== false;

  return (
    <div className="ambient-bg">
      {enabled && (
        <>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
          {/* Floating particle dots */}
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
          <div className="particle particle-5" />
          <div className="particle particle-6" />
          <div className="particle particle-7" />
          <div className="particle particle-8" />
        </>
      )}
      <div className="noise-layer" />
    </div>
  );
}
