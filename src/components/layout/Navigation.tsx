"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Moon,
  PanelLeftClose,
  PanelLeft,
  Timer,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Avatar } from "@/components/ui/Avatar";
import { Kbd } from "@/components/ui/Kbd";
import { m } from "framer-motion";
import { useIsTouch } from "@/hooks/useIsTouch";
import { Icon as UiIcon } from "@/components/ui/Icon";

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
  const userSettings = useAppStore((s) => s.userSettings);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const isTouch = useIsTouch();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    const interval = setInterval(updateTime, 60000);
    window.addEventListener("focus", updateTime);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") updateTime();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateTime);
      window.removeEventListener("visibilitychange", updateTime);
    };
  }, []);

  const labelClass = cn(
    "ml-0 min-w-0 max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-ellipsis transition-[opacity,max-width,margin] duration-200",
    "group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100 group-focus-within/sidebar:ml-3 group-focus-within/sidebar:max-w-[160px] group-focus-within/sidebar:opacity-100",
  );
  const rowClass =
    "flex h-11 w-full items-center rounded-xl px-2 transition-colors";
  const iconClass = "flex h-10 w-10 shrink-0 items-center justify-center";

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "sidebar group/sidebar fixed top-0 left-0 z-40 hidden h-dvh flex-col overflow-hidden md:flex",
        "border-r border-[var(--border-subtle)] bg-[var(--color-background)]",
        "w-[80px] focus-within:w-[248px] hover:w-[248px]",
        "transition-[width] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
      )}
    >
      <div className="flex h-[80px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5">
        <div className="flex w-full min-w-0 items-center">
          <div className={iconClass}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="url(#brand-gradient)"
              className="shrink-0"
            >
              <defs>
                <linearGradient
                  id="brand-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent-deep)" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="12" />
            </svg>
          </div>
          <span
            className={cn(
              "sidebar-title text-title-lg font-semibold tracking-tight text-[var(--color-text-1)]",
              labelClass,
            )}
          >
            Presense
          </span>
        </div>
      </div>

      <div className="shrink-0 px-3 pt-3 pb-2">
        <button
          onMouseEnter={() => setHoveredItem("capture")}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
          title="Quick Capture"
          className={cn(
            rowClass,
            "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-button-primary)] hover:brightness-105",
          )}
        >
          <span className={iconClass}>
            <UiIcon size={22} strokeWidth={1.7} icon={Plus} />
          </span>
          <span className={cn("text-body-lg font-semibold", labelClass)}>
            Quick Capture
          </span>
        </button>
      </div>

      <nav
        id="sidebar-content"
        className="flex w-full flex-1 flex-col gap-2 px-3"
      >
        <div
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("plan-day")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {(() => {
            const currentHours = now.getHours();
            const todayStr = now.toLocaleDateString("en-CA");
            const morningDone = userSettings?.last_ritual_date === todayStr;
            const eveningDone =
              userSettings?.last_evening_ritual_date === todayStr;
            const shutdownHour = parseInt(
              userSettings?.shutdown_time?.split(":")[0] || "17",
              10,
            );

            let state:
              "morning" | "evening" | "done" | "all_done" | "missed_morning" =
              "morning";

            if (eveningDone) state = "all_done";
            else if (morningDone && currentHours >= shutdownHour)
              state = "evening";
            else if (!morningDone && currentHours >= shutdownHour)
              state = "missed_morning";
            else if (morningDone) state = "done";
            else state = "morning";

            const Icon =
              state === "all_done" || state === "done"
                ? CheckCircle2
                : state === "evening" || state === "missed_morning"
                  ? Moon
                  : Sparkles;

            const label =
              state === "all_done"
                ? "All done ✓"
                : state === "done"
                  ? "Day planned ✓"
                  : state === "evening"
                    ? "Evening review"
                    : state === "missed_morning"
                      ? "Evening review"
                      : "Plan my day";

            return (
              <button
                onClick={() => {
                  if (useAppStore.getState().activeRitual) return;
                  useAppStore
                    .getState()
                    .setActiveRitual(
                      state === "evening" || state === "missed_morning"
                        ? "evening"
                        : "morning",
                    );
                }}
                title={label.replace("âœ“", "")}
                className={cn(
                  rowClass,
                  state === "all_done" || state === "done"
                    ? "bg-transparent text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.02)] hover:text-[var(--text-1)]"
                    : "border border-[var(--accent)]/15 bg-[var(--accent-dim)]/10 text-[var(--accent)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]",
                )}
              >
                <span className={iconClass}>
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={
                      state === "all_done" || state === "done"
                        ? ""
                        : "text-[var(--accent)]"
                    }
                  />
                </span>
                <span
                  className={cn(
                    "nav-label text-body-lg leading-none font-medium",
                    labelClass,
                  )}
                >
                  {hoveredItem === "plan-day" && state === "done"
                    ? "Review your day"
                    : hoveredItem === "plan-day" && state === "all_done"
                      ? "Already done"
                      : label}
                </span>
              </button>
            );
          })()}
        </div>

        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/remember/people"
              ? pathname.startsWith("/remember")
              : pathname.startsWith(`${item.href}/`));
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
                    ? "bg-[var(--accent-dim)] font-medium text-[var(--accent)]"
                    : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
                )}
              >
                <span className={iconClass}>
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={cn(
                      "transition-all",
                      isActive
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-3)] group-hover:text-[var(--text-2)]",
                      !isTouch && !isActive && "group-hover:translate-x-0.5",
                    )}
                  />
                </span>

                <span
                  className={cn(
                    "nav-label text-body-lg leading-none font-medium",
                    labelClass,
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,24px)+84px)]">
        {/* Search */}
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
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
            )}
          >
            <span className={iconClass}>
              <UiIcon
                size={20}
                strokeWidth={1.5}
                className="transition-colors group-hover:text-[var(--text-2)]"
                icon={Search}
              />
            </span>
            <span
              className={cn(
                "nav-label text-body-lg flex flex-1 items-center justify-between leading-none font-medium text-[var(--text-3)]",
                labelClass,
              )}
            >
              <span className="text-body-lg leading-none font-medium whitespace-nowrap text-[var(--text-3)]">
                Search
              </span>
              <Kbd className="ml-2 border-none bg-transparent">Cmd+K</Kbd>
            </span>
          </button>
        </div>

        {/* Divider before utility items */}
        <div className="mx-2 my-1 border-t border-[var(--border-subtle)] opacity-50" />

        {/* Focus (Pomodoro) */}
        <div
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("focus")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() =>
              useAppStore
                .getState()
                .setActiveTimer({ taskTitle: "Focus Session" })
            }
            title="Focus Timer"
            className={cn(
              "flex h-9 w-full items-center rounded-xl px-2 transition-colors",
              "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-2)]",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <UiIcon
                size={17}
                strokeWidth={1.5}
                className="transition-colors"
                icon={Timer}
              />
            </span>
            <span
              className={cn(
                "nav-label text-body leading-none font-medium",
                labelClass,
              )}
            >
              Focus
            </span>
          </button>
        </div>

        {/* Trash */}
        <div
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("trash")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Link
            href="/trash"
            prefetch={true}
            title="Trash"
            className={cn(
              "flex h-9 w-full items-center rounded-xl px-2 transition-colors",
              pathname === "/trash"
                ? "bg-[var(--accent-dim)] font-medium text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-2)]",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <UiIcon
                size={17}
                strokeWidth={1.5}
                className={cn(
                  "transition-all",
                  pathname === "/trash"
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]",
                  !isTouch &&
                    pathname !== "/trash" &&
                    "group-hover:translate-x-0.5",
                )}
                icon={Trash2}
              />
            </span>
            <span
              className={cn(
                "nav-label text-body leading-none font-medium",
                labelClass,
              )}
            >
              Trash
            </span>
          </Link>
        </div>

        {/* Settings */}
        <div
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("settings")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
            title="Settings"
            className={cn(
              "flex h-9 w-full items-center rounded-xl px-2 transition-colors",
              "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-2)]",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <UiIcon
                size={17}
                strokeWidth={1.5}
                className="transition-colors"
                icon={Settings}
              />
            </span>
            <span
              className={cn(
                "nav-label text-body leading-none font-medium",
                labelClass,
              )}
            >
              Settings
            </span>
          </button>
        </div>
      </div>

      <button
        onClick={() =>
          useAppStore.getState().setSettingsModalOpen(true, "account")
        }
        title="Account"
        className={cn(
          "absolute bottom-0 left-0 flex h-[60px] w-full items-center border-t border-[var(--border-subtle)] px-5 text-left transition-colors",
          "cursor-pointer hover:bg-[var(--surface-hover)]",
        )}
      >
        {(() => {
          const email =
            typeof userSettings?.email === "string" ? userSettings.email : "";
          const displayName =
            userSettings?.display_name || email || "Presense User";
          const subtitle =
            userSettings?.display_name && email ? email : "Account";
          return (
            <div className="flex w-full min-w-0 items-center">
              <div className={iconClass}>
                <Avatar
                  name={displayName}
                  color={userSettings.avatar_color || "#7692FF"}
                  size="sm"
                />
              </div>
              <div className={cn("flex min-w-0 flex-col", labelClass)}>
                <span className="text-body truncate leading-tight font-medium whitespace-nowrap text-[var(--color-text-1)]">
                  {displayName}
                </span>
                <span className="text-meta truncate leading-tight whitespace-nowrap text-[var(--text-muted)]">
                  {subtitle}
                </span>
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
  const setCaptureModalOpen = useAppStore((s) => s.setCaptureModalOpen);

  const mobileNavItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/do", label: "Do", icon: Check },
    { href: "capture", label: "Capture", icon: Plus, isAction: true },
    { href: "/think", label: "Think", icon: MessageSquare },
    { href: "/explore", label: "Explore", icon: Compass },
  ];

  return (
    <nav className="bottom-nav pb-safe fixed bottom-0 left-0 z-40 w-full border-t border-[var(--border-subtle)] bg-[var(--color-background)]/95 md:hidden">
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
                className="flex min-h-[56px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[var(--color-text-1)] transition-all active:scale-95"
              >
                <div className="relative -mt-6 flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[var(--color-background)] bg-[var(--color-text-1)] text-[var(--color-background)] shadow-lg">
                  <UiIcon size={24} strokeWidth={2} icon={Plus} />
                </div>
              </button>
            );
          }

          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                // Minimum 44px touch target per WCAG 2.5.5
                "flex min-h-[56px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all active:scale-95",
                isActive
                  ? "text-[var(--color-text-1)]"
                  : "text-[var(--color-text-3)]",
              )}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-3)]",
                  )}
                />
                {isActive && (
                  <m.div
                    layoutId="bottom-nav-active"
                    className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--accent)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-caption font-medium transition-colors",
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-3)]",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
