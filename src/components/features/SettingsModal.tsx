"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useAppStore } from "@/store/useAppStore";
import { useSessionUser } from "@/components/providers/SessionProvider";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient } from "@/lib/supabase";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import {
  X,
  Loader2,
  LogOut,
  Download,
  CheckCircle2,
  User,
  Palette,
  Bell,
  Timer,
  CheckSquare,
  Brain,
  Database,
  Plus,
  Trash2,
  Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema } from "@/lib/schemas";
import { z } from "zod";

type SettingsFormValues = z.infer<typeof settingsSchema>;
import { useQueryClient } from "@tanstack/react-query";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  applyDocumentTheme,
  normalizeColorMode,
  normalizeThemeId,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/* BUG-45 — the fields the autosave debounce watches. `watch(AUTOSAVE_FIELDS)`
   returns an array of values in this same order (react-hook-form's array-arg
   overload), not an object keyed by field name — the array must be zipped
   back into an object before it can be sent as a Supabase update payload. */
const AUTOSAVE_FIELDS = [
  "display_name",
  "avatar_color",
  "timezone",
  // Appearance was missing here, so a mode change only reached localStorage
  // and the next load reapplied the stale DB value ("theme keeps resetting").
  "color_mode",
  "reduce_motion",
  "notifications_enabled",
  "notif_overdue",
  "notif_stale_threads",
  "daily_briefing",
  "pomodoro_sound",
  "pomodoro_duration",
  "short_break_duration",
  "long_break_duration",
  "auto_start_breaks",
  "default_view",
  "auto_archive_days",
  "smart_routing_enabled",
  "nlp_date_parsing",
  "nudge_time",
  "shutdown_time",
  "pomodoro_long_break_interval",
  "daily_capacity_minutes",
  "do_categories",
  "do_category_colors",
] as const satisfies readonly (keyof SettingsFormValues)[];

const TABS = [
  {
    id: "account",
    label: "Account",
    icon: User,
    description: "Who you are across Presense.",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "How Presense looks and moves.",
  },
  {
    id: "ritual",
    label: "Daily ritual",
    icon: Sunrise,
    description: "The rhythm that bookends your day.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "What's worth interrupting you for.",
  },
  {
    id: "focus",
    label: "Focus",
    icon: Timer,
    description: "The shape of a focus session.",
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    description: "Categories and housekeeping for Do.",
  },
  {
    id: "routing",
    label: "Smart routing",
    icon: Brain,
    description: "How captures find their place.",
  },
  {
    id: "data",
    label: "Data",
    icon: Database,
    description: "Export or tidy what you've stored.",
  },
];

const AVATAR_COLORS = [
  "#F472B6",
  "#4ADE80",
  "#3B82F6",
  "#FBBF24",
  "#A855F7",
  "#EF4444",
];

const CATEGORY_COLORS = [
  "#F87171",
  "#FBBF24",
  "#4ADE80",
  "#2DD4BF",
  "#7692FF",
  "#8B7CF8",
  "#F472B6",
  "#9CA3AF",
];

