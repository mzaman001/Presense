"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { createClient } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { getRitualDecision } from "@/lib/rituals";

/* AUDIT-01 (Aug 19, 2026): fallback avatar accent resolved from the
   canonical accent for each frozen theme id (AGENTS invariant 2, values
   copied from `:root` / `:root[data-theme="*"]` / `:root[data-mode="light"]`
   blocks in `globals.css`). Previously the fallback read
   `getComputedStyle(document.documentElement)` — a DOM read that errored
   during SSR with `ReferenceError: getComputedStyle is not defined`
   (Vercel production, 7 events Aug 17–18 on `/` and `/trash`). */
const AVATAR_ACCENT_BY_THEME: Record<string, string> = {
  warm: "#e5b41e",
  navy: "#7692ff",
  forest: "#efdd8d",
};

function avatarAccentFallback(): string {
  // Client-only: the theme lives on `data-theme`; default to the warm-dark
  // canonical accent (the SSR-safe table above covers the theme ids).
  if (typeof document === "undefined") return "#e5b41e";
  return (
    AVATAR_ACCENT_BY_THEME[
      document.documentElement.getAttribute("data-theme") ?? ""
    ] ?? "#e5b41e"
  );
}

const navItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/do", label: "Do", icon: Check },
  { href: "/remember/people", label: "Remember", icon: Brain },
  { href: "/think", label: "Think", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Compass },
];

/**
 * Collapsed-rail tooltip pill (DS-15). Renders the row's label — and an
 * optional `Kbd` hint — as a styled pill positioned to the right of the rail.
 * Uses `.sidebar-tooltip` CSS with an `opacity`/`pointer-events` transition so
 * the pill is visible within ~300ms on hover and on keyboard focus; the native
 * `title` attribute stays as the no-CSS fallback.
 */
function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sidebar-row relative w-full">
      {children}
      <span
        aria-hidden
        className={
          "sidebar-tooltip pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap"
        }
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Inbox count badge (DS-15). Same query contract as `inbox/page.tsx`
 * (`["inbox-tasks"]`, `items.status = 'inbox'`, user_id-filtered) so TanStack
 * Query's cache dedupes it with the inbox page while subscribed to the same
 * `useRealtime` refetch.
 */
