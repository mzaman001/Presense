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

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarCollapsed, toggleSidebar, userSettings } = useAppStore();

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col fixed top-0 left-0 h-screen border-r border-[var(--color-border)] bg-[rgba(11,9,20,0.4)] backdrop-blur-3xl z-40 transition-all duration-300",
        isSidebarCollapsed ? "w-[72px] p-3 items-center" : "w-[220px] p-4"
      )}
    >
      <div className={cn("flex items-center mb-10 w-full relative", isSidebarCollapsed ? "justify-center" : "gap-2 px-2")}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-people)] flex items-center justify-center shadow-lg shrink-0">
          <div className="w-3 h-3 bg-[var(--color-text-1)] rounded-full" />
        </div>
        {!isSidebarCollapsed && <span className="text-page-title text-xl font-semibold tracking-tight">Presense</span>}
        
        <button 
          onClick={toggleSidebar}
          className={cn(
            "absolute flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors",
            isSidebarCollapsed ? "-right-6 translate-x-1/2" : "right-0"
          )}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/remember/people" ? pathname.startsWith("/remember") : pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all",
                isSidebarCollapsed ? "justify-center w-12 h-12 mx-auto" : "gap-3 px-3 py-2.5 w-full",
                isActive 
                  ? "bg-[var(--color-surface)] text-[var(--color-text-1)]" 
                  : "text-[var(--color-text-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? item.color : "text-[var(--color-text-3)]")} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 w-full">
        <button
          onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
          title={isSidebarCollapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium text-[var(--color-text-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)] transition-all",
            isSidebarCollapsed ? "justify-center w-12 h-12 mx-auto mb-2" : "gap-3 px-3 py-2.5 w-full mb-2"
          )}
        >
          <Settings className="w-5 h-5 text-[var(--color-text-3)]" />
          {!isSidebarCollapsed && <span>Settings</span>}
        </button>

        {userSettings?.display_name && (
          <div className={cn(
            "flex items-center rounded-xl p-2 bg-[var(--color-surface)] border border-[var(--color-border)]",
            isSidebarCollapsed ? "justify-center" : "gap-3"
          )}>
            <Avatar 
              name={userSettings.display_name} 
              color={userSettings.avatar_color || "#7692FF"} 
              size="sm"
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

import { Plus } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const { setCaptureModalOpen } = useAppStore();

  const leftNavs = navItems.slice(0, 2);
  const rightNavs = navItems.slice(2, 4); // Show only 4 items to make room for FAB

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full border-t border-[var(--color-border)] bg-[var(--color-background)] backdrop-blur-3xl z-40 pb-safe pt-2 px-6">
      <div className="flex items-center justify-between relative">
        {leftNavs.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

        {/* Center FAB */}
        <button 
          onClick={() => setCaptureModalOpen(true)}
          className="relative -top-6 flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-text-1)] text-[var(--color-background)] shadow-lg shadow-white/10"
        >
          <Plus className="w-6 h-6" />
        </button>

        {rightNavs.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
