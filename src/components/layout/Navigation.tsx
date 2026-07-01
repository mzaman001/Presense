"use client";

import React, { useState } from "react";
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
  Plus,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Sparkles,
  CheckCircle2,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";
import { m, AnimatePresence } from "framer-motion";
import { useIsTouch } from "@/hooks/useIsTouch";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/people", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Compass },
];

function NavTooltip({ label, shortcut, show }: { label: string, shortcut?: string, show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -5 }}
          transition={{ duration: 0.15, delay: 0.4 }}
          className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-[var(--surface-dropdown)] border border-[var(--border-strong)] text-xs font-medium shadow-xl z-50 whitespace-nowrap flex items-center gap-2 pointer-events-none text-white"
        >
          {label}
          {shortcut && <span className="text-[10px] opacity-70">{shortcut}</span>}
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isSidebarCollapsed = useAppStore(s => s.isSidebarCollapsed);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const userSettings = useAppStore(s => s.userSettings);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const isTouch = useIsTouch();

  return (
    <aside 
      className={cn(
        "sidebar hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 group/sidebar border-r border-[var(--border-subtle)] bg-[var(--color-background)]",
        "transition-[width] duration-250 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
        isSidebarCollapsed ? "w-[64px]" : "w-[220px]"
      )}
    >
      {/* Header section: 60px tall */}
      <div className={cn("relative h-[60px] flex items-center border-b border-[var(--border-subtle)] shrink-0", isSidebarCollapsed ? "px-2" : "px-4")}>
        <div className={cn("flex items-center w-full", isSidebarCollapsed ? "justify-start pl-1.5" : "gap-3")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="url(#brand-gradient)" className="shrink-0">
            <defs>
              <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-deep)" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="12" />
          </svg>
          {!isSidebarCollapsed && <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-1)] whitespace-nowrap overflow-hidden overflow-ellipsis">Presense</span>}
        </div>
        
        <button 
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors p-2 flex items-center justify-center right-0"
          )}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} strokeWidth={1.5} /> : <ChevronLeft size={16} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Quick Capture Button */}
      <div className={cn("shrink-0", isSidebarCollapsed ? "p-3 pt-4" : "p-3")}>
        <button 
          onMouseEnter={() => setHoveredItem("capture")}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
          className={cn(
            "relative flex items-center justify-center shrink-0 transition-all overflow-hidden",
            isSidebarCollapsed 
              ? "w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] mx-auto shadow-[var(--shadow-button-primary)] hover:scale-105" 
              : "btn-capture w-full"
          )}
        >
          <Plus size={isSidebarCollapsed ? 18 : 14} strokeWidth={1.5} className={cn("shrink-0", !isSidebarCollapsed && "mr-2")} />
          {!isSidebarCollapsed && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Quick Capture</span>}
          {isSidebarCollapsed && <NavTooltip label="Quick Capture" shortcut="Cmd+K" show={hoveredItem === "capture"} />}
        </button>
      </div>

      {/* Nav Items - 12px gap below capture implies mt-3 or just gap-1 in the nav */}
      <nav className={cn("flex-1 flex flex-col gap-1 w-full", isSidebarCollapsed ? "px-3" : "px-3")}>
        {/* Plan my day Button */}
        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("plan-day")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {(() => {
            const now = useMemo(() => new Date(), []);
            const currentHours = now.getHours();
            const todayStr = now.toLocaleDateString("en-CA");
            const morningDone = userSettings?.last_ritual_date === todayStr;
            const eveningDone = userSettings?.last_evening_ritual_date === todayStr;
            const shutdownHour = parseInt(userSettings?.shutdown_time?.split(':')[0] || '17', 10);
            
            let state: "morning" | "evening" | "done" | "all_done" = "morning";
            
            if (morningDone && eveningDone) state = "all_done";
            else if (morningDone && currentHours >= shutdownHour) state = "evening";
            else if (morningDone) state = "done";
            
            const Icon = state === "all_done" || state === "done" ? CheckCircle2 :
                         state === "evening" ? Moon : Sparkles;
                         
            const label = state === "all_done" ? "All done ✓" :
                          state === "done" ? "Day planned ✓" :
                          state === "evening" ? "Evening review" : "Plan my day";

            return (
              <button
                onClick={() => {
                  if (useAppStore.getState().activeRitual) return;
                  if (state === "all_done" || state === "done") {
                    return; // Prevent reopening if completed
                  }
                  useAppStore.getState().setActiveRitual(state === "evening" ? "evening" : "morning");
                }}
                className={cn(
                  "flex items-center h-[36px] transition-all relative group w-full mb-2",
                  isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "rounded-[var(--radius-sm)] px-3 gap-3",
                  (state === "all_done" || state === "done") 
                    ? "text-[var(--text-4)] hover:text-[var(--text-1)] bg-transparent hover:bg-[rgba(255,255,255,0.02)]" 
                    : "text-[var(--accent)] bg-[var(--accent-dim)]/10 hover:bg-[var(--accent-dim)] hover:text-[var(--accent)] border border-[var(--accent)]/15"
                )}
              >
                <div className="flex items-center justify-center shrink-0">
                  <Icon size={18} strokeWidth={1.5} className={(state === "all_done" || state === "done") ? "" : "text-[var(--accent)]"} />
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[13px] font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                    {hoveredItem === "plan-day" && state === "done" ? "Review your day" : 
                     hoveredItem === "plan-day" && state === "all_done" ? "Already done" : label}
                  </span>
                )}
              </button>
            );
          })()}
          {isSidebarCollapsed && <NavTooltip label="Plan my day" show={hoveredItem === "plan-day"} />}
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/remember/people" ? pathname.startsWith("/remember") : pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <div 
              key={item.href} 
              className="relative w-full"
              onMouseEnter={() => setHoveredItem(item.href)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <Link
                href={item.href}
                prefetch={true}
                className={cn(
                  "flex items-center h-[36px] transition-all relative group",
                  isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "w-full rounded-[var(--radius-sm)] px-3 gap-3",
                  isActive 
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]" 
                    : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                )}
              >
                {/* Active left indicator */}
                {!isSidebarCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[20px]">
                    {isActive && (
                      <m.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-[var(--accent)] rounded-r-full"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-center shrink-0">
                  <Icon 
                    size={18} 
                    strokeWidth={1.5}
                    className={cn(
                      "transition-all",
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]",
                      !isTouch && !isActive && "group-hover:translate-x-0.5"
                    )} 
                  />
                </div>
                
                {!isSidebarCollapsed && (
                  <span className="text-[13px] font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                )}
              </Link>
              
              {isSidebarCollapsed && (
                <NavTooltip label={item.label} show={hoveredItem === item.href} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className={cn("flex flex-col gap-1 pb-[52px]", isSidebarCollapsed ? "px-3" : "px-3")}>
        {/* Search */}
        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("search")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => useAppStore.getState().setSearchModalOpen(true)}
            className={cn(
              "flex items-center h-[36px] transition-all relative group",
              isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "w-full rounded-[var(--radius-sm)] px-3 gap-3",
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            )}
          >
            <div className="flex items-center justify-center shrink-0">
              <Search size={18} strokeWidth={1.5} className="group-hover:text-[var(--text-2)] transition-colors" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0 overflow-hidden">
                <span className="text-[13px] font-medium leading-none text-[var(--text-3)] whitespace-nowrap">Search</span>
                <span className="text-[10px] font-mono text-[var(--text-3)] whitespace-nowrap shrink-0 ml-2">Cmd+K</span>
              </div>
            )}
          </button>
          {isSidebarCollapsed && <NavTooltip label="Search" shortcut="Cmd+K" show={hoveredItem === "search"} />}
        </div>

        {/* Settings */}
        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("settings")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
            className={cn(
              "flex items-center h-[36px] transition-all relative group",
              isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "w-full rounded-[var(--radius-sm)] px-3 gap-3",
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            )}
          >
            <div className="flex items-center justify-center shrink-0">
              <Settings size={18} strokeWidth={1.5} className="group-hover:text-[var(--text-2)] transition-colors" />
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[13px] font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis">Settings</span>
            )}
          </button>
          {isSidebarCollapsed && <NavTooltip label="Settings" show={hoveredItem === "settings"} />}
        </div>
      </div>

      {/* User Row - absolute positioned at the bottom 52px */}
      <button 
        onClick={() => useAppStore.getState().setSettingsModalOpen(true, "account")}
        className={cn(
          "absolute bottom-0 left-0 w-full h-[52px] border-t border-[var(--border-subtle)] flex items-center transition-colors text-left",
          "hover:bg-[var(--surface-hover)] cursor-pointer group/user",
          isSidebarCollapsed ? "justify-center" : "px-4"
        )}
      >
        {userSettings?.display_name && (
          <div className={cn("flex items-center gap-3", !isSidebarCollapsed && "w-full")}>
            <Avatar 
              name={userSettings.display_name} 
              color={userSettings.avatar_color || "#7692FF"} 
              size="sm"
            />
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="text-[13px] font-medium text-[var(--color-text-1)] truncate leading-tight whitespace-nowrap">{userSettings.display_name}</span>
              </div>
            )}
          </div>
        )}
      </button>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const setCaptureModalOpen = useAppStore(s => s.setCaptureModalOpen);

  const mobileNavItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/do", label: "Do", icon: Check },
    { href: "capture", label: "Capture", icon: Plus, isAction: true },
    { href: "/think", label: "Think", icon: MessageSquare },
    { href: "/explore", label: "Explore", icon: Compass },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-[var(--border-subtle)] bg-[var(--color-background)]/95 backdrop-blur-md z-40 pb-safe">
      <div className="flex items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          if (item.isAction) {
            return (
              <button
                key="capture"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([15]);
                  }
                  setCaptureModalOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-1 min-h-[56px] min-w-[44px] flex-1 py-2 rounded-xl transition-all active:scale-95 text-[var(--color-text-1)]"
              >
                <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-text-1)] text-[var(--color-background)] shadow-lg -mt-6 border-[4px] border-[var(--color-background)]">
                  <Plus size={24} strokeWidth={2} />
                </div>
              </button>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                // Minimum 44px touch target per WCAG 2.5.5
                "flex flex-col items-center justify-center gap-1 min-h-[56px] min-w-[44px] flex-1 py-2 rounded-xl transition-all active:scale-95",
                isActive ? "text-[var(--color-text-1)]" : "text-[var(--color-text-3)]"
              )}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className={cn("shrink-0 transition-colors", isActive ? "text-[var(--accent)]" : "text-[var(--text-3)]")}
                />
                {isActive && (
                  <m.div
                    layoutId="bottom-nav-active"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-[var(--accent)]" : "text-[var(--text-3)]")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
