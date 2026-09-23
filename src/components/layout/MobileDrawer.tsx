"use client";

import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Settings, Search, Timer, Trash2, X } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { navItems, isNavActive } from "@/lib/nav-config";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { avatarAccentFallback } from "@/components/layout/Navigation";

export function MobileDrawer() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const { isMobileDrawerOpen, setIsMobileDrawerOpen, userSettings } =
    useAppStore(
      useShallow((s) => ({
        isMobileDrawerOpen: s.isMobileDrawerOpen,
        setIsMobileDrawerOpen: s.setIsMobileDrawerOpen,
        userSettings: s.userSettings,
      })),
    );

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      setIsMobileDrawerOpen(false);
    }
  }, [pathname, setIsMobileDrawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMobileDrawerOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [isMobileDrawerOpen, setIsMobileDrawerOpen]);

  const handOff = (action: () => void) => {
    pendingAction.current = action;
    setIsMobileDrawerOpen(false);
  };
  const email =
    typeof userSettings.email === "string" ? userSettings.email : "";
  const displayName = userSettings.display_name || email || "Presense User";
  const activeIndex = navItems.findIndex((item) =>
    isNavActive(pathname, item.href),
  );
  const rowClass =
    "nav-shell-row relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[var(--text-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]";

  return (
    <Dialog.Root open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-drawer-overlay fixed inset-0 z-50 bg-[var(--bg-overlay)] md:hidden" />
        <Dialog.Content
          id="mobile-navigation"
          aria-describedby={undefined}
          className="mobile-drawer fixed inset-y-0 start-0 z-50 flex h-dvh w-[var(--mobile-drawer-w)] max-w-full flex-col border-e border-[var(--border-subtle)] bg-[var(--color-background)] shadow-[var(--shadow-modal)] md:hidden"
          style={{
            paddingBlockStart: "env(safe-area-inset-top, 0px)",
            paddingBlockEnd: "env(safe-area-inset-bottom, 0px)",
            paddingInlineStart: "env(safe-area-inset-left, 0px)",
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButton.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const action = pendingAction.current;
            pendingAction.current = null;
            if (action) {
              action();
              return;
            }
            const state = useAppStore.getState();
            if (
              !state.isCaptureModalOpen &&
              !state.isSearchModalOpen &&
              !state.isSettingsModalOpen &&
              !state.activeRitual &&
              !window.matchMedia("(min-width: 48rem)").matches
            ) {
              document
                .getElementById("mobile-nav-trigger")
                ?.focus({ preventScroll: true });
            }
          }}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="flex min-h-[var(--mobile-top-bar-h)] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
            <div className="flex items-center gap-3">
              <span className="text-[var(--accent)]">
                <BrandMark size={24} />
              </span>
              <span className="text-title-lg font-semibold tracking-tight text-[var(--text-1)]">
                Presense
              </span>
            </div>
            <Dialog.Close asChild>
              <button
                ref={closeButton}
                type="button"
                aria-label="Close navigation menu"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
              >
                <UiIcon size={20} strokeWidth={1.5} icon={X} />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <button
              type="button"
              onClick={() =>
                handOff(() => useAppStore.getState().setCaptureModalOpen(true))
              }
              className={cn(
                rowClass,
                "nav-shell-capture mb-4 bg-[var(--accent)] font-medium text-[var(--text-on-accent)] hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)]",
              )}
            >
              <span className="nav-shell-icon">
                <UiIcon size={20} strokeWidth={1.7} icon={Plus} />
              </span>
              <span className="nav-shell-label">Capture</span>
            </button>
            <nav aria-label="Destinations">
              <div className="nav-shell-section text-caption px-3 pb-2 text-[var(--text-3)]">
                Spaces
              </div>
              <div className="relative isolate">
                {activeIndex >= 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[var(--sidebar-row-h)] rounded-xl bg-[var(--accent-dim)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-smooth)] motion-reduce:transition-none"
                    style={{ transform: `translateY(${activeIndex * 100}%)` }}
                  />
                )}
                {navItems.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        rowClass,
                        "h-[var(--sidebar-row-h)]",
                        active && "font-medium text-[var(--accent)]",
                      )}
                    >
                      <span className="nav-shell-icon">
                        <UiIcon
                          size={20}
                          strokeWidth={active ? 2 : 1.5}
                          icon={item.icon}
                        />
                      </span>
                      <span className="nav-shell-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <div className="nav-shell-section text-caption px-3 pb-2 text-[var(--text-3)]">
                Tools
              </div>
              <button
                type="button"
                onClick={() =>
                  handOff(() => useAppStore.getState().setSearchModalOpen(true))
                }
                className={rowClass}
              >
                <span className="nav-shell-icon">
                  <UiIcon size={20} strokeWidth={1.5} icon={Search} />
                </span>
                <span className="nav-shell-label">Search</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handOff(() =>
                    useAppStore
                      .getState()
                      .setActiveTimer({ taskTitle: "Focus Session" }),
                  )
                }
                className={rowClass}
              >
                <span className="nav-shell-icon">
                  <UiIcon size={20} strokeWidth={1.5} icon={Timer} />
                </span>
                <span className="nav-shell-label">Focus</span>
              </button>
              <Link
                href="/trash"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-current={
                  isNavActive(pathname, "/trash") ? "page" : undefined
                }
                className={cn(
                  rowClass,
                  isNavActive(pathname, "/trash") &&
                    "bg-[var(--accent-dim)] font-medium text-[var(--accent)]",
                )}
              >
                <span className="nav-shell-icon">
                  <UiIcon size={20} strokeWidth={1.5} icon={Trash2} />
                </span>
                <span className="nav-shell-label">Trash</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  handOff(() =>
                    useAppStore.getState().setSettingsModalOpen(true),
                  )
                }
                className={rowClass}
              >
                <span className="nav-shell-icon">
                  <UiIcon size={20} strokeWidth={1.5} icon={Settings} />
                </span>
                <span className="nav-shell-label">Settings</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Account settings"
            onClick={() =>
              handOff(() =>
                useAppStore.getState().setSettingsModalOpen(true, "account"),
              )
            }
            className="nav-shell-account flex min-h-11 w-full shrink-0 items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-4 text-left hover:bg-[var(--surface-hover)]"
          >
            <Avatar
              name={displayName}
              color={userSettings.avatar_color || avatarAccentFallback()}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="text-body block truncate font-medium text-[var(--text-1)]">
                {displayName}
              </span>
              <span className="text-caption block truncate text-[var(--text-3)]">
                {userSettings.display_name && email ? email : "Account"}
              </span>
            </span>
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
