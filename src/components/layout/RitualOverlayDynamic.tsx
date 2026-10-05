"use client";
// PERF-19: client wrapper that lazy-loads RitualOverlay with ssr:false, so
// RitualOverlay and its react-textarea-autosize dependency stay out of the
// shared (app)-shell bundle of every protected route.
//
// It mounts only while a ritual is open (AGENTS.md: an unconditionally
// rendered next/dynamic component still downloads and mounts on every page).
// Mounted always, it cost every page 150-250 ms of main thread on a phone:
// the chunk's evaluation, the closed overlay's hooks, its first
// toLocaleDateString (ICU setup) and an ssr:false client-render bailout.
import dynamic from "next/dynamic";
import { withPreload } from "@/lib/preloadable";
import { useAppStore } from "@/store/useAppStore";

/** Resolves once the ritual's code is loaded, so it can open fully drawn. */
export const loadRitualOverlay = () =>
  import("@/components/features/RitualOverlay");

const RitualOverlay = withPreload(
  dynamic(
    () =>
      import("@/components/features/RitualOverlay").then((m) => ({
        default: m.RitualOverlay,
      })),
    { ssr: false, loading: () => null },
  ),
  loadRitualOverlay,
);

/** Warms the chunk from an entry point's hover or focus. */
export const preloadRitualOverlay = () => RitualOverlay.preload();

export function RitualOverlayDynamic() {
  const open = useAppStore((s) => s.activeRitual !== null);
  return open ? <RitualOverlay /> : null;
}
