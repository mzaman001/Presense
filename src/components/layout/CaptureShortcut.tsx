"use client";

// Opens Quick Capture from outside the app:
// - the home-screen shortcut "Quick Capture" (manifest `shortcuts`) → /?capture=1
// - the Android share sheet (manifest `share_target`) → /?capture=1&text=…
//
// Mounted in the (app) layout so capture opens straight away on any route.
// It used to live inside Home and only mounted once Home's data had loaded,
// so the shortcut waited on the dashboard.
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { CaptureModal } from "@/components/layout/DynamicModals";

/** A shared page arrives as title + text + url; join what's there. */
export function sharedCaptureText(params: URLSearchParams): string {
  return [params.get("title"), params.get("text"), params.get("url")]
    .map((part) => part?.trim())
    .filter((part, i, all): part is string => !!part && all.indexOf(part) === i)
    .join(" ");
}

export function CaptureShortcut() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("capture") !== "1") return;
    const { setCaptureModalPrefill, setCaptureModalOpen } =
      useAppStore.getState();
    const shared = sharedCaptureText(searchParams);
    if (shared) setCaptureModalPrefill(shared);
    CaptureModal.preload();
    setCaptureModalOpen(true);
    // Drop the params without a history entry, so a refresh or Back doesn't
    // open capture again.
    const url = new URL(window.location.href);
    for (const key of ["capture", "title", "text", "url"])
      url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
    // Once per mount: the params are consumed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
