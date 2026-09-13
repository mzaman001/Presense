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
import { formatRRule, cn, extractMentions } from "@/lib/utils";
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
  "Remember → People": "var(--color-people)",
  Think: "var(--color-think)",
  Explore: "var(--color-explore)",
  "Remember → Locations": "#4ADE80",
  Inbox: "#FBBF24",
  "Choose space...": "var(--color-text-3)",
};

const SPACE_OPTIONS = [
  { value: "Do", label: "Do" },
  { value: "Think", label: "Think" },
  { value: "Remember → People", label: "People" },
  { value: "Remember → Locations", label: "Locations" },
  { value: "Explore", label: "Explore" },
  { value: "Inbox", label: "Inbox" },
];

const ROUTE_SPACE_COLORS: Record<string, string> = {
  do: "var(--color-do)",
  people: "var(--color-people)",
  think: "var(--color-think)",
  explore: "var(--color-explore)",
  locations: "#4ADE80",
  inbox: "#FBBF24",
};

const ROUTE_SPACE_OPTIONS = [
  { value: "do", label: "Do" },
  { value: "think", label: "Think" },
  { value: "people", label: "People" },
  { value: "locations", label: "Locations" },
  { value: "explore", label: "Explore" },
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
  const [routedItems, setRoutedItems] = useState<RoutedItem[] | null>(null);
  const [taskExtras, setTaskExtras] = useState<{
    [idx: number]: { first_step: string; ifthen_trigger: string };
  }>({});
  const [saved, setSaved] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const haptics = useHaptics();

  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCaptureModalOpen || !showPopover) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("people")
        .select("id, name")
        .eq("user_id", userId)
        .limit(50);
      if (!cancelled) setPeople(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCaptureModalOpen, showPopover, supabase]);

  const filteredPeople = useMemo(() => {
    return people.filter((p) =>
      p.name.toLowerCase().includes(popoverSearch.toLowerCase()),
    );
  }, [people, popoverSearch]);

  const handleSelectPerson = useCallback(
    (person: { id: string; name: string }) => {
      if (!inputRef.current) return;
      const val = input;
      const selectionStart = inputRef.current.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selectionStart);
      const textAfterCursor = val.slice(selectionStart);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      const mentionText = `@[${person.name}](${person.id})`;
      const newVal =
        val.slice(0, lastAtIndex) + mentionText + " " + textAfterCursor;
      setInput(newVal);
      setShowPopover(false);

      // Focus input and move cursor
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const cursorPosition = lastAtIndex + mentionText.length + 1;
          inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    },
    [input],
  );

  const handleInputChange = (val: string) => {
    setInput(val);

    if (!inputRef.current) return;
    const selectionStart = inputRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (
      lastAtIndex !== -1 &&
      (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === " ")
    ) {
      const search = textBeforeCursor.slice(lastAtIndex + 1);
      if (!search.includes(" ")) {
        setShowPopover(true);
        setPopoverSearch(search);
        setSelectedIndex(0);
        return;
      }
    }
    setShowPopover(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showPopover && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPeople.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectPerson(filteredPeople[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPopover(false);
      }
    } else {
      if (e.key === "Enter") {
        if (!routedItems || input !== lastRoutedInput) {
          handleRoute();
        } else {
          handleConfirm();
        }
      }
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
      const knownPeopleNames = people.map((p) => p.name);
      const items = await routeCapture(
        input,
        knownPeopleNames,
        userSettings || {},
      );
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
  }, [input, userSettings, people]);

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

  const handleConfirm = async () => {
    if (!routedItems) return;
    setIsSaving(true);

    try {
      await Promise.all(
        routedItems.map(async (item, idx) => {
          const extras = taskExtras[idx] ?? {};
          if (item.destinationId === "do" || item.destinationId === "inbox") {
            const mentions = extractMentions(item.title);
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
              linked_people_ids: mentions,
            });
            if (error) throw new Error(`Tasks: ${error.message}`);
          } else if (item.destinationId === "people") {
            const { data: person } = await supabase
              .from("people")
              .select("id, notes")
              .eq("user_id", userId)
              .ilike("name", `%${item.person ?? ""}%`)
              .maybeSingle();
            if (person) {
              const newNote = {
                text: item.title,
                created_at: new Date().toISOString(),
                tag: "note",
              };
              const { error } = await supabase
                .from("people")
                .update({ notes: [...(person.notes ?? []), newNote] })
                .eq("id", person.id);
              if (error) throw new Error(`People: ${error.message}`);
            } else {
              const { error } = await supabase.from("people").insert({
                user_id: userId,
                name: item.person || item.title.split(" ")[0],
                notes: [
                  {
                    text: item.title,
                    created_at: new Date().toISOString(),
                    tag: "note",
                  },
                ],
              });
              if (error) throw new Error(`People: ${error.message}`);
            }
          } else if (item.destinationId === "think") {
            const mentions = extractMentions(item.title);
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
              linked_people_ids: mentions,
            });
            if (error) throw new Error(`Think: ${error.message}`);
          } else if (item.destinationId === "explore") {
            const { error } = await supabase.from("explores").insert({
              user_id: userId,
              title: item.title.slice(0, 100),
              type: item.url ? "link" : "concept",
              url: item.url ?? null,
              note: item.title,
            });
            if (error) throw new Error(`Explore: ${error.message}`);
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
              placeholder='Capture anything... "Remind me to...", "Keys are in...", "Riyaz said..."'
              className="text-title-sm flex-1 border-none bg-transparent font-medium text-[var(--color-text-1)] outline-none placeholder:text-[rgba(255,255,255,0.25)]"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={isRouting}
              onKeyDown={handleKeyDown}
            />
            {input && !routedItems && !isRouting && (
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
              <kbd className="text-caption hidden items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-semibold text-[var(--color-text-3)] sm:flex">
                Enter
              </kbd>
            )}

            {/* Mentions dropdown overlay */}
            {showPopover && filteredPeople.length > 0 && (
              <div
                className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                data-testid="mentions-popover"
              >
                {filteredPeople.map((person, idx) => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm text-[var(--color-text-1)] hover:bg-[rgba(255,255,255,0.05)] focus:outline-none",
                      idx === selectedIndex && "bg-[rgba(255,255,255,0.08)]",
                    )}
                    type="button"
                  >
                    {person.name}
                  </button>
                ))}
              </div>
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

                    {item.destinationId === "people" && (
                      <>
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Person:</span>
                        <input
                          value={item.person || ""}
                          onChange={(e) =>
                            updateRoutedItem(idx, { person: e.target.value })
                          }
                          className="rounded-full border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-1)] outline-none focus:border-[var(--color-accent)]"
                          placeholder="Name..."
                        />
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
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-3)]">
                  Press{" "}
                  <kbd className="text-caption rounded-md border border-[var(--border-subtle)] bg-[var(--border-default)] px-1.5 py-0.5 font-sans text-[var(--text-1)]">
                    Enter
                  </kbd>{" "}
                  to auto-route
                </span>
                <Button
                  variant="primary"
                  onClick={handleRoute}
                  disabled={!input.trim() || isRouting}
                  className="disabled:opacity-50"
                >
                  {isRouting ? (
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
                  {isRouting ? "Routing..." : "Route & Capture"}
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