function useInboxCount(): number {
  const supabase = useMemo(() => createClient(), []);
  const { data: inboxItems = [], refetch } = useQuery({
    queryKey: ["inbox-tasks"],
    queryFn: async () => {
      const { data: userSession } = await supabase.auth.getUser();
      if (!userSession?.user) return [];
      const { data, error } = await supabase
        .from("items")
        .select("id")
        .eq("user_id", userSession.user.id)
        .eq("status", "inbox");
      if (error) throw error;
      return data as { id: string }[];
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  useRealtime("items", refetch);
  return inboxItems.length;
}

export function Sidebar() {
  const pathname = usePathname();
  const userSettings = useAppStore((s) => s.userSettings);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const isTouch = useIsTouch();
  const [now, setNow] = useState(() => new Date());
  const inboxCount = useInboxCount();

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") updateTime();
    };
    const interval = setInterval(updateTime, 60000);
    window.addEventListener("focus", updateTime);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateTime);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const labelClass = cn(
    "ml-0 min-w-0 max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-ellipsis transition-[opacity,max-width,margin] duration-200",
    "group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100 group-focus-within/sidebar:ml-3 group-focus-within/sidebar:max-w-[160px] group-focus-within/sidebar:opacity-100",
  );
  /* DS-16 — block label that appears only when the rail is expanded.
     DS-18 — lowered to meta-size signposts: captions label, nothing more. */
  const blockLabelClass = cn(
    "mx-2 hidden px-2 pt-3 pb-1 text-meta whitespace-nowrap uppercase tracking-[0.1em] text-[var(--text-decorative)] group-hover/sidebar:block group-focus-within/sidebar:block",
  );
  /* DS-16 — row shared geometry; state colors are applied per row */
  const rowClass =
    "flex h-11 w-full items-center rounded-xl px-2 transition-colors";
  /* DS-18 — Quick Capture stays the sole solid accent action only when the
     rail is expanded; in the collapsed rail it is a quiet outline so it
     never competes with the page pill (skill: one accessory at full volume). */
  const captureCollapsedClass =
    "border border-[var(--accent-border)] text-[var(--accent)] hover:bg-[var(--accent-dim)]";
  const captureExpandedClass =
    "bg-[var(--accent)] text-[var(--text-on-accent)] group-hover/sidebar:bg-[var(--accent)] group-focus-within/sidebar:bg-[var(--accent)] shadow-[0_2px_12px_-2px_var(--accent)] group-hover/sidebar:shadow-[var(--shadow-button-primary)] group-focus-within/sidebar:shadow-[var(--shadow-button-primary)]";
  /* DS-16 — relative so the inbox badge offsets to the tile corner */
  const iconClass =
    "relative flex h-10 w-10 shrink-0 items-center justify-center";
  /* DS-16 — active row: accent-dim pill + left accent bar, rest muted */
  const activeRowClass =
    "nav-row-active bg-[var(--accent-dim)] text-[var(--accent)]";

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
      <div className="flex h-[80px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
        <div className="flex w-full min-w-0 items-center">
          {/* DS-16 — brand tile: a rounded-square container so the top of
              the rail is anchored in both collapsed and expanded states */}
          <div className="sidebar-brand-tile flex h-10 w-10 shrink-0 items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
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
              <circle cx="12" cy="12" r="12" fill="url(#brand-gradient)" />
              <path
                d="M8.5 6.5h4.2c2.4 0 4 1.4 4 3.4s-1.6 3.4-4 3.4H11V17H8.5V6.5Zm2.5 2v2.8h1.5c1 0 1.6-.5 1.6-1.4s-.6-1.4-1.6-1.4H11Z"
                fill="var(--text-on-accent)"
              />
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

      <div className="shrink-0 px-3 pt-3 pb-1">
        <RailTooltip label="Quick Capture">
          <button
            onMouseEnter={() => setHoveredItem("capture")}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
            title="Quick Capture"
            className={cn(
              rowClass,
              "h-10",
              /* collapsed = quiet outline; expanded = solid primary action */
              captureCollapsedClass,
              "group-hover/sidebar:border-[var(--accent)] group-hover/sidebar:bg-[var(--accent)] group-hover/sidebar:text-[var(--text-on-accent)] group-hover/sidebar:shadow-[var(--shadow-button-primary)]",
              "group-focus-within/sidebar:border-[var(--accent)] group-focus-within/sidebar:bg-[var(--accent)] group-focus-within/sidebar:text-[var(--text-on-accent)] group-focus-within/sidebar:shadow-[var(--shadow-button-primary)]",
            )}
          >
            <span className={iconClass}>
              <UiIcon size={20} strokeWidth={1.7} icon={Plus} />
            </span>
            <span className={cn("text-body-lg font-medium", labelClass)}>
              Quick Capture
            </span>
          </button>
        </RailTooltip>
      </div>

      <nav
        id="sidebar-content"
        className="flex w-full flex-1 flex-col px-3 pt-2"
      >
        <span aria-hidden className={blockLabelClass}>
          Spaces
        </span>
        {(() => {
          /* BUG-16 (Aug 17, 2026) — the sidebar ritual row now reads the
             single source of truth, `getRitualDecision()` from
             `src/lib/rituals.ts`, exactly like `AppInitializer.tsx`. The
             inline duplicate state machine (which missed the 6-hour
             morning window, the nudge-time start, and disagreed with the
             engine on evening eligibility) has been deleted — labels are
             now derived from the engine's `kind`/`reason`, and DS-17/18
             styling semantics are preserved. */
          const ritualNow = new Date();
          const ritualDecision = getRitualDecision({
            now: ritualNow,
            nudgeTime: userSettings?.nudge_time || null,
            shutdownTime: userSettings?.shutdown_time || null,
            lastMorningDate: userSettings?.last_ritual_date || null,
            lastEveningDate: userSettings?.last_evening_ritual_date || null,
            /* Intentionally NOT `manual: true` — the manual branch in
               `rituals.ts` always returns `kind: "morning"` (planning
               mode), which would hide the evening-review state from the
               sidebar entirely. The sidebar is a status display, so it
               uses the same auto semantics as `AppInitializer.tsx`. */
          });
          /* Display mapping from the engine's decision to the sidebar's
             four presentation states. Everything else (before morning
             window, morning window missed, evening completed) reads as
             "done": the day's pending ritual work is complete, and the
             row stays a muted hint per DS-17. */
          const ritualState: "morning" | "evening" | "done" | "all_done" =
            ritualDecision.reason === "evening_due"
              ? "evening"
              : ritualDecision.reason === "morning_due"
                ? "morning"
                : ritualDecision.reason === "evening_completed"
                  ? "all_done"
                  : "done";
          const ritualPending =
            ritualState === "morning" || ritualState === "evening";
          const ritualLabel =
            ritualState === "all_done"
              ? "All done"
              : ritualState === "done"
                ? "Day planned"
                : ritualState === "evening"
                  ? "Evening review"
                  : "Plan my day";
          /* DS-18 — full label (with checkmark) shared with the inner row;
             computed once alongside the state mapping. */
          const ritualLabelFull =
            ritualState === "all_done"
              ? "All done \u2713"
              : ritualState === "done"
                ? "Day planned \u2713"
                : ritualState === "evening"
                  ? "Evening review"
                  : "Plan my day";
          return (
            <RailTooltip label={ritualLabel}>
              <div
                className="relative w-full"
                onMouseEnter={() => setHoveredItem("plan-day")}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {(() => {
                  /* DS-18 — the ritual state machine is computed once in the outer
               IIFE (ritualState/ritualLabelFull); this block only maps it. */
                  const Icon =
                    ritualState === "all_done" || ritualState === "done"
                      ? CheckCircle2
                      : ritualState === "evening"
                        ? Moon
                        : Sparkles;
                  const label = ritualLabelFull;
                  const state = ritualState;
                  const ritualRitualKind = ritualPending ? ritualState : null;
                  return (
                    <button
                      onClick={() => {
                        if (useAppStore.getState().activeRitual) return;
                        useAppStore
                          .getState()
                          .setActiveRitual(ritualRitualKind);
                      }}
                      title={label.replace("✓", "")}
                      className={cn(
                        rowClass,
                        ritualPending
                          ? /* DS-17 — subdued hint, never the full active pill;
                       DS-18 — theme-aware via --accent-dim token */
                            "bg-[var(--accent-dim)] text-[var(--text-1)]"
                          : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
                      )}
                    >
                      <span className={iconClass}>
                        <Icon
                          size={20}
                          strokeWidth={1.5}
                          className={cn(
                            "transition-colors",
                            ritualPending
                              ? "text-[var(--accent)]"
                              : "group-hover:text-[var(--text-1)]",
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          "nav-label text-body-lg flex flex-1 items-center leading-none font-medium",
                          labelClass,
                        )}
                      >
                        <span
                          className={cn(
                            "text-body-lg leading-none whitespace-nowrap",
                            ritualPending
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-3)]",
                          )}
                        >
                          {hoveredItem === "plan-day" && state === "done"
                            ? "Review your day"
                            : hoveredItem === "plan-day" && state === "all_done"
                              ? "Already done"
                              : label}
                        </span>
                      </span>
                    </button>
                  );
                })()}
              </div>
            </RailTooltip>
          );
        })()}

        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/remember/people"
              ? pathname.startsWith("/remember")
              : pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          const showBadge = item.href === "/inbox" && inboxCount > 0;
          return (
            <RailTooltip key={item.href} label={item.label}>
              <Link
                href={item.href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                className={cn(
                  rowClass,
                  isActive
                    ? activeRowClass
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
                        : "text-[var(--text-3)] group-hover:text-[var(--text-1)]",
                      !isTouch && !isActive && "group-hover:translate-x-0.5",
                    )}
                  />
                  {showBadge && (
                    <span
                      aria-label={`${inboxCount} item${inboxCount === 1 ? "" : "s"} in Inbox`}
                      className="sidebar-badge-v2"
                    >
                      {inboxCount > 9 ? "9+" : inboxCount}
                    </span>
                  )}
                </span>

                <span
                  className={cn(
                    "nav-label text-body-lg flex flex-1 items-center justify-between gap-2 leading-none font-medium",
                    labelClass,
                  )}
                >
                  <span
                    className={cn(
                      "text-body-lg leading-none whitespace-nowrap",
                      isActive
                        ? "font-medium text-[var(--accent)]"
                        : "text-[var(--text-3)]",
                    )}
                  >
                    {item.label}
                  </span>
                  {showBadge && (
                    <span
                      aria-hidden
                      className="sidebar-badge-label text-caption leading-none font-medium whitespace-nowrap"
                    >
                      {inboxCount > 9 ? "9+" : inboxCount}
                    </span>
                  )}
                </span>
              </Link>
            </RailTooltip>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,24px)+84px)]">
        <span aria-hidden className={blockLabelClass}>
          Tools
        </span>

        {/* Search */}
        <RailTooltip label="Search">
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
                  className="transition-colors group-hover:text-[var(--text-1)]"
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
        </RailTooltip>

        {/* Focus (Pomodoro) */}
        <RailTooltip label="Focus Timer">
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
                rowClass,
                "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
              )}
            >
              <span className={iconClass}>
                <UiIcon
                  size={20}
                  strokeWidth={1.5}
                  className="transition-colors group-hover:text-[var(--text-1)]"
                  icon={Timer}
                />
              </span>
              <span
                className={cn(
                  "nav-label text-body-lg leading-none font-medium",
                  labelClass,
                )}
              >
                Focus
              </span>
            </button>
          </div>
        </RailTooltip>

        {/* Trash */}
        <RailTooltip label="Trash">
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
                rowClass,
                pathname === "/trash"
                  ? activeRowClass
                  : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
              )}
            >
              <span className={iconClass}>
                <UiIcon
                  size={20}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-all",
                    pathname === "/trash"
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-3)] group-hover:text-[var(--text-1)]",
                    !isTouch &&
                      pathname !== "/trash" &&
                      "group-hover:translate-x-0.5",
                  )}
                  icon={Trash2}
                />
              </span>
              <span
                className={cn(
                  "nav-label text-body-lg leading-none font-medium",
                  labelClass,
                )}
              >
                Trash
              </span>
            </Link>
          </div>
        </RailTooltip>

        {/* Settings */}
        <RailTooltip label="Settings">
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
                "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
              )}
            >
              <span className={iconClass}>
                <UiIcon
                  size={20}
                  strokeWidth={1.5}
                  className="transition-colors group-hover:text-[var(--text-1)]"
                  icon={Settings}
                />
              </span>
              <span
                className={cn(
                  "nav-label text-body-lg leading-none font-medium",
                  labelClass,
                )}
              >
                Settings
              </span>
            </button>
          </div>
        </RailTooltip>
      </div>

      <RailTooltip label="Account">
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
                {/* DS-16 — account tile mirrors the brand tile: a rounded-square
                  container anchoring the bottom of the rail when collapsed.
                  DS-17 — fallback avatar color is the theme accent (warm
                  amber default), never the off-theme blue. */}
                <div className="sidebar-brand-tile flex h-10 w-10 shrink-0 items-center justify-center">
                  <Avatar
                    name={displayName}
                    color={userSettings.avatar_color || avatarAccentFallback()}
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
      </RailTooltip>
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
