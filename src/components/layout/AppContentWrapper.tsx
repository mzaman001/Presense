"use client";

import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const isSidebarCollapsed = useAppStore(s => s.isSidebarCollapsed);

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
