"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const {
    isSidebarCollapsed,
    setCaptureModalOpen,
    setSearchModalOpen,
    setSettingsModalOpen
  } = useAppStore();
  
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
      className={cn(
        "flex-1 flex flex-col pb-24 md:pb-0 relative z-10 pt-4 md:pt-8 transition-all duration-300",
        isSidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"
      )}
    >
      <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pt-0">
        {children}
      </div>
    </main>
  );
}
