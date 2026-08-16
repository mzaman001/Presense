"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SearchModal } from "@/components/layout/DynamicModals";

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
      // Don't trigger shortcuts if user is typing in an input
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
        (SearchModal as typeof SearchModal & { preload: () => void }).preload();
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
        switch (e.key) {
          case "1":
            router.push("/inbox");
            break;
          case "2":
            router.push("/do");
            break;
          case "3":
            router.push("/remember/people");
            break;
          case "4":
            router.push("/think");
            break;
          case "5":
            router.push("/explore");
            break;
          case "6":
            router.push("/");
            break;
          case "c":
            e.preventDefault();
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
        "relative z-10 flex flex-1 flex-col pb-24 md:pb-0",
        "pt-[calc(env(safe-area-inset-top)+52px+0.5rem)] md:pt-8",
        "transition-[margin-left] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
        "md:ml-[80px]",
      )}
    >
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 pt-0 md:p-8">
        {children}
      </div>
    </main>
  );
}
