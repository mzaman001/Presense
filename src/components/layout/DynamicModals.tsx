"use client";

// This client component wrapper allows us to use dynamic() with ssr:false
// for heavy modals, reducing the initial bundle significantly.
import dynamic from "next/dynamic";

const CaptureModal = dynamic(
  () => import("@/components/features/CaptureModal").then(m => ({ default: m.CaptureModal })),
  { ssr: false, loading: () => null }
);

const SearchModal = dynamic(
  () => import("@/components/features/SearchModal").then(m => ({ default: m.SearchModal })),
  { ssr: false, loading: () => null }
);

const SettingsModal = dynamic(
  () => import("@/components/features/SettingsModal").then(m => ({ default: m.SettingsModal })),
  { ssr: false, loading: () => null }
);

const PomodoroTimer = dynamic(
  () => import("@/components/features/PomodoroTimer").then(m => ({ default: m.PomodoroTimer })),
  { ssr: false, loading: () => null }
);

export function DynamicModals() {
  return (
    <>
      <CaptureModal />
      <SearchModal />
      <SettingsModal />
      <PomodoroTimer />
    </>
  );
}
