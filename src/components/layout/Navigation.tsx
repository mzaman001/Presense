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
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/people", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Compass },
];

function NavTooltip({ label, shortcut, show }: { label: string, shortcut?: string, show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -5 }}
          transition={{ duration: 0.15, delay: 0.4 }}
          className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-[var(--surface-dropdown)] border border-[var(--border-strong)] text-xs font-medium shadow-xl z-50 whitespace-nowrap flex items-center gap-2 pointer-events-none text-white"
        >
          {label}
          {shortcut && <span className="text-[10px] opacity-70">{shortcut}</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarCollapsed, toggleSidebar, userSettings } = useAppStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors p-2 flex items-center justify-center",
            isSidebarCollapsed ? "right-0" : "right-0"
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
                className={cn(
                  "flex items-center h-[36px] transition-all relative group",
                  isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "w-full rounded-[var(--radius-sm)] px-3 gap-3",
                  isActive 
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]" 
                    : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                )}
              >
                {/* Active left indicator */}
                {isActive && !isSidebarCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[20px] bg-[var(--accent)] rounded-r-full" />
                )}
                
                <div className="flex items-center justify-center shrink-0">
                  <Icon 
                    size={18} 
                    strokeWidth={1.5}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]"
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
      <div className={cn(
        "absolute bottom-0 left-0 w-full h-[52px] border-t border-[var(--border-subtle)] flex items-center",
        isSidebarCollapsed ? "justify-center" : "px-4"
      )}>
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
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-[var(--border-subtle)] bg-[var(--color-background)] backdrop-blur-3xl z-40 pb-safe pt-2 px-4">
      <div className="flex items-center justify-between relative">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/remember/people" ? pathname.startsWith("/remember") : pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                isActive ? "text-[var(--color-text-1)]" : "text-[var(--color-text-3)]"
              )}
            >
              <Icon 
                size={18} 
                strokeWidth={1.5}
                className={cn("shrink-0 transition-colors", isActive ? "text-[var(--accent)]" : "text-[var(--text-3)]")} 
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
