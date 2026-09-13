"use client";

// This client component wrapper allows us to use dynamic() with ssr:false
// for heavy modals, reducing the initial bundle significantly.
import dynamic from "next/dynamic";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow";

export const CaptureModal = dynamic(
  () =>
    import("@/components/features/CaptureModal").then((m) => ({
      default: m.CaptureModal,
    })),
  { ssr: false, loading: () => null },
);

export const SearchModal = dynamic(
  () =>
    import("@/components/features/SearchModal").then((m) => ({
      default: m.SearchModal,
    })),
  { ssr: false, loading: () => null },
);

export const SettingsModal = dynamic(
  () =>
    import("@/components/features/SettingsModal").then((m) => ({
      default: m.SettingsModal,
    })),
  { ssr: false, loading: () => null },
);

export const PomodoroTimer = dynamic(
  () =>
    import("@/components/features/PomodoroTimer").then((m) => ({
      default: m.PomodoroTimer,
    })),
  { ssr: false, loading: () => null },
);

/**
 * Mounts each modal only while it is open.
 *
 * `ssr: false` alone only skips server rendering — the chunks were still
 * fetched and the components still mounted on every page load, so the
 * "lazy" modals cost their transfer, evaluation and effects up front and
 * held state for the whole session. Gating on the open flag makes the split
 * actually deferred, and gives each modal fresh state per open instead of
 * reset-on-close effects.
 *
 * PomodoroTimer is keyed off the running timer rather than a modal flag: it
 * must stay mounted for as long as a session is counting down.
 */
export function DynamicModals() {
  const {
    isCaptureModalOpen,
    isSearchModalOpen,
    isSettingsModalOpen,
    hasTimer,
  } = useAppStore(
    useShallow((s) => ({
      isCaptureModalOpen: s.isCaptureModalOpen,
      isSearchModalOpen: s.isSearchModalOpen,
      isSettingsModalOpen: s.isSettingsModalOpen,
      hasTimer: s.activeTimer !== null,
    })),
  );

  return (
    <>
      {isCaptureModalOpen && <CaptureModal />}
      {isSearchModalOpen && <SearchModal />}
      {isSettingsModalOpen && <SettingsModal />}
      {hasTimer && <PomodoroTimer />}
    </>
  );
}
