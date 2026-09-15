"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House as Home,
  Check,
  Brain,
  MessageSquare,
  Settings,
  Search,
  Inbox,
  X,
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { Icon as UiIcon } from "@/components/ui/Icon";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/locations", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
];

export function MobileDrawer() {
  const pathname = usePathname();
  const {
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    setSearchModalOpen,
    setSettingsModalOpen,
  } = useAppStore(
    useShallow((s) => ({
      isMobileDrawerOpen: s.isMobileDrawerOpen,
      setIsMobileDrawerOpen: s.setIsMobileDrawerOpen,
      setSearchModalOpen: s.setSearchModalOpen,
      setSettingsModalOpen: s.setSettingsModalOpen,
    })),
  );

  return (
    <AnimatePresence>
      {isMobileDrawerOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
          />
          <m.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="mobile-drawer fixed top-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-[var(--border-subtle)] p-4 shadow-2xl md:hidden"
            style={{
              backdropFilter: "blur(48px)",
              WebkitBackdropFilter: "blur(48px)",
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="url(#brand-gradient)"
                  className="shrink-0"
                >
                  <circle cx="12" cy="12" r="12" />
                </svg>
                <span className="text-title-lg font-semibold tracking-tight text-[var(--color-text-1)]">
                  Presense
                </span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="rounded-full p-2 text-[var(--color-text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--color-text-1)]"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={X} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href.startsWith("/remember")
                    ? pathname.startsWith("/remember")
                    : pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={cn(
                      "flex h-[44px] items-center gap-3 rounded-lg px-3 transition-colors",
                      isActive
                        ? "bg-[var(--accent-dim)] font-medium text-[var(--accent)]"
                        : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                    <span className="text-title-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-4">
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setSearchModalOpen(true);
                }}
                className="flex h-[44px] items-center gap-3 rounded-lg px-3 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={Search} />
                <span className="text-title-sm">Search</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setSettingsModalOpen(true);
                }}
                className="flex h-[44px] items-center gap-3 rounded-lg px-3 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={Settings} />
                <span className="text-title-sm">Settings</span>
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
