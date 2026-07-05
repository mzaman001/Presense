"use client";

import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";
import { Search, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Icon as UiIcon } from "@/components/ui/Icon";

export function MobileTopBar() {
  const { userSettings, setSettingsModalOpen, setSearchModalOpen, setIsMobileDrawerOpen } = useAppStore();

  return (
    <header className="md:hidden fixed top-0 left-0 w-full h-[52px] border-b border-[var(--border-subtle)] bg-[var(--color-background)]/95 backdrop-blur-md z-40 flex items-center justify-between px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center justify-center -ml-2 p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
          aria-label="Open navigation menu"
        >
          <UiIcon size={20} strokeWidth={1.5} icon={Menu} />
        </button>
        {userSettings?.display_name && (
          <button 
            onClick={() => setSettingsModalOpen(true, "account")}
            className="flex items-center"
          >
            <Avatar 
              name={userSettings.display_name} 
              color={userSettings.avatar_color || "#7692FF"} 
              size="sm"
            />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setSearchModalOpen(true)}
          className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
        >
          <UiIcon size={20} strokeWidth={1.5} icon={Search} />
        </button>
        <Link 
          href="/inbox"
          className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
        >
          <UiIcon size={20} strokeWidth={1.5} icon={Bell} />
        </Link>
      </div>
    </header>
  );
}
