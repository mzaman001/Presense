"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function AmbientBackground() {
  const { userSettings } = useAppStore();
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
        </>
      )}
      <div className="noise-layer" />
    </div>
  );
}
