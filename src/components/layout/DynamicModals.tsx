"use client";

// This client component wrapper allows us to use dynamic() with ssr:false
// for heavy modals, reducing the initial bundle significantly.
import dynamic from "next/dynamic";
import { withPreload } from "@/lib/preloadable";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { loadFocusTimer } from "@/lib/focus-timer";

export const CaptureModal = withPreload(
  dynamic(
    () =>
      import("@/components/features/CaptureModal").then((m) => ({
        default: m.CaptureModal,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("@/components/features/CaptureModal"),
);

export const SearchModal = withPreload(
  dynamic(
    () =>
      import("@/components/features/SearchModal").then((m) => ({
        default: m.SearchModal,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("@/components/features/SearchModal"),
);

export const SettingsModal = withPreload(
  dynamic(
    () =>
      import("@/components/features/SettingsModal").then((m) => ({
        default: m.SettingsModal,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("@/components/features/SettingsModal"),
);

export const StuckTaskHelp = dynamic(
  () =>
    import("@/components/features/StuckTaskHelp").then((m) => ({
      default: m.StuckTaskHelp,
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
 * Fetch the panels' code once the page has settled, one chunk per idle
 * period, so even the first open is immediate. Fetching on the tap itself
 * (the .preload() calls on shortcuts) came too late: the first open still
 * waited ~330–385 ms for its chunk and the panel appeared after a pause.
 * Starts a few seconds after load to stay out of start-up, and skips
 * Save-Data connections, where the bytes matter more than the pause.
 */
function preloadPanelsWhenIdle(): () => void {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) return () => {};

  const queue = [CaptureModal, SearchModal, SettingsModal];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: number | undefined;
  const next = () => {
    const panel = queue.shift();
    if (!panel) return;
    const run = () => {
      panel.preload();
      next();
    };
    if ("requestIdleCallback" in window) {
      idle = requestIdleCallback(run, { timeout: 4000 });
    } else {
      timer = setTimeout(run, 200);
    }
  };
  const start = () => {
    timer = setTimeout(next, 3000);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });

  return () => {
    window.removeEventListener("load", start);
    clearTimeout(timer);
    if (idle !== undefined) cancelIdleCallback(idle);
    queue.length = 0;
  };
}

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
    hasStuckHelp,
  } = useAppStore(
    useShallow((s) => ({
      isCaptureModalOpen: s.isCaptureModalOpen,
      isSearchModalOpen: s.isSearchModalOpen,
      isSettingsModalOpen: s.isSettingsModalOpen,
      hasTimer: s.activeTimer !== null,
      hasStuckHelp: s.stuckHelpTask !== null,
    })),
  );

  // Bring back a focus session that was open before a reload or a closed
  // tab. Its countdown was always saved, but the open timer itself wasn't,
  // so it used to vanish.
  useEffect(() => {
    const saved = loadFocusTimer();
    const { activeTimer, setActiveTimer } = useAppStore.getState();
    if (saved && !activeTimer) {
      setActiveTimer({
        taskId: saved.taskId ?? undefined,
        taskTitle: saved.taskTitle ?? undefined,
        firstStep: saved.firstStep ?? null,
      });
    }
  }, []);

  useEffect(() => preloadPanelsWhenIdle(), []);

  return (
    <>
      {/* Mounted only while open, but kept on screen until the exit each
          one declares has played; without this they vanished on close. */}
      <AnimatePresence>
        {isCaptureModalOpen && <CaptureModal key="capture" />}
        {isSearchModalOpen && <SearchModal key="search" />}
        {isSettingsModalOpen && <SettingsModal key="settings" />}
      </AnimatePresence>
      {hasStuckHelp && <StuckTaskHelp />}
      {hasTimer && <PomodoroTimer />}
    </>
  );
}
