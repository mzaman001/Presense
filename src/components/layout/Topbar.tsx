"use client";

import React from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function Topbar() {
  const { setSearchModalOpen } = useAppStore();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-4 bg-[rgba(11,9,20,0.6)] backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="flex-1" />
      <button 
        onClick={() => setSearchModalOpen(true)}
        className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-2 w-full max-w-md text-[var(--color-text-3)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--color-text-1)] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm font-medium">Search...</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase border border-[var(--color-border)] px-2 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-text-2)]">
          <kbd>Cmd</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <div className="flex-1" />
    </header>
  );
}
