"use client";

import React, { useState, useMemo } from "react";
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
  Inbox,
  Sparkles,
  CheckCircle2,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";
import { m } from "framer-motion";
import { useIsTouch } from "@/hooks/useIsTouch";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/people", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Compass },
];

export function Sidebar() {
  const pathname = usePathname();
  const userSettings = useAppStore(s => s.userSettings);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const isTouch = useIsTouch();
  const now = useMemo(() => new Date(), []);
  const labelClass = "ml-0 min-w-0 max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-ellipsis transition-[opacity,max-width,margin] duration-200 group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100 group-focus-within/sidebar:ml-3 group-focus-within/sidebar:max-w-[160px] group-focus-within/sidebar:opacity-100";
  const rowClass = "flex h-11 w-full items-center rounded-xl px-2 transition-colors";
  const iconClass = "flex h-10 w-10 shrink-0 items-center justify-center";

  return (
    <aside 
      aria-label="Main navigation"
      className={cn(
        "sidebar group/sidebar hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 overflow-hidden",
        "border-r border-[var(--border-subtle)] bg-[var(--color-background)]",
        "w-[80px] hover:w-[248px] focus-within:w-[248px]",
        "transition-[width] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
      )}
    >
      <div className="h-[80px] flex items-center border-b border-[var(--border-subtle)] shrink-0 px-4">
        <div className="flex items-center w-full">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="url(#brand-gradient)" className="shrink-0">
            <defs>
              <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-deep)" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="12" />
          </svg>
          <span className={cn("sidebar-title text-[17px] font-semibold tracking-tight text-[var(--color-text-1)]", labelClass)}>Presense</span>
        </div>
      </div>

      <div className="shrink-0 px-3 py-4">
        <button 
          onMouseEnter={() => setHoveredItem("capture")}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
          title="Quick Capture"
          className={cn(rowClass, "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-button-primary)] hover:brightness-105")}
        >
          <span className={iconClass}><Plus size={22} strokeWidth={1.7} /></span>
          <span className={cn("text-[14px] font-semibold", labelClass)}>Quick Capture</span>
        </button>
      </div>

      <nav id="sidebar-content" className="flex flex-col w-full gap-2 px-3 flex-1">
        <div className="relative w-full" onMouseEnter={() => setHoveredItem("plan-day")} onMouseLeave={() => setHoveredItem(null)}>
          {(() => {
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
                  useAppStore.getState().setActiveRitual(state === "evening" ? "evening" : "morning");
                }}
                title={label.replace("âœ“", "")}
                className={cn(
                  rowClass,
                  (state === "all_done" || state === "done") 
                    ? "text-[var(--text-4)] hover:text-[var(--text-1)] bg-transparent hover:bg-[rgba(255,255,255,0.02)]" 
                    : "text-[var(--accent)] bg-[var(--accent-dim)]/10 hover:bg-[var(--accent-dim)] hover:text-[var(--accent)] border border-[var(--accent)]/15"
                )}
              >
                <span className={iconClass}>
                  <Icon size={20} strokeWidth={1.5} className={(state === "all_done" || state === "done") ? "" : "text-[var(--accent)]"} />
                </span>
                <span className={cn("nav-label text-[14px] font-medium leading-none", labelClass)}>
                  {hoveredItem === "plan-day" && state === "done" ? "Review your day" : 
                   hoveredItem === "plan-day" && state === "all_done" ? "Already done" : label}
                </span>
              </button>
            );
          }          )()}
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
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={cn(
                  rowClass,
                  isActive 
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium" 
                    : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                )}
              >
                <span className={iconClass}>
                  <Icon 
                    size={20} 
                    strokeWidth={1.5}
                    className={cn(
                      "transition-all",
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]",
                      !isTouch && !isActive && "group-hover:translate-x-0.5"
                    )} 
                  />
                </span>
                
                <span className={cn("nav-label text-[14px] font-medium leading-none", labelClass)}>
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col pb-[64px] gap-2 px-3 mt-auto">
        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("search")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => useAppStore.getState().setSearchModalOpen(true)}
            title="Search"
            className={cn(
              rowClass,
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            )}
          >
            <span className={iconClass}>
              <Search size={20} strokeWidth={1.5} className="group-hover:text-[var(--text-2)] transition-colors" />
            </span>
            <span className={cn("nav-label flex items-center justify-between flex-1 text-[14px] font-medium leading-none text-[var(--text-3)]", labelClass)}>
              <span className="text-[14px] font-medium leading-none text-[var(--text-3)] whitespace-nowrap">Search</span>
              <span className="text-[10px] font-mono text-[var(--text-3)] whitespace-nowrap shrink-0 ml-2">Cmd+K</span>
            </span>
          </button>
        </div>

        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("settings")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
            title="Settings"
            className={cn(
              rowClass,
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            )}
          >
            <span className={iconClass}>
              <Settings size={20} strokeWidth={1.5} className="group-hover:text-[var(--text-2)] transition-colors" />
            </span>
            <span className={cn("nav-label text-[14px] font-medium leading-none", labelClass)}>Settings</span>
          </button>
        </div>
      </div>

      <button 
        onClick={() => useAppStore.getState().setSettingsModalOpen(true, "account")}
        title="Account"
        className={cn(
          "absolute bottom-0 left-0 w-full h-[60px] border-t border-[var(--border-subtle)] flex items-center transition-colors text-left px-3",
          "hover:bg-[var(--surface-hover)] cursor-pointer"
        )}
      >
        {(() => {
          const email = typeof userSettings?.email === "string" ? userSettings.email : "";
          const displayName = userSettings?.display_name || email || "Presense User";
          const subtitle = userSettings?.display_name && email ? email : "Account";
          return (
          <div className="flex items-center w-full min-w-0">
            <Avatar 
              name={displayName} 
              color={userSettings.avatar_color || "#7692FF"} 
              size="sm"
            />
              <div className={cn("flex flex-col min-w-0", labelClass)}>
                <span className="text-[13px] font-medium text-[var(--color-text-1)] truncate leading-tight whitespace-nowrap">{displayName}</span>
                <span className="text-[11px] text-[var(--text-4)] truncate leading-tight whitespace-nowrap">{subtitle}</span>
              </div>
          </div>
          );
        })()}
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