const TIMEZONE_OPTIONS: { value: string; label: string }[] =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] })
        .supportedValuesOf("timeZone")
        .map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))
    : [
        { value: "UTC", label: "UTC" },
        { value: "America/New_York", label: "Eastern Time (ET)" },
        { value: "America/Chicago", label: "Central Time (CT)" },
        { value: "America/Denver", label: "Mountain Time (MT)" },
        { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
        { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
        { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
      ];

const TIME_OPTIONS = Array.from({ length: 96 }).map((_, i) => {
  const hours = Math.floor(i / 4)
    .toString()
    .padStart(2, "0");
  const mins = ((i % 4) * 15).toString().padStart(2, "0");
  const value = `${hours}:${mins}`;
  const h = Math.floor(i / 4);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const label = `${h12}:${mins} ${ampm}`;
  return { value, label };
});

interface SettingsState {
  [key: string]: unknown;
  display_name?: string;
  avatar_color?: string;
  timezone?: string;
  theme?: string;
  color_mode?: string;
  reduce_motion?: boolean;
  notifications_enabled?: boolean;
  daily_briefing?: boolean;
  pomodoro_sound?: boolean;
  pomodoro_duration?: number;
  short_break_duration?: number;
  long_break_duration?: number;
  auto_start_breaks?: boolean;
  default_view?: string;
  auto_archive_days?: number;
  do_categories?: string[];
  do_category_colors?: Record<string, string>;
  smart_routing_enabled?: boolean;
  nlp_date_parsing?: boolean;
  nudge_time?: string;
  shutdown_time?: string;
  pomodoro_long_break_interval?: number;
  daily_capacity_minutes?: number;
  density?: "comfortable" | "compact";
}

/* ---------------------------------------------------------------------
   Settings layout primitives. A group is one rounded card; each row is a
   label + description on the left and its control on the right, separated
   from its neighbours by a hairline. `stack` puts a wide control (text
   field, segmented control, slider) underneath the label instead.
   --------------------------------------------------------------------- */
function SettingsGroup({
  title,
  tone,
  children,
}: {
  title?: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      {title && (
        <h4
          className={cn(
            "text-label px-1",
            tone === "danger"
              ? "text-[var(--status-danger)]"
              : "text-[var(--text-3)]",
          )}
        >
          {title}
        </h4>
      )}
      <div className="settings-group">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  stack,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  stack?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("settings-row", stack && "settings-row--stack")}>
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--text-body-lg)] font-medium text-[var(--text-1)]">
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[length:var(--text-body)] text-[var(--text-3)]">
            {description}
          </div>
        )}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("toggle-track", checked && "on")}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function CategoryItem({
  cat,
  initialColor,
  cats,
  colors,
  categoriesKey,
  colorsKey,
  updateSetting,
  setSettings,
  supabase,
}: {
  cat: string;
  initialColor: string;
  cats: string[];
  colors: Record<string, string>;
  categoriesKey: string;
  colorsKey: string;
  updateSetting: (key: string, value: unknown) => void;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  supabase: ReturnType<typeof createClient>;
}) {
  const [editName, setEditName] = useState(cat);

  const handleRename = async () => {
    const trimmed = editName.trim().toLowerCase();
    if (trimmed && trimmed !== cat && !cats.includes(trimmed)) {
      const newCats = cats.map((c) => (c === cat ? trimmed : c));

      try {
        // 1. Invoke Postgres SQL RPC to atomically rename category across tables
        const { error } = await supabase.rpc("rename_category", {
          p_categories_key: categoriesKey,
          p_colors_key: colorsKey,
          p_old_category: cat,
          p_new_category: trimmed,
        });

        if (error) throw error;

        // 2. Synchronously update local modal state
        setSettings((prev: SettingsState) => {
          const next = { ...prev };
          next[categoriesKey] = newCats;
          if (colors[cat]) {
            const newColors = { ...colors };
            newColors[trimmed] = newColors[cat];
            delete newColors[cat];
            next[colorsKey] = newColors;
          }
          return next;
        });

        // 3. Synchronously update global AppStore state
        const currentStoreSettings = useAppStore.getState().userSettings;
        const updatedStoreSettings = {
          ...currentStoreSettings,
          [categoriesKey]: newCats,
        };
        if (colors[cat]) {
          const newColors = { ...colors };
          newColors[trimmed] = newColors[cat];
          delete newColors[cat];
          updatedStoreSettings[colorsKey] = newColors;
        }
        useAppStore.getState().setUserSettings(updatedStoreSettings);

        toast.success(`Renamed category to ${trimmed}`);
      } catch (err: unknown) {
        toast.error("Failed to rename category", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        setEditName(cat);
      }
    } else {
      setEditName(cat);
    }
  };

  const handleDelete = (delCat: string) => {
    updateSetting(
      categoriesKey,
      cats.filter((c) => c !== delCat),
    );
  };

  const handleColorChange = (colorCat: string, color: string) => {
    updateSetting(colorsKey, { ...colors, [colorCat]: color });
  };

  const isDirty = editName.trim() !== cat && editName.trim().length > 0;
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = initialColor || "#9CA3AF";

  return (
    <div className="settings-row flex-col !items-stretch !gap-0 !py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-label={`Colour for "${cat}"`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]"
        >
          <span
            aria-hidden="true"
            className="block size-3.5 rounded-full"
            style={{ backgroundColor: current }}
          />
        </button>
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          aria-label={`Rename category "${cat}"`}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-[length:var(--text-body-lg)] font-medium text-[var(--text-1)] capitalize focus:bg-[var(--surface-hover)] focus:outline-none"
        />
        {isDirty && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur still renames
            onClick={handleRename}
            aria-label={`Save rename to "${editName.trim()}"`}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--status-done)] hover:bg-[var(--surface-hover)]"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleDelete(cat)}
          aria-label={`Delete category "${cat}"`}
          className="row-actions flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {pickerOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1 pt-1 pb-1 pl-9">
              {CATEGORY_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleColorChange(cat, preset)}
                  aria-label={`Set colour ${preset}`}
                  aria-pressed={current.toLowerCase() === preset.toLowerCase()}
                  className="swatch swatch-sm"
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: preset }}
                  />
                </button>
              ))}
              <label
                className="swatch swatch-sm cursor-pointer"
                title="Custom colour"
              >
                <span
                  aria-hidden="true"
                  style={{
                    background:
                      "conic-gradient(#f87171, #fbbf24, #4ade80, #2dd4bf, #7692ff, #f472b6, #f87171)",
                  }}
                />
                <input
                  type="color"
                  value={current}
                  onChange={(e) => handleColorChange(cat, e.target.value)}
                  aria-label="Custom colour"
                  className="sr-only"
                />
              </label>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryManager({
  title,
  categoriesKey,
  colorsKey,
  defaultCategories,
  settings,
  updateSetting,
  setSettings,
  supabase,
}: {
  title: string;
  categoriesKey: string;
  colorsKey: string;
  defaultCategories: string[];
  settings: SettingsState;
  updateSetting: (key: string, value: unknown) => void;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  supabase: ReturnType<typeof createClient>;
}) {
  const cats: string[] =
    (settings[categoriesKey] as string[]) || defaultCategories;
  const colors: Record<string, string> =
    (settings[colorsKey] as Record<string, string>) || {};
  const [newCat, setNewCat] = useState("");

  const handleAdd = () => {
    const trimmed = newCat.trim().toLowerCase();
    if (!trimmed || cats.includes(trimmed)) return;
    updateSetting(categoriesKey, [...cats, trimmed]);
    setNewCat("");
    // Step 4 (task 2.6): this action had no feedback at all before —
    // matches the Think page's per-action toast pattern (toast.success
    // right where the action happened) rather than relying solely on the
    // debounced autosave indicator.
    toast.success(`Added category "${trimmed}"`);
  };

  return (
    <SettingsGroup title={title}>
      {cats.map((cat) => (
        <CategoryItem
          key={cat}
          cat={cat}
          initialColor={colors[cat]}
          cats={cats}
          colors={colors}
          categoriesKey={categoriesKey}
          colorsKey={colorsKey}
          updateSetting={updateSetting}
          setSettings={setSettings}
          supabase={supabase}
        />
      ))}
      <div className="settings-row !py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center text-[var(--text-3)]">
            <Plus aria-hidden="true" className="size-4" />
          </span>
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a category"
            aria-label="New category name"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[length:var(--text-body-lg)] text-[var(--text-1)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {newCat.trim() && (
            <Button size="sm" variant="secondary" onClick={handleAdd}>
              Add
            </Button>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}

/* BUG-45 — BUG-45 guard: SettingsModal is always mounted by DynamicModals.
   Previously every hook (unselective `watch()` → debounce → render-driven
   `reset()`/theme effect) ran on every render, producing React's
   "state update on a component that hasn't mounted yet" warning. Now the
   shell renders null when closed, and all form work lives in
   SettingsModalContent so hooks run only while the modal is open. */
export function SettingsModal() {
  const isSettingsModalOpen = useAppStore((s) => s.isSettingsModalOpen);
  const setSettingsModalOpen = useAppStore((s) => s.setSettingsModalOpen);

  if (!isSettingsModalOpen) return null; // BUG-45: inert when closed
  return <SettingsModalContent onClose={setSettingsModalOpen} />;
}

function SettingsModalContent({
  onClose,
}: {
  onClose: (open: boolean) => void;
}) {
  const { id: userId, email: userAccountEmail } = useSessionUser();
  const { setUserSettings, settingsActiveTab, setSettingsActiveTab } =
    useAppStore(
      useShallow((s) => ({
        setUserSettings: s.setUserSettings,
        settingsActiveTab: s.settingsActiveTab,
        setSettingsActiveTab: s.setSettingsActiveTab,
      })),
    );
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();

  const activeTab = settingsActiveTab || "account";
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [initialLoaded, setInitialLoaded] = useState(false);

  const { control, register, watch, setValue, reset, getValues } =
    useForm<SettingsFormValues>({
      resolver: zodResolver(settingsSchema),
      defaultValues: {},
    });

  /* BUG-45 — selective subscriptions: the save debounce only needs the
     persistence-relevant surface, and the theme effect only needs the
     three theme fields. Unselective `watch()` returns a new object every
     render and was the engine of the setState-in-render warning. */
  const watchedAutosaveValues = watch(AUTOSAVE_FIELDS);
  const [debouncedSettings] = useDebounce(
    useMemo(
      () =>
        Object.fromEntries(
          AUTOSAVE_FIELDS.map((name, i) => [name, watchedAutosaveValues[i]]),
        ) as Pick<SettingsFormValues, (typeof AUTOSAVE_FIELDS)[number]>,
      // watch() returns a new array every render; spreading its elements as
      // the deps array (rather than `[watchedAutosaveValues]`) is what makes
      // this memo stable when the field values themselves haven't changed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      watchedAutosaveValues,
    ),
    1000,
  );
  /* BUG-45 — selective useWatch subscriptions replace the unselective
     `watch()` (which re-created its object every render). Only the
     fields the modal actually renders/saves are subscribed. */
  const themeValue = useWatch({ control, name: "theme" });
  const colorModeValue = useWatch({ control, name: "color_mode" });
  const reduceMotionValue = useWatch({ control, name: "reduce_motion" });
  const avatarColorValue = useWatch({ control, name: "avatar_color" });
  const timezoneValue = useWatch({ control, name: "timezone" });
  const notificationsEnabledValue = useWatch({
    control,
    name: "notifications_enabled",
  });
  const dailyBriefingValue = useWatch({ control, name: "daily_briefing" });
  const pomodoroSoundValue = useWatch({ control, name: "pomodoro_sound" });
  const notifOverdueValue = useWatch({ control, name: "notif_overdue" });
  const notifStaleThreadsValue = useWatch({
    control,
    name: "notif_stale_threads",
  });
  const pomodoroDurationValue = useWatch({
    control,
    name: "pomodoro_duration",
  });
  const shortBreakDurationValue = useWatch({
    control,
    name: "short_break_duration",
  });
  const longBreakDurationValue = useWatch({
    control,
    name: "long_break_duration",
  });
  const autoStartBreaksValue = useWatch({
    control,
    name: "auto_start_breaks",
  });
  const autoArchiveDaysValue = useWatch({
    control,
    name: "auto_archive_days",
  });
  const nudgeTimeValue = useWatch({ control, name: "nudge_time" });
  const shutdownTimeValue = useWatch({ control, name: "shutdown_time" });
  const pomodoroLongBreakIntervalValue = useWatch({
    control,
    name: "pomodoro_long_break_interval",
  });
  const dailyCapacityMinutesValue = useWatch({
    control,
    name: "daily_capacity_minutes",
  });
  const smartRoutingEnabledValue = useWatch({
    control,
    name: "smart_routing_enabled",
  });
  const nlpDateParsingValue = useWatch({ control, name: "nlp_date_parsing" });

  /* BUG-45 — a derived view over selective useWatch subscriptions replaces
     the unselective `watch()` (which re-created its object every render).
     This memo recomputes only when a watched field actually changes. */
  const settings = useMemo(
    () => ({
      theme: themeValue,
      color_mode: colorModeValue,
      reduce_motion: reduceMotionValue,
      avatar_color: avatarColorValue,
      timezone: timezoneValue,
      notifications_enabled: notificationsEnabledValue,
      daily_briefing: dailyBriefingValue,
      pomodoro_sound: pomodoroSoundValue,
      notif_overdue: notifOverdueValue,
      notif_stale_threads: notifStaleThreadsValue,
      pomodoro_duration: pomodoroDurationValue,
      short_break_duration: shortBreakDurationValue,
      long_break_duration: longBreakDurationValue,
      auto_start_breaks: autoStartBreaksValue,
      auto_archive_days: autoArchiveDaysValue,
      nudge_time: nudgeTimeValue,
      shutdown_time: shutdownTimeValue,
      pomodoro_long_break_interval: pomodoroLongBreakIntervalValue,
      daily_capacity_minutes: dailyCapacityMinutesValue,
      smart_routing_enabled: smartRoutingEnabledValue,
      nlp_date_parsing: nlpDateParsingValue,
    }),
    [
      themeValue,
      colorModeValue,
      reduceMotionValue,
      avatarColorValue,
      timezoneValue,
      notificationsEnabledValue,
      dailyBriefingValue,
      pomodoroSoundValue,
      notifOverdueValue,
      notifStaleThreadsValue,
      pomodoroDurationValue,
      shortBreakDurationValue,
      longBreakDurationValue,
      autoStartBreaksValue,
      autoArchiveDaysValue,
      nudgeTimeValue,
      shutdownTimeValue,
      pomodoroLongBreakIntervalValue,
      dailyCapacityMinutesValue,
      smartRoutingEnabledValue,
      nlpDateParsingValue,
    ],
  );

  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [clearTasksConfirm, setClearTasksConfirm] = useState(false);
  const [clearLocationsConfirm, setClearLocationsConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const lastSavedSettingsRef = useRef<string | null>(null);
  const debounceSettledRef = useRef(false);
  const dialogRef = useDialogFocus(true);
  /* BUG-46 — `density` has NO column in `user_settings` (verified live),
     so it must never enter the autosave payload. Keep it as pure
     session-local UI state until a schema decision is made. */
  const [localDensity, setLocalDensity] = useState<"compact" | "comfortable">(
    "compact",
  );
  useBodyScrollLock(true);

  useEffect(() => {
    /* BUG-45 — this component only mounts when the modal is open, but keep
       the guard so the effect's deps stay honest if wiring changes. */
    async function loadSettings() {
      setLoading(true);
      try {
        setUserEmail(userAccountEmail);

        const { data, error } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (error) throw error;
        if (data) {
          /* @todo: Untyped usage justified per TOOL-01 */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reset(data as any);
          // Baseline for autosave = exactly what was just loaded, in the same
          // shape the debounced watcher produces. Taking it later (from the
          // first debounced value) captured pre-load defaults, so every open
          // "saved" the loaded values straight back to the database.
          lastSavedSettingsRef.current = JSON.stringify(
            Object.fromEntries(
              AUTOSAVE_FIELDS.map((name) => [name, getValues(name)]),
            ),
          );
          /* @todo: Untyped usage justified per TOOL-01 */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setUserSettings(data as any);
        }
      } catch {
        toast.error("Couldn't load settings. Please try again.");
      } finally {
        setLoading(false);
        setTimeout(() => setInitialLoaded(true), 100);
      }
    }
    loadSettings();
  }, [supabase, setUserSettings, reset, getValues]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A dropdown or confirm dialog inside Settings handles its own Escape
      // (and marks it handled); only an unclaimed Escape closes Settings.
      if (e.key === "Escape" && !e.defaultPrevented) {
        onClose(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!initialLoaded) return;

    const currentSettingsStr = JSON.stringify(debouncedSettings);
    // The debounced value trails the form by a second. Until it has caught
    // up with the live form values it is stale (right after opening it still
    // holds the pre-load defaults), and saving it would write those defaults
    // over the user's settings. Wait for it to settle, then compare with the
    // loaded baseline: equal means nothing changed, so nothing to save.
    if (!debounceSettledRef.current) {
      const liveStr = JSON.stringify(
        Object.fromEntries(
          AUTOSAVE_FIELDS.map((name) => [name, getValues(name)]),
        ),
      );
      if (currentSettingsStr !== liveStr) return;
      debounceSettledRef.current = true;
    }
    if (lastSavedSettingsRef.current === null) {
      lastSavedSettingsRef.current = currentSettingsStr;
      return;
    }
    if (lastSavedSettingsRef.current === currentSettingsStr) return;

    const save = async () => {
      setSaveStatus("saving");

      const { error } = await supabase
        .from("user_settings")
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(debouncedSettings as any)
        .eq("user_id", userId);

      if (error) {
        toast.error("Failed to save settings", { description: error.message });
        setSaveStatus("idle");
      } else {
        lastSavedSettingsRef.current = currentSettingsStr;
        // Merge, never replace: the autosave slice lacks fields such as
        // `theme`, and AppInitializer re-applies the theme from the store.
        setUserSettings({
          ...useAppStore.getState().userSettings,
          ...debouncedSettings,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    };
    save();
  }, [debouncedSettings, supabase, initialLoaded, setUserSettings, getValues]);

  /* BUG-45 — driven by selective `useWatch` values instead of the
     whole-object `watch()` reference, which changed on every render. */
  useEffect(() => {
    if (!initialLoaded) return;
    localStorage.setItem(
      "presense_theme",
      normalizeThemeId(String(themeValue ?? "")),
    );
    localStorage.setItem(
      "presense_color_mode",
      normalizeColorMode(String(colorModeValue ?? "")),
    );
    localStorage.setItem(
      "presense_reduce_motion",
      String(Boolean(reduceMotionValue)),
    );
    applyDocumentTheme(
      String(themeValue ?? ""),
      String(colorModeValue ?? ""),
      Boolean(reduceMotionValue),
    );
  }, [themeValue, colorModeValue, reduceMotionValue, initialLoaded]);

  const updateSetting = useCallback(
    (key: string, value: unknown) => {
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(key as any, value, { shouldValidate: true, shouldDirty: true });
    },
    [setValue],
  );

  const setSettings = useCallback(
    /* @todo: Untyped usage justified per TOOL-01 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (action: any) => {
      if (typeof action === "function") {
        reset(action(getValues()));
      } else {
        reset(action);
      }
    },
    [reset, getValues],
  );

  const handleSignOut = async () => {
    localStorage.removeItem("presense_theme");
    localStorage.removeItem("presense_color_mode");
    localStorage.removeItem("presense_reduce_motion");
    await supabase.auth.signOut();
    onClose(false);
    router.push("/login");
  };

  const handleExportData = async () => {
    try {
      toast.info("Preparing export...");

      const [items, threads, locations, settings] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", userId),
        supabase.from("threads").select("*").eq("user_id", userId),
        supabase.from("locations").select("*").eq("user_id", userId),
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", userId)
          .single(),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        items: items.data ?? [],
        threads: threads.data ?? [],
        locations: locations.data ?? [],
        settings: settings.data ?? {},
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presense-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error("Export failed", { description: message });
    }
  };

  const handleClearCompleted = async () => {
    try {
      const { error } = await supabase
        // INFRA-19: clear-completed = trash with deleted_at, per lifecycle
        // vocabulary; the stale completed_at is cleared too so a later
        // restore doesn't rank as done in the archive view.
        .from("items")
        .update({ ...moveItemToTrashPatch(), completed_at: null })
        .eq("user_id", userId)
        .eq("status", "done");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Completed tasks cleared");
      setClearTasksConfirm(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to clear tasks";
      toast.error("Failed", { description: message });
    }
  };

  const handleClearStaleLocations = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("user_id", userId)
        .lt("updated_at", thirtyDaysAgo);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Stale locations cleared");
      setClearLocationsConfirm(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to clear locations";
      toast.error("Failed", { description: message });
    }
  };
  const handleDeleteAccount = async () => {
    try {
      // The server route owns the complete deletion flow with a service-role
      // client and reports partial purges. Deleting in the browser first made
      // this irreversible operation split across two unreliable authorities.
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: userAccountEmail }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to delete auth account");
      }
      // Sign out after successful deletion
      localStorage.removeItem("presense_theme");
      localStorage.removeItem("presense_color_mode");
      localStorage.removeItem("presense_reduce_motion");
      await supabase.auth.signOut();
      toast.success("Account deleted");
      onClose(false);
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete account";
      toast.error("Failed", { description: message });
    }
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const capacity = settings.daily_capacity_minutes || 240;
  const capacityPct = ((capacity - 60) / (720 - 60)) * 100;
  const capacityLabel = `${Math.floor(capacity / 60)}h${capacity % 60 ? ` ${capacity % 60}m` : ""}`;
  // Postgres `time` columns come back as "HH:MM:SS"; the options are "HH:MM".
  const toHHMM = (t: string | undefined, fallback: string) =>
    (t || fallback).slice(0, 5);

  return (
    <ModalErrorBoundary
      modalName="Settings Modal"
      onClose={() => onClose(false)}
    >
      <AnimatePresence>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-0 md:p-6"
          onClick={() => onClose(false)}
        >
          <m.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.98,
              y: 6,
              transition: { duration: 0.14 },
            }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="modal relative flex h-[100dvh] min-h-0 w-full max-w-[880px] flex-col overflow-hidden md:h-[min(760px,88vh)] md:flex-row md:rounded-[var(--radius-xl)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            {/* Navigation: a quiet rail on desktop, a scrolling strip on phones */}
            <aside className="settings-nav relative shrink-0 md:flex md:w-60 md:flex-col">
              <h2 className="font-heading hidden px-3 pt-6 pb-5 text-[length:var(--text-title-xl)] font-medium text-[var(--text-1)] md:block">
                Settings
              </h2>
              <nav
                aria-label="Settings sections"
                className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 md:flex-col md:overflow-visible md:pt-0 md:pb-0"
              >
                {TABS.map((tab) => {
                  const current = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSettingsActiveTab(tab.id)}
                      aria-current={current ? "page" : undefined}
                      className="settings-tab"
                    >
                      <tab.icon
                        aria-hidden="true"
                        className="size-[18px] shrink-0"
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              <div className="hidden md:mt-auto md:block md:p-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="settings-tab text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]"
                >
                  <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
                  Sign out
                </button>
              </div>
            </aside>

            {/* Content */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <header className="settings-header">
                <div className="min-w-0">
                  <h3 className="font-heading text-[length:var(--text-title-2xl)] leading-tight font-medium text-[var(--text-1)]">
                    {activeTabMeta.label}
                  </h3>
                  <p className="mt-1 text-[length:var(--text-body)] text-[var(--text-3)]">
                    {activeTabMeta.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* The one save indicator. Autosave is silent until it
                      has something to say, then says it briefly. */}
                  <div aria-live="polite" className="min-w-[4.5rem] text-right">
                    <AnimatePresence mode="wait" initial={false}>
                      {saveStatus !== "idle" && (
                        <m.span
                          key={saveStatus}
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="inline-flex items-center gap-1.5 text-[length:var(--text-ui)] text-[var(--text-3)]"
                        >
                          {saveStatus === "saving" ? (
                            <Loader2
                              aria-hidden="true"
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-3.5 text-[var(--status-done)]"
                            />
                          )}
                          {saveStatus === "saving" ? "Saving" : "Saved"}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClose(false)}
                    aria-label="Close settings"
                    className="flex size-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                  >
                    <X aria-hidden="true" className="size-[18px]" />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2
                      aria-hidden="true"
                      className="size-6 animate-spin text-[var(--text-3)]"
                    />
                  </div>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <m.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-7 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+32px)] md:px-8"
                    >
                      {activeTab === "account" && (
                        <>
                          <SettingsGroup>
                            <SettingRow
                              label="Email"
                              description={userEmail || "—"}
                            >
                              <span className="text-[length:var(--text-ui)] text-[var(--text-3)]">
                                Signed in
                              </span>
                            </SettingRow>
                            <SettingRow
                              label="Display name"
                              description="How Presense greets you."
                              stack
                            >
                              <input
                                type="text"
                                {...register("display_name")}
                                placeholder="Your name"
                                aria-label="Display name"
                                className="input"
                              />
                            </SettingRow>
                            <SettingRow label="Avatar colour" stack>
                              <div className="flex flex-wrap gap-1">
                                {AVATAR_COLORS.map((color) => {
                                  const selected =
                                    settings.avatar_color?.toLowerCase() ===
                                    color.toLowerCase();
                                  return (
                                    <button
                                      type="button"
                                      key={color}
                                      aria-label={`Avatar colour ${color}`}
                                      aria-pressed={selected}
                                      onClick={() =>
                                        updateSetting("avatar_color", color)
                                      }
                                      className="swatch"
                                    >
                                      <span
                                        aria-hidden="true"
                                        style={{ backgroundColor: color }}
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            </SettingRow>
                            <SettingRow
                              label="Timezone"
                              description="Used for due dates and your daily rhythm."
                              stack
                            >
                              <Dropdown
                                trackAnimatedAncestor
                                aria-label="Timezone"
                                value={settings.timezone || "UTC"}
                                onChange={(val) =>
                                  updateSetting("timezone", val)
                                }
                                options={TIMEZONE_OPTIONS}
                              />
                            </SettingRow>
                          </SettingsGroup>

                          <SettingsGroup title="Danger zone" tone="danger">
                            <SettingRow
                              label="Delete account"
                              description="Permanently delete your account and everything in it."
                            >
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setDeleteAccountConfirm(true)}
                              >
                                Delete
                              </Button>
                            </SettingRow>
                          </SettingsGroup>

                          <div className="md:hidden">
                            <SettingsGroup>
                              <SettingRow
                                label="Sign out"
                                description="You can sign back in any time."
                              >
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleSignOut}
                                >
                                  <LogOut
                                    aria-hidden="true"
                                    className="size-4"
                                  />{" "}
                                  Sign out
                                </Button>
                              </SettingRow>
                            </SettingsGroup>
                          </div>
                        </>
                      )}

                      {activeTab === "appearance" && (
                        <SettingsGroup>
                          <SettingRow
                            label="Theme"
                            description="Sunrise, sunset, or follow your device."
                            stack
                          >
                            <SegmentedControl
                              label="Theme"
                              className="settings-segmented"
                              value={(settings.color_mode as string) || "dark"}
                              onChange={(val) =>
                                updateSetting("color_mode", val)
                              }
                              options={[
                                { label: "Light", value: "light" },
                                { label: "Dark", value: "dark" },
                                { label: "System", value: "system" },
                              ]}
                            />
                          </SettingRow>
                          <SettingRow
                            label="Density"
                            description="Row height and spacing in lists."
                            stack
                          >
                            {/* BUG-46 — `density` has NO column in `user_settings`
                                (verified live); it stays session-local. */}
                            <SegmentedControl
                              label="Density"
                              className="settings-segmented"
                              value={localDensity}
                              onChange={(val) => setLocalDensity(val)}
                              options={[
                                { label: "Comfortable", value: "comfortable" },
                                { label: "Compact", value: "compact" },
                              ]}
                            />
                          </SettingRow>
                          <SettingRow
                            label="Reduce motion"
                            description="Calm, near-instant transitions everywhere."
                          >
                            <Switch
                              label="Reduce motion"
                              checked={Boolean(settings.reduce_motion)}
                              onChange={(v) =>
                                updateSetting("reduce_motion", v)
                              }
                            />
                          </SettingRow>
                        </SettingsGroup>
                      )}

                      {activeTab === "ritual" && (
                        <SettingsGroup>
                          <SettingRow
                            label="Morning planning"
                            description="When to nudge you to plan the day."
                          >
                            <div className="w-36">
                              <Dropdown
                                trackAnimatedAncestor
                                aria-label="Morning planning time"
                                value={toHHMM(settings.nudge_time, "10:00")}
                                onChange={(val) =>
                                  updateSetting("nudge_time", val)
                                }
                                options={TIME_OPTIONS}
                              />
                            </div>
                          </SettingRow>
                          <SettingRow
                            label="Evening shutdown"
                            description="When you usually finish work."
                          >
                            <div className="w-36">
                              <Dropdown
                                trackAnimatedAncestor
                                aria-label="Evening shutdown time"
                                value={toHHMM(settings.shutdown_time, "17:00")}
                                onChange={(val) =>
                                  updateSetting("shutdown_time", val)
                                }
                                options={TIME_OPTIONS}
                              />
                            </div>
                          </SettingRow>
                          <SettingRow
                            label="Daily capacity"
                            description="How much focused work fits in a day. Used when planning."
                            stack
                          >
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min={60}
                                max={720}
                                step={30}
                                value={capacity}
                                aria-label="Daily capacity"
                                aria-valuetext={capacityLabel}
                                onChange={(e) =>
                                  updateSetting(
                                    "daily_capacity_minutes",
                                    parseInt(e.target.value),
                                  )
                                }
                                className="range flex-1"
                                style={
                                  {
                                    "--pct": `${capacityPct}%`,
                                  } as React.CSSProperties
                                }
                              />
                              <span className="font-heading w-16 text-right text-[length:var(--text-title-md)] text-[var(--text-1)] tabular-nums">
                                {capacityLabel}
                              </span>
                            </div>
                          </SettingRow>
                        </SettingsGroup>
                      )}

                      {activeTab === "notifications" && (
                        <>
                          <SettingsGroup title="Delivery">
                            <SettingRow
                              label="Notifications"
                              description="Allow Presense to notify you at all."
                            >
                              <Switch
                                label="Enable notifications"
                                checked={Boolean(
                                  settings.notifications_enabled,
                                )}
                                onChange={(v) =>
                                  updateSetting("notifications_enabled", v)
                                }
                              />
                            </SettingRow>
                            <SettingRow
                              label="Focus finish sound"
                              description="A soft chime when a session ends."
                            >
                              <Switch
                                label="Focus finish sound"
                                checked={Boolean(settings.pomodoro_sound)}
                                onChange={(v) =>
                                  updateSetting("pomodoro_sound", v)
                                }
                              />
                            </SettingRow>
                          </SettingsGroup>
                          <SettingsGroup title="Tell me about">
                            <SettingRow
                              label="Daily briefing"
                              description="A summary of today's tasks each morning."
                            >
                              <Switch
                                label="Daily briefing"
                                checked={Boolean(settings.daily_briefing)}
                                onChange={(v) =>
                                  updateSetting("daily_briefing", v)
                                }
                              />
                            </SettingRow>
                            <SettingRow
                              label="Deadlines"
                              description="A heads-up as a due date approaches."
                            >
                              <Switch
                                label="Deadline reminders"
                                checked={Boolean(settings.notif_overdue)}
                                onChange={(v) =>
                                  updateSetting("notif_overdue", v)
                                }
                              />
                            </SettingRow>
                            <SettingRow
                              label="Stale locations"
                              description="Places you haven't confirmed in 90 days."
                            >
                              <Switch
                                label="Stale location alerts"
                                checked={Boolean(settings.notif_stale_threads)}
                                onChange={(v) =>
                                  updateSetting("notif_stale_threads", v)
                                }
                              />
                            </SettingRow>
                          </SettingsGroup>
                        </>
                      )}

                      {activeTab === "focus" && (
                        <>
                          <SettingsGroup title="Durations">
                            <SettingRow label="Focus" stack>
                              <SegmentedControl
                                label="Focus duration"
                                className="settings-segmented"
                                value={String(settings.pomodoro_duration ?? 25)}
                                onChange={(v) =>
                                  updateSetting("pomodoro_duration", Number(v))
                                }
                                options={[15, 20, 25, 30, 45, 60].map((n) => ({
                                  label: `${n}m`,
                                  value: String(n),
                                }))}
                              />
                            </SettingRow>
                            <SettingRow label="Short break" stack>
                              <SegmentedControl
                                label="Short break duration"
                                className="settings-segmented"
                                value={String(
                                  settings.short_break_duration ?? 5,
                                )}
                                onChange={(v) =>
                                  updateSetting(
                                    "short_break_duration",
                                    Number(v),
                                  )
                                }
                                options={[3, 5, 10, 15].map((n) => ({
                                  label: `${n}m`,
                                  value: String(n),
                                }))}
                              />
                            </SettingRow>
                            <SettingRow label="Long break" stack>
                              <SegmentedControl
                                label="Long break duration"
                                className="settings-segmented"
                                value={String(
                                  settings.long_break_duration ?? 15,
                                )}
                                onChange={(v) =>
                                  updateSetting(
                                    "long_break_duration",
                                    Number(v),
                                  )
                                }
                                options={[15, 20, 30].map((n) => ({
                                  label: `${n}m`,
                                  value: String(n),
                                }))}
                              />
                            </SettingRow>
                          </SettingsGroup>
                          <SettingsGroup title="Rhythm">
                            <SettingRow
                              label="Long break every"
                              description="Focus sessions before a longer rest."
                              stack
                            >
                              <SegmentedControl
                                label="Sessions before a long break"
                                className="settings-segmented"
                                value={String(
                                  settings.pomodoro_long_break_interval || 4,
                                )}
                                onChange={(v) =>
                                  updateSetting(
                                    "pomodoro_long_break_interval",
                                    Number(v),
                                  )
                                }
                                options={[2, 3, 4, 5].map((n) => ({
                                  label: `${n} sessions`,
                                  value: String(n),
                                }))}
                              />
                            </SettingRow>
                            <SettingRow
                              label="Start breaks automatically"
                              description="Roll straight into your break when focus ends."
                            >
                              <Switch
                                label="Start breaks automatically"
                                checked={Boolean(settings.auto_start_breaks)}
                                onChange={(v) =>
                                  updateSetting("auto_start_breaks", v)
                                }
                              />
                            </SettingRow>
                          </SettingsGroup>
                        </>
                      )}

                      {activeTab === "tasks" && (
                        <>
                          <CategoryManager
                            title="Categories"
                            categoriesKey="do_categories"
                            colorsKey="do_category_colors"
                            defaultCategories={[
                              "work",
                              "study",
                              "personal",
                              "errand",
                              "health",
                            ]}
                            settings={settings as SettingsState}
                            updateSetting={updateSetting}
                            setSettings={setSettings}
                            supabase={supabase}
                          />
                          <SettingsGroup title="Housekeeping">
                            <SettingRow
                              label="Archive finished tasks"
                              description="Move done tasks out of the way."
                            >
                              <div className="w-40">
                                <Dropdown
                                  trackAnimatedAncestor
                                  aria-label="Archive finished tasks"
                                  value={String(
                                    settings.auto_archive_days ?? 7,
                                  )}
                                  onChange={(val) =>
                                    updateSetting(
                                      "auto_archive_days",
                                      Number(val),
                                    )
                                  }
                                  options={[
                                    { value: "0", label: "Immediately" },
                                    { value: "1", label: "After a day" },
                                    { value: "3", label: "After 3 days" },
                                    { value: "7", label: "After a week" },
                                    { value: "-1", label: "Never" },
                                  ]}
                                />
                              </div>
                            </SettingRow>
                            <SettingRow
                              label="Understand dates"
                              description={
                                'Pick up "tomorrow 3pm" from what you type.'
                              }
                            >
                              <Switch
                                label="Understand dates in task text"
                                checked={settings.nlp_date_parsing !== false}
                                onChange={(v) =>
                                  updateSetting("nlp_date_parsing", v)
                                }
                              />
                            </SettingRow>
                          </SettingsGroup>
                        </>
                      )}

                      {activeTab === "routing" && (
                        <SettingsGroup>
                          <SettingRow
                            label="Smart routing"
                            description="Send each capture to Do, Think or Remember based on what you wrote."
                          >
                            <Switch
                              label="Smart routing"
                              checked={Boolean(settings.smart_routing_enabled)}
                              onChange={(v) =>
                                updateSetting("smart_routing_enabled", v)
                              }
                            />
                          </SettingRow>
                        </SettingsGroup>
                      )}

                      {activeTab === "data" && (
                        <>
                          <SettingsGroup title="Your data">
                            <SettingRow
                              label="Export everything"
                              description="A JSON file of all your tasks, threads and places."
                            >
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleExportData}
                              >
                                <Download
                                  aria-hidden="true"
                                  className="size-4"
                                />{" "}
                                Export
                              </Button>
                            </SettingRow>
                          </SettingsGroup>
                          <SettingsGroup title="Clean up" tone="danger">
                            <SettingRow
                              label="Clear finished tasks"
                              description="Permanently remove every completed task."
                            >
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setClearTasksConfirm(true)}
                              >
                                Clear
                              </Button>
                            </SettingRow>
                            <SettingRow
                              label="Clear stale places"
                              description="Remove places not updated in 30 days."
                            >
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setClearLocationsConfirm(true)}
                              >
                                Clear
                              </Button>
                            </SettingRow>
                          </SettingsGroup>
                        </>
                      )}
                    </m.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            <ConfirmModal
              isOpen={deleteAccountConfirm}
              onClose={() => setDeleteAccountConfirm(false)}
              onConfirm={handleDeleteAccount}
              title="Delete account"
              description="This will permanently delete all your data. This cannot be undone."
              confirmLabel="Delete account"
              inputRequired="DELETE"
              confirmDestructive
            />
            <ConfirmModal
              isOpen={clearTasksConfirm}
              onClose={() => setClearTasksConfirm(false)}
              onConfirm={handleClearCompleted}
              title="Clear finished tasks"
              description="Remove all completed tasks permanently?"
              confirmLabel="Clear tasks"
              confirmDestructive
            />
            <ConfirmModal
              isOpen={clearLocationsConfirm}
              onClose={() => setClearLocationsConfirm(false)}
              onConfirm={handleClearStaleLocations}
              title="Clear stale places"
              description="Remove places not updated in 30+ days?"
              confirmLabel="Clear places"
              confirmDestructive
            />
          </m.div>
        </m.div>
      </AnimatePresence>
    </ModalErrorBoundary>
  );
}
