"use client";
// PERF-19: client wrapper that lazy-loads RitualOverlay with ssr:false, so
// RitualOverlay and its react-textarea-autosize dependency stay out of the
// shared (app)-shell bundle of every protected route.
import dynamic from "next/dynamic";

const RitualOverlay = dynamic(
  () =>
    import("@/components/features/RitualOverlay").then((m) => ({
      default: m.RitualOverlay,
    })),
  { ssr: false, loading: () => null },
);

export function RitualOverlayDynamic() {
  return <RitualOverlay />;
}
