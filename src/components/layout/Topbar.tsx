"use client";

import React from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePathname } from "next/navigation";

export function Topbar() {
  const setSearchModalOpen = useAppStore(s => s.setSearchModalOpen);
  const pathname = usePathname();

  let title = "";
  let subtitle = "";

  if (pathname === "/do") {
    title = "Do."; subtitle = "Execute your tasks.";
  } else if (pathname === "/think") {
    title = "Think."; subtitle = "Develop your thoughts.";
  } else if (pathname === "/remember") {
    title = "Remember."; subtitle = "Important people and places.";
  } else if (pathname === "/explore") {
    title = "Explore."; subtitle = "Your curated resources.";
  } else if (pathname === "/settings") {
    title = "Settings."; subtitle = "Manage your preferences.";
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-4 bg-[rgba(11,9,20,0.6)] backdrop-blur-xl border-b border-[var(--border-default)]">
      <div className="flex-1 flex flex-col justify-center">
        {title && (
          <>
            <h1 className="text-page-title text-[var(--text-1)]">{title}</h1>
            <p className="text-body text-[var(--text-3)]">{subtitle}</p>
          </>
        )}
      </div>
      
      <button 
        onClick={() => setSearchModalOpen(true)}
        className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-full px-4 py-2 w-full max-w-md text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <Search size={16} strokeWidth={1.5} className="shrink-0" />
        <span className="text-body-small">Search...</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-label border border-[var(--border-default)] px-2 py-0.5 rounded bg-[var(--surface-1)] text-[var(--text-2)]">
          <kbd>Cmd</kbd>
          <kbd>/</kbd>
        </span>
      </button>
      
      <div className="flex-1" />
    </header>
  );
}
