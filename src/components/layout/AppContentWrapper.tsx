"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const {
    sidebarState,
    toggleSidebar,
    setCaptureModalOpen,
    setSearchModalOpen,
    setSettingsModalOpen
  } = useAppStore();
  
  const router = useRouter();

  // Restore sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('presense-sidebar');
    if (saved === 'rail' || saved === 'full') {
      useAppStore.setState({ sidebarState: saved });
    }
  }, []);

  // Persist sidebar state to localStorage on change
  useEffect(() => {
    localStorage.setItem('presense-sidebar', sidebarState);
  }, [sidebarState]);

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

      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
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
          case "1": router.push("/inbox"); break;
          case "2": router.push("/do"); break;
          case "3": router.push("/remember/people"); break;
          case "4": router.push("/think"); break;
          case "5": router.push("/explore"); break;
          case "6": router.push("/"); break;
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
  }, [router, toggleSidebar, setCaptureModalOpen, setSearchModalOpen, setSettingsModalOpen]);

  return (
    <main 
      className={cn(
        "flex-1 flex flex-col pb-24 md:pb-0 relative z-10",
        "pt-[calc(env(safe-area-inset-top)+52px+0.5rem)] md:pt-8",
        "transition-[margin-left] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
        sidebarState === "full" ? "md:ml-[220px]" : "md:ml-[56px]"
      )}
    >
      <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pt-0">
        {children}
      </div>
    </main>
  );
}
