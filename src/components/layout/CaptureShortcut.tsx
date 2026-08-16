"use client";

// PWA2-01 (2026-08-16): web-app manifest shortcut "Quick Capture" navigates to
// `/?capture=1`; this component opens the capture modal when that param is
// present so the PWA shortcut actually opens capture, not just the home page.
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

export function CaptureShortcut() {
  const searchParams = useSearchParams();
  const setCaptureModalOpen = useAppStore((s) => s.setCaptureModalOpen);

  useEffect(() => {
    if (searchParams.get("capture") === "1") {
      setCaptureModalOpen(true);
    }
    // Open at most once per mount; do not pollute history by rewriting the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
