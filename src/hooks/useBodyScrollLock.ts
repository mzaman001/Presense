"use client";

import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.dataset.overlayOpen = "true";
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
        delete document.documentElement.dataset.overlayOpen;
      }
    };
  }, [locked]);
}
