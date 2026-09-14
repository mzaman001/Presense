"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { Avatar } from "@/components/ui/Avatar";
import { avatarAccentFallback } from "@/components/layout/Navigation";
import { Search, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Icon as UiIcon } from "@/components/ui/Icon";

export function MobileTopBar() {
  const {
    userSettings,
    setSettingsModalOpen,
    setSearchModalOpen,
    setIsMobileDrawerOpen,
  } = useAppStore(
    useShallow((s) => ({
      userSettings: s.userSettings,
      setSettingsModalOpen: s.setSettingsModalOpen,
      setSearchModalOpen: s.setSearchModalOpen,
      setIsMobileDrawerOpen: s.setIsMobileDrawerOpen,
    })),
  );

  return (
    <header
      className="mobile-top-bar fixed top-0 left-0 z-40 flex h-[52px] w-full items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--color-background)]/95 px-4 md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="-ml-2 flex items-center justify-center p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
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
              color={userSettings.avatar_color || avatarAccentFallback()}
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
