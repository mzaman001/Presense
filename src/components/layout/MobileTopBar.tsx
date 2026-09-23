"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow";
import { Avatar } from "@/components/ui/Avatar";
import { avatarAccentFallback } from "@/components/layout/Navigation";
import { Search, Inbox, Menu, CircleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { navItems, isNavActive } from "@/lib/nav-config";
import { useInboxCount } from "@/hooks/useInboxCount";
import { useEffect, useState } from "react";

const controlClass =
  "relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]";

export function MobileTopBar() {
  const pathname = usePathname();
  const inbox = useInboxCount();
  // Large-title pattern: each page shows its own big serif title, so the
  // bar stays quiet at the top and only names the page once you've
  // scrolled past it. Passive listener, state only changes on threshold.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  const {
    userSettings,
    setSettingsModalOpen,
    setSearchModalOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
  } = useAppStore(
    useShallow((s) => ({
      userSettings: s.userSettings,
      setSettingsModalOpen: s.setSettingsModalOpen,
      setSearchModalOpen: s.setSearchModalOpen,
      isMobileDrawerOpen: s.isMobileDrawerOpen,
      setIsMobileDrawerOpen: s.setIsMobileDrawerOpen,
    })),
  );
  const destination =
    navItems.find((item) => isNavActive(pathname, item.href))?.label ??
    (isNavActive(pathname, "/trash") ? "Trash" : "Presense");
  const displayName = userSettings.display_name || "Presense User";
  const inboxLabel = inbox.isError
    ? "Inbox, count unavailable"
    : inbox.isPending || inbox.data === undefined
      ? "Inbox, count loading"
      : `Inbox, ${inbox.data} ${inbox.data === 1 ? "item" : "items"}`;

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="mobile-top-bar fixed top-0 left-0 z-40 flex w-full items-center justify-between gap-2 md:hidden"
      style={{
        height: "calc(var(--mobile-top-bar-h) + env(safe-area-inset-top, 0px))",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "max(var(--space-3), env(safe-area-inset-left, 0px))",
        paddingRight: "max(var(--space-3), env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          id="mobile-nav-trigger"
          type="button"
          onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
          className={controlClass}
          aria-label={
            isMobileDrawerOpen
              ? "Close navigation menu"
              : "Open navigation menu"
          }
          aria-expanded={isMobileDrawerOpen}
          aria-controls="mobile-navigation"
          aria-haspopup="dialog"
        >
          <UiIcon size={22} strokeWidth={1.5} icon={Menu} />
        </button>
        <span className="mobile-top-bar-title font-heading truncate text-[length:var(--text-title-md)] font-medium text-[var(--text-1)]">
          {destination}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setSearchModalOpen(true)}
          className={controlClass}
          aria-label="Search"
        >
          <UiIcon size={20} strokeWidth={1.5} icon={Search} />
        </button>
        <Link
          href="/inbox"
          className={controlClass}
          aria-label={inboxLabel}
          aria-current={isNavActive(pathname, "/inbox") ? "page" : undefined}
        >
          <UiIcon size={20} strokeWidth={1.5} icon={Inbox} />
          {!inbox.isError &&
            !inbox.isPending &&
            inbox.data !== undefined &&
            inbox.data > 0 && (
              <span
                aria-hidden
                className="text-caption absolute top-0 right-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 font-medium text-[var(--text-on-accent)]"
              >
                {inbox.data > 99 ? "99+" : inbox.data}
              </span>
            )}
        </Link>
        {inbox.isError && (
          <button
            type="button"
            onClick={() => void inbox.refetch()}
            className={controlClass}
            aria-label="Inbox count unavailable. Retry"
            title="Inbox count unavailable. Retry"
          >
            <UiIcon size={20} strokeWidth={1.5} icon={CircleAlert} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setSettingsModalOpen(true, "account")}
          className={controlClass}
          aria-label="Account settings"
        >
          <Avatar
            name={displayName}
            color={userSettings.avatar_color || avatarAccentFallback()}
            size="sm"
          />
        </button>
      </div>
    </header>
  );
}
