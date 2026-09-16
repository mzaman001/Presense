"use client";
import { Input } from "../ui/Input";
import { useUserId } from "@/components/providers/SessionProvider";
import { Textarea } from "../ui/Textarea";
import { logger } from "@/lib/logger";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { m, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient } from "@/lib/supabase";
import { routeCapture } from "@/lib/capture-router";
import { formatRRule } from "@/lib/utils";
import { Sparkles, Loader2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import {
  destinationIdToLabel,
  destinationToId,
  type RoutedItem,
} from "@/lib/capture-router";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { Sheet } from "@/components/ui/Sheet";
import { useHaptics } from "@/hooks/useHaptics";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

function formatCaptureDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;

  const diffTime = d.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);
  if (diffDays > 0 && diffDays < 7) {
    return `Next ${d.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
  }
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

const SPACE_COLORS: Record<string, string> = {
  Do: "var(--color-do)",
  Think: "var(--color-think)",
  "Remember → Locations": "#4ADE80",
  Inbox: "#FBBF24",
  "Choose space...": "var(--color-text-3)",
};

const SPACE_OPTIONS = [
  { value: "Do", label: "Do" },
  { value: "Think", label: "Think" },
  { value: "Remember → Locations", label: "Locations" },
  { value: "Inbox", label: "Inbox" },
];

const ROUTE_SPACE_COLORS: Record<string, string> = {
  do: "var(--color-do)",
  think: "var(--color-think)",
  locations: "#4ADE80",
  inbox: "#FBBF24",
};

const ROUTE_SPACE_OPTIONS = [
  { value: "do", label: "Do" },
  { value: "think", label: "Think" },
  { value: "locations", label: "Locations" },
  { value: "inbox", label: "Inbox" },
];

const toLocalISOString = (date: Date) => {
  // Use date-fns to format in local time as YYYY-MM-DDTHH:mm
  // This avoids timezone math issues around DST
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function CaptureModal() {
  const userId = useUserId();
  const {
    isCaptureModalOpen,
    setCaptureModalOpen,
    userSettings,
    captureModalPrefill,
    setCaptureModalPrefill,
  } = useAppStore(
    useShallow((s) => ({
      isCaptureModalOpen: s.isCaptureModalOpen,
      setCaptureModalOpen: s.setCaptureModalOpen,
      userSettings: s.userSettings,
      captureModalPrefill: s.captureModalPrefill,
      setCaptureModalPrefill: s.setCaptureModalPrefill,
    })),
  );
  // Seeded from the store so a prefilled open (PWA shortcut, calendar slot)
  // renders with its text already in place rather than setting it in an effect.
  const [input, setInput] = useState(() => captureModalPrefill ?? "");
  const [lastRoutedInput, setLastRoutedInput] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // TASK-2.6b: the default capture action now routes AND saves in one tap
  // (see handleQuickCapture below). isCapturing tracks that combined
  // in-flight state separately from isRouting (the "Edit" path, which only
  // routes and stops at the review screen) and isSaving (Confirm & Save
  // from the review screen).
  const [isCapturing, setIsCapturing] = useState(false);
  const [routedItems, setRoutedItems] = useState<RoutedItem[] | null>(null);
  const [taskExtras, setTaskExtras] = useState<{
    [idx: number]: { first_step: string; ifthen_trigger: string };
  }>({});
  const [saved, setSaved] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const haptics = useHaptics();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (val: string) => {
    setInput(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (!routedItems) {
      // TASK-2.6b: one-tap-confirm default — Enter on the main field routes
      // and saves immediately. The review screen is opt-in via the "Edit"
      // button, not the keyboard fast path.
      handleQuickCapture();
    } else if (input !== lastRoutedInput) {
      // Already in the review screen but the user kept typing — re-route
      // the edited text instead of saving stale routing.
      handleRoute();
    } else {
      handleConfirm();
    }
  };

  // The modal unmounts when closed, so there is no stale state to reset and
  // no need for a second global key listener: AppContentWrapper owns the
  // open shortcut, and Sheet handles Escape. The prefill is seeded into the
  // input's initial state (see useState above) and cleared here once.
  useEffect(() => {
    if (captureModalPrefill) setCaptureModalPrefill(null);
    // Consumed once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoute = useCallback(async () => {
    if (!input.trim()) return;
    setIsRouting(true);
    setLastRoutedInput(input);
    try {
      const items = await routeCapture(input, userSettings || {});
      setRoutedItems(items);
    } catch {
      setRoutedItems([
        {
          type: "unknown",
          title: input,
          destination: "Inbox",
          destinationId: "inbox",
          confidence: 0.1,
          reason: "route_request_failed",
        },
      ]);
      toast.error("Routing failed", {
        description: "Falling back to manual routing.",
      });
    } finally {
      setIsRouting(false);
    }
  }, [input, userSettings]);

  const changeDestination = (idx: number, destinationId: string) => {
    setRoutedItems((prev) =>
      prev
        ? prev.map((item, i) =>
            i === idx
              ? {
                  ...item,
                  destinationId: destinationId as RoutedItem["destinationId"],
                  destination: destinationIdToLabel(
                    destinationId as RoutedItem["destinationId"],
                  ),
                }
              : item,
          )
        : prev,
    );
  };

  const updateRoutedItem = (idx: number, updates: Partial<RoutedItem>) => {
    setRoutedItems((prev) =>
      prev
        ? prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
        : prev,
    );
  };

  // Shared insert logic for both the review screen's "Confirm & Save" and
  // the one-tap quick-capture default — parameterized on items/extras so
  // quick capture can persist the freshly-routed result without waiting on
  // a setRoutedItems() state update to land first.
  const persistRoutedItems = useCallback(
    async (
      items: RoutedItem[],
      extrasMap: {
        [idx: number]: { first_step: string; ifthen_trigger: string };
      },
    ) => {
      await Promise.all(
        items.map(async (item, idx) => {
          const extras = extrasMap[idx] ?? {};
          if (item.destinationId === "do" || item.destinationId === "inbox") {
            const { error } = await supabase.from("items").insert({
              user_id: userId,
              title: item.title,
              first_step: extras.first_step || null,
              ifthen_trigger: extras.ifthen_trigger
                ? `When ${extras.ifthen_trigger}, I will ${extras.first_step || "do this"}`
                : null,
              deadline: item.deadline
                ? new Date(item.deadline).toISOString()
                : null,
              recurrence:
                (item as RoutedItem & { recurrence?: string }).recurrence ??
                null,
              status: item.destinationId === "inbox" ? "inbox" : "active",
            });
            if (error) throw new Error(`Tasks: ${error.message}`);
          } else if (item.destinationId === "think") {
            const { error } = await supabase.from("threads").insert({
              user_id: userId,
              title: item.title.slice(0, 60),
              entries: [
                {
                  text: item.title,
                  created_at: new Date().toISOString(),
                  starred: false,
                },
              ],
            });
            if (error) throw new Error(`Think: ${error.message}`);
          } else if (item.destinationId === "locations") {
            const { error } = await supabase.from("locations").insert({
              user_id: userId,
              item_name: item.item_name || item.title.split(" ")[0] || "Item",
              location_text: item.title,
            });
            if (error) throw new Error(`Locations: ${error.message}`);
          }
        }),
      );
    },
    [supabase, userId],
  );

  const handleConfirm = async () => {
    if (!routedItems) return;
    // Re-entry guard: without this, a held Enter key (OS key-repeat fires
    // several keydown events before React re-renders the disabled state) or
    // a fast double-click can call this twice before `disabled` takes
    // effect, producing duplicate inserts.
    if (isSaving) return;
    setIsSaving(true);

    try {
      await persistRoutedItems(routedItems, taskExtras);
      setSaved(true);
      toast.success("Successfully captured!");
      setTimeout(() => setCaptureModalOpen(false), 800);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An error occurred";
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save capture", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  // TASK-2.6b: one-tap-confirm default. Routes the capture and immediately
  // saves it with the router's chosen destination — no intermediate review
  // screen. If routing or saving fails, fall back to the review screen
  // (pre-filled with whatever was routed) instead of silently dropping the
  // capture, so "edit before saving" is always reachable, just not the
  // default path anymore.
  const handleQuickCapture = useCallback(async () => {
    if (!input.trim()) return;
    // Re-entry guard: this is now the hot path for essentially every
    // capture, so it can't rely solely on the button/input's `disabled`
    // prop — that only takes effect after a React re-render. OS key-repeat
    // on a held Enter key (multiple keydown events fire before a re-render
    // lands) or a fast double-click can otherwise call this twice,
    // producing two duplicate inserts of the same capture.
    if (isCapturing) return;
    setIsCapturing(true);
    setLastRoutedInput(input);
    try {
      const items = await routeCapture(input, userSettings || {});
      try {
        await persistRoutedItems(items, {});
      } catch (saveError: unknown) {
        setRoutedItems(items);
        const message =
          saveError instanceof Error ? saveError.message : "An error occurred";
        logger.error(
          saveError instanceof Error ? saveError.message : String(saveError),
        );
        toast.error("Failed to save capture", { description: message });
        return;
      }
      setSaved(true);
      toast.success("Successfully captured!");
      setTimeout(() => setCaptureModalOpen(false), 800);
    } catch {
      setRoutedItems([
        {
          type: "unknown",
          title: input,
          destination: "Inbox",
          destinationId: "inbox",
          confidence: 0.1,
          reason: "route_request_failed",
        },
      ]);
      toast.error("Routing failed", {
        description: "Falling back to manual routing.",
      });
    } finally {
      setIsCapturing(false);
    }
  }, [
    input,
    userSettings,
    persistRoutedItems,
    setCaptureModalOpen,
    isCapturing,
  ]);

  return (
    <ModalErrorBoundary
      modalName="Capture Modal"
      onClose={() => setCaptureModalOpen(false)}
    >
      <Sheet
        isOpen={isCaptureModalOpen}
        onClose={() => setCaptureModalOpen(false)}
      >
        <div className="relative mx-auto w-full max-w-2xl">
          {/* Input row */}
          <div className="relative flex items-center gap-3 rounded-t-2xl border-b border-[rgba(255,255,255,0.08)] px-5 py-4">
            {routedItems ? (
              <UiIcon
                className="h-5 w-5 shrink-0 animate-pulse text-[var(--color-accent)]"
                icon={Sparkles}
              />
            ) : (
              <UiIcon
                className="h-5 w-5 shrink-0 text-[var(--color-text-3)]"
                icon={Search}
              />
            )}
            <input
              ref={inputRef}
              autoFocus
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="off"
              placeholder='Capture anything... "Remind me to...", "Keys are in...", "I think..."'
              className="text-title-sm flex-1 border-none bg-transparent font-medium text-[var(--color-text-1)] outline-none placeholder:text-[rgba(255,255,255,0.25)]"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={isRouting || isCapturing}
              onKeyDown={handleKeyDown}
            />
            {input && !routedItems && !isRouting && !isCapturing && (
              <button
                onClick={() => {
                  handleInputChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear input"
                className="mr-1 rounded p-1 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
              >
                <UiIcon className="h-4 w-4" icon={X} />
              </button>
            )}
            {!routedItems && (
              // TASK-2.6b fix round 2: the old "Press Enter to auto-route"
              // hint was removed along with the mandatory review step, but
              // nothing explained the new behavior — Enter now saves
              // straight to the database with no confirmation step, not
              // just a preview. Restore the hint with copy that says so.
              <span className="text-caption hidden items-center gap-1.5 text-[var(--color-text-3)] sm:flex">
                Press{" "}
                <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-semibold">
                  Enter
                </kbd>{" "}
                to save
              </span>
            )}
          </div>

          {/* Routing chips view */}
          {routedItems && !saved && (
            <div className="space-y-4 p-5">
              <p className="text-caption font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
                AI Extracted Context
              </p>
              {routedItems.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <input
                    value={item.title}
                    onChange={(e) =>
                      updateRoutedItem(idx, { title: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleConfirm();
                      }
                    }}
                    className="input-title w-full border-none bg-transparent text-lg font-semibold text-[var(--color-text-1)] outline-none placeholder:text-[rgba(255,255,255,0.25)]"
                  />

                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-2)]">
                    <span className="font-semibold">Space:</span>
                    <Dropdown
                      value={item.destinationId}
                      onChange={(val) => changeDestination(idx, val)}
                      options={ROUTE_SPACE_OPTIONS}
                      colors={ROUTE_SPACE_COLORS}
                      placeholder="Choose space..."
                    />

                    {item.destinationId === "do" && (
                      <>
                        {item.recurrence && (
                          <>
                            <span className="text-[var(--color-text-3)]">
                              ·
                            </span>
                            <span className="font-semibold">Recurrence:</span>
                            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-1)]">
                              {formatRRule(item.recurrence)}
                            </span>
                          </>
                        )}
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Deadline:</span>
                        <div className="relative inline-flex items-center">
                          <span className="pointer-events-none rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium whitespace-nowrap text-[var(--color-text-1)]">
                            {item.deadline
                              ? formatCaptureDeadline(item.deadline)
                              : "No deadline"}{" "}
                            ▼
                          </span>
                          <input
                            type="datetime-local"
                            value={
                              item.deadline
                                ? toLocalISOString(new Date(item.deadline))
                                : ""
                            }
                            onChange={(e) =>
                              updateRoutedItem(idx, {
                                deadline: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null,
                              })
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </>
                    )}

                    {item.destinationId === "locations" && (
                      <>
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Item:</span>
                        <input
                          value={item.item_name || ""}
                          onChange={(e) =>
                            updateRoutedItem(idx, { item_name: e.target.value })
                          }
                          className="rounded-full border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-1)] outline-none focus:border-[var(--color-accent)]"
                          placeholder="Item name..."
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Saved animation */}
          {saved && (
            <div className="flex items-center justify-center gap-2 p-6 text-[#4ADE80]">
              <UiIcon className="h-5 w-5" icon={Check} />
              <span className="text-sm font-medium">Saved!</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
            {!routedItems ? (
              <>
                {/* TASK-2.6b: "Edit" is the deliberate opt-in into the
                    review screen — the primary action now saves directly. */}
                <Button
                  variant="ghost"
                  onClick={handleRoute}
                  disabled={!input.trim() || isRouting || isCapturing}
                  className="disabled:opacity-50"
                >
                  {isRouting ? (
                    <UiIcon
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 animate-spin"
                      icon={Loader2}
                    />
                  ) : null}
                  {isRouting ? "Routing..." : "Edit before saving"}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleQuickCapture}
                  disabled={!input.trim() || isCapturing || isRouting}
                  className="disabled:opacity-50"
                >
                  {isCapturing ? (
                    <UiIcon
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 animate-spin"
                      icon={Loader2}
                    />
                  ) : (
                    <UiIcon
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0"
                      icon={Sparkles}
                    />
                  )}
                  {isCapturing ? "Capturing..." : "Capture"}
                </Button>
              </>
            ) : !saved ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setRoutedItems(null)}
                  className=""
                >
                  <UiIcon
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0"
                    icon={X}
                  />{" "}
                  Start over
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={
                    isSaving || routedItems.some((i) => !i.destinationId)
                  }
                  className="disabled:opacity-50"
                >
                  {isSaving ? (
                    <UiIcon
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 animate-spin"
                      icon={Loader2}
                    />
                  ) : (
                    <UiIcon
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0"
                      icon={Check}
                    />
                  )}
                  {isSaving ? "Saving..." : "Confirm & Save"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Sheet>
    </ModalErrorBoundary>
  );
}
