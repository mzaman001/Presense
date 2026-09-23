"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, m, useReducedMotion } from "framer-motion";
import {
  Settings,
  Search,
  Plus,
  Sparkles,
  CheckCircle2,
  Moon,
  Timer,
  Trash2,
  CircleAlert,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { navItems, isNavActive } from "@/lib/nav-config";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInboxCount } from "@/hooks/useInboxCount";
import { useHaptics } from "@/hooks/useHaptics";
import { getRitualDecision } from "@/lib/rituals";

const AVATAR_ACCENT_BY_MODE: Record<string, string> = {
  dark: "#e3875f",
  light: "#9c4a2e",
};

export function avatarAccentFallback(mode = "dark"): string {
  return AVATAR_ACCENT_BY_MODE[mode] ?? AVATAR_ACCENT_BY_MODE.dark;
}

function NavRow({
  label,
  icon: Icon,
  href,
  onClick,
  expanded,
  active,
  capture,
  disabled,
  badge,
  reducedMotion,
  accessibleLabel,
}: {
  accessibleLabel?: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  expanded: boolean;
  active?: boolean;
  capture?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  reducedMotion?: boolean;
}) {
  const content = (
    <>
      {active && (
        <m.span
          layoutId="sidebar-active"
          aria-hidden
          className="sidebar-active-indicator"
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 42 }
          }
        />
      )}
      <span className="sidebar-icon">
        <Icon size={20} strokeWidth={active ? 2 : 1.6} aria-hidden />
      </span>
      <span className="sidebar-label text-body font-medium">{label}</span>
      {badge}
    </>
  );
  const className = cn(
    "sidebar-link",
    capture && "sidebar-capture",
    active && "is-active",
  );
  const element = href ? (
    <Link
      href={href}
      aria-label={accessibleLabel ?? label}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
  return (
    <Tooltip disabled={expanded || disabled}>
      <TooltipTrigger render={element} />
      <TooltipContent side="right" sideOffset={16}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarRitual({ expanded }: { expanded: boolean }) {
  const settings = useAppStore((s) => s.userSettings);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const initial = setTimeout(update, 0);
    const interval = setInterval(update, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") update();
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const decision = now
    ? getRitualDecision({
        now,
        nudgeTime: settings.nudge_time || null,
        shutdownTime: settings.shutdown_time || null,
        lastMorningDate: settings.last_ritual_date || null,
        lastEveningDate: settings.last_evening_ritual_date || null,
      })
    : null;
  const kind =
    decision?.kind === "morning" || decision?.kind === "evening"
      ? decision.kind
      : null;
  const completed = decision?.reason === "evening_completed";
  const label = !now
    ? "Daily planning"
    : kind === "evening"
      ? "Evening review"
      : kind === "morning"
        ? "Plan my day"
        : completed
          ? "All done"
          : "Day planned";
  return (
    <NavRow
      label={label}
      icon={
        kind === "evening" ? Moon : kind === "morning" ? Sparkles : CheckCircle2
      }
      expanded={expanded}
      onClick={() => {
        if (useAppStore.getState().activeRitual) return;
        if (kind) {
          useAppStore.getState().setActiveRitual(kind);
        } else if (now) {
          useAppStore.getState().setActiveRitual("morning");
        }
      }}
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const settings = useAppStore((s) => s.userSettings);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(systemReducedMotion || settings.reduce_motion);
  const inbox = useInboxCount();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const expanded = hovered || focused;
  const email = typeof settings.email === "string" ? settings.email : "";
  const displayName = settings.display_name || email || "Presense User";
  const shared = { expanded, reducedMotion };

  return (
    <LayoutGroup id="desktop-navigation">
      <aside
        aria-label="Main navigation"
        data-expanded={String(expanded)}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimer();
          timer.current = setTimeout(() => {
            timer.current = null;
            setHovered(true);
          }, 100);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimer();
          timer.current = setTimeout(() => {
            timer.current = null;
            setHovered(false);
          }, 250);
        }}
        onPointerCancel={() => {
          clearTimer();
          setHovered(false);
        }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
        className="sidebar fixed inset-y-0 start-0 z-40 hidden h-dvh flex-col md:flex"
      >
        <div className="sidebar-header">
          <span className="sidebar-icon text-[var(--accent)]">
            <BrandMark size={26} />
          </span>
          <span className="sidebar-label text-title-lg font-semibold tracking-tight">
            Presense
          </span>
        </div>
        <div className="sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <NavRow
            {...shared}
            label="Quick Capture"
            icon={Plus}
            capture
            onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
            badge={
              <kbd className="sidebar-shortcut sidebar-capture-kbd" aria-hidden>
                C
              </kbd>
            }
          />
          <nav aria-label="Destinations" id="sidebar-content">
            <div className="sidebar-section">
              <span className="sidebar-label">Spaces</span>
            </div>
            {navItems.map((item) => (
              <div key={item.href} className="relative">
                <NavRow
                  {...shared}
                  label={item.label}
                  accessibleLabel={
                    item.href === "/inbox"
                      ? inbox.isError
                        ? "Inbox, count unavailable"
                        : inbox.data === undefined
                          ? "Inbox, count loading"
                          : `Inbox, ${inbox.data} ${inbox.data === 1 ? "item" : "items"}`
                      : undefined
                  }
                  icon={item.icon}
                  href={item.href}
                  active={isNavActive(pathname, item.href)}
                  badge={
                    item.href === "/inbox" &&
                    !inbox.isError &&
                    inbox.data !== undefined &&
                    inbox.data > 0 ? (
                      <span
                        className="sidebar-count"
                        aria-label={`${inbox.data} items in Inbox`}
                      >
                        {inbox.data > 9 ? "9+" : inbox.data}
                      </span>
                    ) : undefined
                  }
                />
              </div>
            ))}
            {inbox.isError && (
              <NavRow
                {...shared}
                label="Retry inbox count"
                icon={CircleAlert}
                onClick={() => void inbox.refetch()}
              />
            )}
            <SidebarRitual expanded={expanded} />
          </nav>
          <div className="sidebar-tools">
            <div className="sidebar-section">
              <span className="sidebar-label">Tools</span>
            </div>
            <NavRow
              {...shared}
              label="Search"
              icon={Search}
              onClick={() => useAppStore.getState().setSearchModalOpen(true)}
              badge={
                <span className="sidebar-shortcut text-caption" aria-hidden>
                  ⌘K
                </span>
              }
            />
            <NavRow
              {...shared}
              label="Focus Timer"
              icon={Timer}
              onClick={() =>
                useAppStore
                  .getState()
                  .setActiveTimer({ taskTitle: "Focus Session" })
              }
            />
            <NavRow
              {...shared}
              label="Trash"
              icon={Trash2}
              href="/trash"
              active={isNavActive(pathname, "/trash")}
            />
            <NavRow
              {...shared}
              label="Settings"
              icon={Settings}
              onClick={() => useAppStore.getState().setSettingsModalOpen(true)}
            />
          </div>
        </div>
        <button
          type="button"
          aria-label="Account settings"
          className="sidebar-account"
          onClick={() =>
            useAppStore.getState().setSettingsModalOpen(true, "account")
          }
        >
          <span className="sidebar-icon">
            <Avatar
              name={displayName}
              color={
                settings.avatar_color ||
                avatarAccentFallback(settings.color_mode)
              }
              size="sm"
            />
          </span>
          <span className="sidebar-label min-w-0 flex-1 text-start">
            <span className="text-body block truncate font-medium">
              {displayName}
            </span>
            <span className="text-caption block truncate text-[var(--text-3)]">
              {settings.display_name && email ? email : "Account settings"}
            </span>
          </span>
          <ChevronRight
            size={16}
            className="sidebar-shortcut shrink-0 text-[var(--text-3)]"
            aria-hidden
          />
        </button>
      </aside>
    </LayoutGroup>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const haptics = useHaptics();
  const items = navItems.filter((item) => item.bottom);
  // Capture sits in the true centre: split the tabs evenly around it.
  const half = Math.ceil(items.length / 2);
  const cols = items.length + 1;
  const activeIndex = items.findIndex((item) =>
    isNavActive(pathname, item.href),
  );
  const slot =
    activeIndex < 0 ? -1 : activeIndex < half ? activeIndex : activeIndex + 1;

  const renderTab = (item: (typeof items)[number]) => {
    const active = isNavActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="dock-tab"
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (!active) haptics.selection();
        }}
      >
        <item.icon size={21} strokeWidth={active ? 2 : 1.6} aria-hidden />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="dock md:hidden"
      style={{ "--dock-cols": cols } as React.CSSProperties}
    >
      <div className="dock-inner">
        {slot >= 0 && (
          <span
            aria-hidden
            className="dock-indicator"
            style={{ transform: `translateX(${slot * 100}%)` }}
          />
        )}
        {items.slice(0, half).map(renderTab)}
        <button
          type="button"
          aria-label="Quick Capture"
          className="dock-capture"
          onClick={() => {
            haptics.light();
            useAppStore.getState().setCaptureModalOpen(true);
          }}
        >
          <span>
            <Plus size={22} strokeWidth={2.2} aria-hidden />
          </span>
        </button>
        {items.slice(half).map(renderTab)}
      </div>
    </nav>
  );
}
