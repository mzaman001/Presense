"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Users, 
  Brain,
  MessageSquare, 
  Compass, 
  MapPin, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/do", label: "Do", icon: CheckCircle2, color: "text-[var(--color-do)]" },
  { href: "/remember/people", label: "Remember", icon: Brain, color: "text-[var(--color-people)]" },
  { href: "/think", label: "Think", icon: MessageSquare, color: "text-[var(--color-think)]" },
  { href: "/explore", label: "Explore", icon: Compass, color: "text-[var(--color-explore)]" },
];

import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarCollapsed, toggleSidebar, userSettings } = useAppStore();

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col fixed top-0 left-0 h-screen border-r border-[var(--color-border)] bg-[rgba(11,9,20,0.4)] backdrop-blur-3xl z-40 transition-all duration-300 group/sidebar",
        isSidebarCollapsed ? "w-[64px] py-4 items-center" : "w-[220px] p-4"
      )}
    >
      <button 
        onClick={toggleSidebar}
        className={cn(
          "absolute top-4 flex items-center justify-center w-6 h-6 bg-transparent text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:scale-110 transition-all z-50",
          isSidebarCollapsed ? "right-1" : "right-2"
        )}
      >
        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className={cn("flex items-center mb-8 w-full", isSidebarCollapsed ? "justify-center mt-8" : "gap-3 px-2")}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-people)] flex items-center justify-center shadow-lg shrink-0">
          <div className="w-3 h-3 bg-[var(--color-background)] rounded-full" />
        </div>
        {!isSidebarCollapsed && <span className="text-page-title text-xl font-semibold tracking-tight text-[var(--color-text-1)]">Presense</span>}
      </div>

      {!isSidebarCollapsed && (
        <div className="mb-8 w-full">
          <button 
            onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5" />
            Quick Capture
          </button>
          <div className="text-center mt-2">
            <span className="text-[10px] font-mono text-[var(--color-text-3)] tracking-wider">Cmd+K</span>
          </div>
        </div>
      )}

      {isSidebarCollapsed && (
        <button 
          onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
          className="w-10 h-10 mb-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0 group relative"
        >
          <Plus className="w-5 h-5" />
          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
            Quick Capture <span className="text-[10px] text-[var(--color-text-3)] ml-2">Cmd+K</span>
          </div>
        </button>
      )}

      <nav className="flex-1 flex flex-col gap-2 w-full">
        <div className="relative group w-full mb-2">
          <button
            onClick={() => useAppStore.getState().setSearchModalOpen(true)}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all relative w-full",
              isSidebarCollapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5",
              "text-[var(--color-text-3)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
            )}
          >
            <Search className="w-5 h-5" />
            {!isSidebarCollapsed && (
              <div className="flex flex-1 items-center justify-between">
                <span>Search</span>
                <span className="text-[10px] font-mono border border-[var(--color-border)] px-1.5 rounded text-[var(--color-text-3)]">Cmd+/</span>
              </div>
            )}
          </button>
          {isSidebarCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
              Search <span className="text-[10px] text-[var(--color-text-3)] ml-2">Cmd+/</span>
            </div>
          )}
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/remember/people" ? pathname.startsWith("/remember") : pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <div key={item.href} className="relative group w-full">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center rounded-xl text-sm font-medium transition-all relative",
                  isSidebarCollapsed 
                    ? "justify-center w-10 h-10 mx-auto" 
                    : "gap-3 px-3 py-2.5 w-full",
                  isActive 
                    ? isSidebarCollapsed 
                      ? "bg-amber-500/15 text-[var(--color-accent)]" 
                      : "bg-[var(--color-surface)] text-[var(--color-text-1)]"
                    : "text-[var(--color-text-3)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
                )}
              >
                <Icon className={cn(
                  "shrink-0 transition-colors",
                  isSidebarCollapsed ? "w-5 h-5" : "w-5 h-5", 
                  isActive ? (isSidebarCollapsed ? "text-[var(--color-accent)]" : item.color) : "opacity-70 group-hover:opacity-100"
                )} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
              
              {isSidebarCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 w-full">
        <div className="relative group w-full">
          <button
            onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium transition-all relative w-full",
              isSidebarCollapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5",
              "text-[var(--color-text-3)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
          {isSidebarCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50">
              Settings
            </div>
          )}
        </div>

        {userSettings?.display_name && (
          <div className={cn(
            "flex items-center rounded-xl p-2 bg-[var(--color-surface)] border border-[var(--color-border)] mt-2 w-full",
            isSidebarCollapsed ? "justify-center w-10 h-10 mx-auto p-0 border-none bg-transparent" : "gap-3"
          )}>
            <Avatar 
              name={userSettings.display_name} 
              color={userSettings.avatar_color || "#7692FF"} 
              size={isSidebarCollapsed ? "sm" : "sm"}
            />
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[var(--color-text-1)] truncate">{userSettings.display_name}</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Free Plan</span>
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
    <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-[var(--color-border)] bg-[var(--color-background)] backdrop-blur-3xl z-40 pb-safe pt-2 px-4">
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
              <Icon className={cn("w-6 h-6", isActive && item.color)} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
