"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { navItems } from "@/lib/nav-config";
import { CaptureModal, SearchModal } from "@/components/layout/DynamicModals";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const { setCaptureModalOpen, setSearchModalOpen, setSettingsModalOpen } =
    useAppStore(
      useShallow((s) => ({
        setCaptureModalOpen: s.setCaptureModalOpen,
        setSearchModalOpen: s.setSearchModalOpen,
        setSettingsModalOpen: s.setSettingsModalOpen,
      })),
    );

  const router = useRouter();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || useAppStore.getState().isMobileDrawerOpen)
        return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Global escape to blur inputs (optional UX improvement)
        if (e.key === "Escape") target.blur();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // PERF-20: start fetching the search chunk before the modal
        // mounts so ⌘K opens without paying the chunk transfer/eval cost
        SearchModal.preload();
        setSearchModalOpen(true);
        return;
      }

      // Close all modals on Escape
      if (e.key === "Escape") {
        setCaptureModalOpen(false);
        setSearchModalOpen(false);
        setSettingsModalOpen(false);
      }

      // Navigation shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const destination = navItems.find((item) => item.shortcut === e.key);
        if (destination) {
          e.preventDefault();
          router.push(destination.href);
          return;
        }
        switch (e.key) {
          case "c":
          case "n":
            e.preventDefault();
            // Same preload trick as ⌘K: fetch the chunk before the modal
            // mounts so the first open isn't a blank frame.
            CaptureModal.preload();
            setCaptureModalOpen(true);
            break;
          case "/":
            e.preventDefault();
            setSearchModalOpen(true);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [router, setCaptureModalOpen, setSearchModalOpen, setSettingsModalOpen]);

  return (
    <main
      id="main-content"
      className={cn(
        "relative z-10 flex min-w-0 flex-1 flex-col pb-[calc(var(--mobile-bottom-nav-h)+env(safe-area-inset-bottom,0px)+var(--space-4))] md:pb-0",
        "pt-[calc(env(safe-area-inset-top,0px)+var(--mobile-top-bar-h)+var(--space-2))] md:pt-8",
        "md:ml-[var(--sidebar-w-collapsed)]",
      )}
    >
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 pt-0 md:p-8">
        {children}
      </div>
    </main>
  );
}
