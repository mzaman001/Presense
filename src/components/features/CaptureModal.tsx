"use client";
import { useUserId } from "@/components/providers/SessionProvider";
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
import { cn, formatRRule } from "@/lib/utils";
import {
  Brain,
  Calendar,
  Check,
  Inbox,
  Loader2,
  MessageSquare,
  PenLine,
  Repeat,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { destinationIdToLabel, type RoutedItem } from "@/lib/capture-router";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { Sheet } from "@/components/ui/Sheet";
import { useHaptics } from "@/hooks/useHaptics";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

type DestinationId = RoutedItem["destinationId"];

/** Order is the Alt+1…4 shortcut order. Icons match the navigation. */
const DESTINATIONS: { id: DestinationId; label: string; icon: LucideIcon }[] = [
  { id: "do", label: "Do", icon: Check },
  { id: "think", label: "Think", icon: MessageSquare },
  { id: "locations", label: "Remember", icon: Brain },
  { id: "inbox", label: "Inbox", icon: Inbox },
];

const destinationMeta = (id: DestinationId) =>
  DESTINATIONS.find((d) => d.id === id) ?? DESTINATIONS[3];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

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

  const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
  if (diffDays > 0 && diffDays < 7) {
    return `${d.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
  }
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

const toLocalISOString = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const withDestination = (item: RoutedItem, id: DestinationId): RoutedItem => ({
  ...item,
  destinationId: id,
  destination: destinationIdToLabel(id),
});

/**
 * Overrides are keyed by item index and only apply while the capture still
 * splits into the same number of items, so editing the text never carries a
 * choice onto the wrong item.
 */
type Overrides = { count: number; byIndex: Record<number, DestinationId> };

function applyOverrides(items: RoutedItem[], overrides: Overrides) {
  if (overrides.count !== items.length) return items;
  return items.map((item, i) =>
    overrides.byIndex[i] ? withDestination(item, overrides.byIndex[i]) : item,
  );
}

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border-default)] px-1.5 font-sans text-[length:var(--text-meta)] font-medium whitespace-nowrap text-[var(--text-2)] tabular-nums">
      {children}
    </kbd>
  );
}

/** Four destinations as one radio group; the selection slides between them. */
function DestinationPicker({
  value,
  onChange,
  groupId,
}: {
  value: DestinationId;
  onChange: (id: DestinationId) => void;
  groupId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + DESTINATIONS.length) % DESTINATIONS.length;
    onChange(DESTINATIONS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Save to"
      className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5"
    >
      {DESTINATIONS.map((d, i) => {
        const selected = d.id === value;
        return (
          <button
            key={d.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(d.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[length:var(--text-ui)] font-medium transition-colors duration-[var(--dur-fast)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]",
              selected
                ? "text-[var(--accent-text)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]",
            )}
          >
            {selected && (
              <m.span
                layoutId={`capture-destination-${groupId}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)]"
                transition={{ duration: 0.22, ease: EASE_OUT }}
              />
            )}
            <UiIcon className="relative h-3.5 w-3.5 shrink-0" icon={d.icon} />
            <span className="relative">{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MetaChip({
  icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <m.span
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 text-[length:var(--text-meta)] font-medium whitespace-nowrap text-[var(--text-2)]"
    >
      <UiIcon className="h-3.5 w-3.5 text-[var(--text-3)]" icon={icon} />
      {children}
    </m.span>
  );
}

/** What the router understood about one item, beyond where it goes. */
function ItemMeta({ item }: { item: RoutedItem }) {
  const showDate =
    (item.destinationId === "do" || item.destinationId === "inbox") &&
    item.deadline;
  return (
    <AnimatePresence initial={false}>
      {showDate && (
        <MetaChip key="date" icon={Calendar}>
          {formatCaptureDeadline(item.deadline!)}
        </MetaChip>
      )}
      {item.destinationId === "do" && item.recurrence && (
        <MetaChip key="repeat" icon={Repeat}>
          {formatRRule(item.recurrence)}
        </MetaChip>
      )}
      {item.destinationId === "locations" && item.item_name && (
        <MetaChip key="item" icon={Tag}>
          {item.item_name}
        </MetaChip>
      )}
    </AnimatePresence>
  );
}

function describeItem(item: RoutedItem) {
  const parts = [`Saves to ${destinationMeta(item.destinationId).label}`];
  if (
    (item.destinationId === "do" || item.destinationId === "inbox") &&
    item.deadline
  ) {
    parts.push(`due ${formatCaptureDeadline(item.deadline)}`);
  }
  return parts.join(", ");
}

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
  // The live parse of `input`. The router is local (keywords + chrono), so it
  // re-runs as the user types; `forText` says which text it describes.
  const [preview, setPreview] = useState<{
    items: RoutedItem[];
    forText: string;
  } | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({
    count: 0,
    byIndex: {},
  });
  // "review" is the opt-in editable form; saving is the default path.
  const [reviewItems, setReviewItems] = useState<RoutedItem[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  // Re-entry guard: a held Enter (OS key-repeat) or a double-click fires
  // before React re-renders the disabled state, which used to double-insert.
  const savingRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);
  const haptics = useHaptics();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mac] = useState(isMac);

  // The prefill is seeded into state above and cleared here once, on mount.
  useEffect(() => {
    if (captureModalPrefill) setCaptureModalPrefill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!input.trim()) return;
    let cancelled = false;
    const text = input;
    const timer = setTimeout(() => {
      routeCapture(text, userSettings || {})
        .then((items) => {
          if (!cancelled) setPreview({ items, forText: text });
        })
        .catch(() => {
          // A failed parse leaves the last preview; saving re-routes anyway.
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, userSettings]);

  const hasText = input.trim().length > 0;
  const previewItems =
    hasText && preview ? applyOverrides(preview.items, overrides) : null;
  const primary = previewItems?.[0];

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!value.trim()) setPreview(null);
  };

  const setDestination = useCallback(
    (index: number | "all", id: DestinationId) => {
      const count = preview?.items.length ?? 1;
      setOverrides((prev) => {
        const byIndex = prev.count === count ? { ...prev.byIndex } : {};
        if (index === "all") {
          for (let i = 0; i < count; i++) byIndex[i] = id;
        } else {
          byIndex[index] = id;
        }
        return { count, byIndex };
      });
    },
    [preview],
  );

  const persistItems = useCallback(
    async (items: RoutedItem[]) => {
      await Promise.all(
        items.map(async (item) => {
          if (item.destinationId === "do" || item.destinationId === "inbox") {
            const { error } = await supabase.from("items").insert({
              user_id: userId,
              title: item.title,
              deadline: item.deadline
                ? new Date(item.deadline).toISOString()
                : null,
              recurrence: item.recurrence ?? null,
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

  /** The items to save: the live preview if it matches the text, else fresh. */
  const resolveItems = useCallback(async () => {
    const base =
      preview && preview.forText === input
        ? preview.items
        : await routeCapture(input, userSettings || {});
    return applyOverrides(base, overrides);
  }, [preview, input, userSettings, overrides]);

  const finishSaved = useCallback(
    (items: RoutedItem[]) => {
      const labels = [
        ...new Set(items.map((i) => destinationMeta(i.destinationId).label)),
      ];
      const where = labels.join(" and ");
      setSavedTo(where);
      haptics.success();
      toast.success(`Saved to ${where}`);
      setTimeout(() => setCaptureModalOpen(false), 800);
    },
    [haptics, setCaptureModalOpen],
  );

  const runSave = useCallback(
    async (getItems: () => Promise<RoutedItem[]>) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setIsSaving(true);
      let items: RoutedItem[];
      try {
        items = await getItems();
      } catch {
        // Routing failed: keep the text and let the user pick a space.
        setReviewItems([
          {
            type: "unknown",
            title: input,
            destination: "Inbox",
            destinationId: "inbox",
            confidence: 0.1,
            reason: "route_request_failed",
          },
        ]);
        toast.error("Couldn't sort this capture", {
          description: "Pick a space and save it yourself.",
        });
        savingRef.current = false;
        setIsSaving(false);
        return;
      }
      try {
        await persistItems(items);
      } catch (e: unknown) {
        // Never drop a capture: open the review form with it filled in.
        setReviewItems(items);
        const message = e instanceof Error ? e.message : String(e);
        logger.error(message);
        toast.error("Couldn't save your capture", { description: message });
        savingRef.current = false;
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
      finishSaved(items);
    },
    [input, persistItems, finishSaved],
  );

  const handleSave = useCallback(() => {
    if (!input.trim()) return;
    void runSave(resolveItems);
  }, [input, runSave, resolveItems]);

  const handleSaveReview = useCallback(() => {
    if (!reviewItems) return;
    const items = reviewItems;
    void runSave(async () => items);
  }, [reviewItems, runSave]);

  const openReview = useCallback(async () => {
    if (!input.trim() || savingRef.current) return;
    try {
      setReviewItems(await resolveItems());
    } catch {
      setReviewItems([
        {
          type: "unknown",
          title: input,
          destination: "Inbox",
          destinationId: "inbox",
          confidence: 0.1,
          reason: "route_request_failed",
        },
      ]);
    }
  }, [input, resolveItems]);

  const updateReviewItem = (index: number, updates: Partial<RoutedItem>) => {
    setReviewItems((prev) =>
      prev
        ? prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
        : prev,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) void openReview();
      else handleSave();
      return;
    }
    // Alt/Option + 1–4 picks the space. e.code, because Option+digit types a
    // symbol on macOS and e.key would be "¡", "™", …
    if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      setDestination("all", DESTINATIONS[Number(e.code.slice(5)) - 1].id);
    }
  };

  const busy = isSaving || savedTo !== null;
  const primaryLabel = (() => {
    if (!previewItems?.length) return "Save";
    const ids = new Set(previewItems.map((i) => i.destinationId));
    return ids.size === 1
      ? `Save to ${destinationMeta(previewItems[0].destinationId).label}`
      : `Save ${previewItems.length} items`;
  })();
  const LeadIcon = primary
    ? destinationMeta(primary.destinationId).icon
    : PenLine;
  const uncertain =
    previewItems?.length === 1 &&
    primary?.type === "unknown" &&
    overrides.count !== 1;

  return (
    <ModalErrorBoundary
      modalName="Capture Modal"
      onClose={() => setCaptureModalOpen(false)}
    >
      <Sheet
        isOpen={isCaptureModalOpen}
        onClose={() => setCaptureModalOpen(false)}
        ariaLabel="Capture"
        className="md:max-w-2xl"
        bodyClassName="p-0 md:p-0"
      >
        <div className="relative w-full">
          {/* Input row */}
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)]",
                primary
                  ? "bg-[var(--accent-dim)] text-[var(--accent-text)]"
                  : "bg-[var(--surface-2)] text-[var(--text-3)]",
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={primary?.destinationId ?? "empty"}
                  initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="flex"
                >
                  <UiIcon className="h-4 w-4" icon={LeadIcon} />
                </m.span>
              </AnimatePresence>
            </span>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="off"
              aria-label="Capture"
              aria-describedby="capture-preview-summary"
              placeholder="Add a task, a thought, or where you put something"
              className="text-title-sm min-w-0 flex-1 border-none bg-transparent font-medium text-[var(--text-1)] caret-[var(--accent)] outline-none placeholder:text-[var(--text-decorative)] disabled:opacity-60"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={busy || reviewItems !== null}
              onKeyDown={handleKeyDown}
            />
            {hasText && !busy && reviewItems === null && (
              <button
                type="button"
                onClick={() => {
                  handleInputChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear"
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:outline-none"
              >
                <UiIcon className="h-4 w-4" icon={X} />
              </button>
            )}
          </div>

          <p
            id="capture-preview-summary"
            className="sr-only"
            aria-live="polite"
          >
            {!savedTo && previewItems?.length
              ? previewItems.map(describeItem).join(". ")
              : ""}
          </p>

          {/* Body: hint → live preview → review form → saved */}
          <m.div
            layout
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            {savedTo ? (
              <m.div
                key="saved"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className="flex items-center gap-3 px-5 py-6"
              >
                <m.span
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-on-accent)]"
                >
                  <UiIcon className="h-4 w-4" strokeWidth={2.5} icon={Check} />
                </m.span>
                <span
                  role="status"
                  className="text-[length:var(--text-body)] font-medium text-[var(--text-1)]"
                >
                  {`Saved to ${savedTo}`}
                </span>
              </m.div>
            ) : reviewItems ? (
              <div className="space-y-5 px-5 py-5">
                {reviewItems.map((item, index) => (
                  <div key={index} className="space-y-3">
                    <input
                      aria-label="Title"
                      value={item.title}
                      onChange={(e) =>
                        updateReviewItem(index, { title: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSaveReview();
                        }
                      }}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border-input)] bg-[var(--surface-input)] px-3 py-2 text-[length:var(--text-body)] font-medium text-[var(--text-1)] caret-[var(--accent)] outline-none focus:border-[var(--border-focus)]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <DestinationPicker
                        groupId={`review-${index}`}
                        value={item.destinationId}
                        onChange={(id) =>
                          setReviewItems((prev) =>
                            prev
                              ? prev.map((it, i) =>
                                  i === index ? withDestination(it, id) : it,
                                )
                              : prev,
                          )
                        }
                      />
                      {(item.destinationId === "do" ||
                        item.destinationId === "inbox") && (
                        <label className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 text-[length:var(--text-meta)] text-[var(--text-2)] focus-within:border-[var(--border-focus)]">
                          <UiIcon
                            className="h-3.5 w-3.5 text-[var(--text-3)]"
                            icon={Calendar}
                          />
                          <span className="sr-only">Due</span>
                          <input
                            type="datetime-local"
                            value={
                              item.deadline
                                ? toLocalISOString(new Date(item.deadline))
                                : ""
                            }
                            onChange={(e) =>
                              updateReviewItem(index, {
                                deadline: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null,
                              })
                            }
                            className="bg-transparent text-[var(--text-1)] [color-scheme:inherit] outline-none"
                          />
                        </label>
                      )}
                      {item.destinationId === "locations" && (
                        <label className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 text-[length:var(--text-meta)] text-[var(--text-2)] focus-within:border-[var(--border-focus)]">
                          <UiIcon
                            className="h-3.5 w-3.5 text-[var(--text-3)]"
                            icon={Tag}
                          />
                          <span className="sr-only">Item name</span>
                          <input
                            value={item.item_name || ""}
                            onChange={(e) =>
                              updateReviewItem(index, {
                                item_name: e.target.value,
                              })
                            }
                            placeholder="Item"
                            className="w-28 bg-transparent text-[var(--text-1)] outline-none placeholder:text-[var(--text-decorative)]"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : previewItems?.length ? (
              <div className="space-y-4 px-5 py-4">
                {previewItems.map((item, index) => (
                  <div key={index} className="space-y-2.5">
                    {previewItems.length > 1 && (
                      <p className="truncate text-[length:var(--text-ui)] font-medium text-[var(--text-1)]">
                        {item.title}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <DestinationPicker
                        groupId={`preview-${index}`}
                        value={item.destinationId}
                        onChange={(id) => setDestination(index, id)}
                      />
                      <ItemMeta item={item} />
                    </div>
                  </div>
                ))}
                {uncertain && (
                  <p className="text-[length:var(--text-meta)] text-[var(--text-3)]">
                    Not sure where this belongs, so it goes to Inbox. Pick a
                    space to change that.
                  </p>
                )}
              </div>
            ) : (
              <p className="px-5 py-4 text-[length:var(--text-meta)] text-[var(--text-3)]">
                Write it the way you&apos;d say it. Dates, repeats and where you
                put things are picked up as you type.
              </p>
            )}
          </m.div>

          {/* Action bar */}
          {!savedTo && (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-3">
              {reviewItems ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReviewItems(null);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    disabled={isSaving}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveReview}
                    disabled={isSaving}
                  >
                    {isSaving && (
                      <UiIcon
                        size={14}
                        className="shrink-0 animate-spin"
                        icon={Loader2}
                      />
                    )}
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <div
                    className="hidden items-center gap-3 text-[length:var(--text-meta)] whitespace-nowrap text-[var(--text-3)] md:flex"
                    aria-hidden="true"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Kbd>↵</Kbd> save
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Kbd>⇧</Kbd>
                      <Kbd>↵</Kbd> review
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Kbd>{mac ? "⌥" : "Alt"}</Kbd>
                      <Kbd>1–4</Kbd> space
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => void openReview()}
                      disabled={!hasText || busy}
                    >
                      Review first
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={!hasText || busy}
                    >
                      {isSaving && (
                        <UiIcon
                          size={14}
                          className="shrink-0 animate-spin"
                          icon={Loader2}
                        />
                      )}
                      {isSaving ? "Saving…" : primaryLabel}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Sheet>
    </ModalErrorBoundary>
  );
}
