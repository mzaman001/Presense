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
  Compass, 
  Settings,
  Search,
  Inbox,
  X
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { Icon as UiIcon } from "@/components/ui/Icon";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/people", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Compass },
];

export function MobileDrawer() {
  const pathname = usePathname();
  const { isMobileDrawerOpen, setIsMobileDrawerOpen, setSearchModalOpen, setSettingsModalOpen } = useAppStore(
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
            className="md:hidden fixed inset-0 z-50 bg-black/50"
          />
          <m.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="mobile-drawer md:hidden fixed top-0 left-0 h-full w-[280px] z-50 border-r border-[var(--border-subtle)] flex flex-col p-4 shadow-2xl"
            style={{ backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#brand-gradient)" className="shrink-0">
                  <circle cx="12" cy="12" r="12" />
                </svg>
                <span className="text-title-lg font-semibold tracking-tight text-[var(--color-text-1)]">Presense</span>
              </div>
              <button 
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded-full hover:bg-[var(--surface-hover)]"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={X} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href === "/remember/people" ? pathname.startsWith("/remember") : pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center h-[44px] rounded-lg px-3 gap-3 transition-colors",
                      isActive 
                        ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium" 
                        : "text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                    <span className="text-title-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setSearchModalOpen(true);
                }}
                className="flex items-center h-[44px] rounded-lg px-3 gap-3 text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)] transition-colors"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={Search} />
                <span className="text-title-sm">Search</span>
              </button>
              
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setSettingsModalOpen(true);
                }}
                className="flex items-center h-[44px] rounded-lg px-3 gap-3 text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)] transition-colors"
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
