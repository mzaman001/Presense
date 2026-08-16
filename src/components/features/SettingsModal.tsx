"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient, safeMutate } from "@/lib/supabase";
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
  Users,
  Plus,
  Trash2,
  Sparkles,
  Moon,
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
import { useForm } from "react-hook-form";
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
import { Icon as UiIcon } from "@/components/ui/Icon";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ritual", label: "Daily Ritual", icon: Sparkles },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "people", label: "People", icon: Users },
  { id: "routing", label: "Smart Routing", icon: Brain },
  { id: "data", label: "Data", icon: Database },
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
  ambient_bg?: boolean;
  reduce_motion?: boolean;
  notifications_enabled?: boolean;
  quiet_start?: string;
  quiet_end?: string;
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
  people_categories?: string[];
  relationship_colors?: Record<string, string>;
  auto_snooze?: boolean;
  smart_routing_enabled?: boolean;
  nlp_date_parsing?: boolean;
  routing_confidence?: string;
  ollama_enabled?: boolean;
  ollama_url?: string;
  location_detection?: boolean;
  daily_briefing_time?: string;
  nudge_time?: string;
  shutdown_time?: string;
  pomodoro_long_break_interval?: number;
  daily_capacity_minutes?: number;
  density?: "comfortable" | "compact";
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

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[rgba(255,255,255,0.2)]">
      <input
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onBlur={handleRename}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="min-w-[80px] flex-1 rounded bg-transparent px-2 py-1 text-sm font-bold tracking-wide text-[var(--color-text-1)] capitalize focus:bg-white/5 focus:outline-none"
      />
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {[
          "#F87171",
          "#FBBF24",
          "#4ADE80",
          "#2DD4BF",
          "#7692FF",
          "#8B7CF8",
          "#F472B6",
          "#9CA3AF",
        ].map((preset) => {
          const isActive =
            initialColor === preset || (!initialColor && preset === "#9CA3AF");
          return (
            <button
              key={preset}
              onClick={() => handleColorChange(cat, preset)}
              className="h-5 w-5 rounded-full transition-all hover:scale-125"
              style={{
                backgroundColor: preset,
                border: isActive
                  ? `2px solid white`
                  : `1px solid rgba(255,255,255,0.1)`,
                transform: isActive ? "scale(1.2)" : "scale(1)",
                opacity: isActive ? 1 : 0.5,
              }}
            />
          );
        })}
        <div className="mx-1 h-4 w-[1px] bg-[var(--color-border)]" />
        <label
          className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow-sm transition-transform hover:scale-125"
          style={{
            background:
              "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
          }}
        >
          <input
            type="color"
            value={initialColor || "#9CA3AF"}
            onChange={(e) => handleColorChange(cat, e.target.value)}
            className="absolute h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <button
          onClick={() => handleDelete(cat)}
          className="ml-1 rounded-lg p-1.5 text-[var(--color-text-3)] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-400"
        >
          <UiIcon className="h-4 w-4" icon={Trash2} />
        </button>
      </div>
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
  };

  return (
    <div className="space-y-3">
      <label className="text-label block text-[var(--text-3)]">{title}</label>
      <div className="space-y-2">
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
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add new category..."
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text-1)] transition-colors focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            onClick={handleAdd}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-text-1)] transition-colors hover:border-[var(--color-accent)]"
          >
            <UiIcon className="h-5 w-5" icon={Plus} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    setUserSettings,
    settingsActiveTab,
    setSettingsActiveTab,
  } = useAppStore(
    useShallow((s) => ({
      isSettingsModalOpen: s.isSettingsModalOpen,
      setSettingsModalOpen: s.setSettingsModalOpen,
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

  const { register, watch, setValue, reset, getValues } =
    useForm<SettingsFormValues>({
      resolver: zodResolver(settingsSchema),
      defaultValues: {},
    });

  const settings = watch();

  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [clearTasksConfirm, setClearTasksConfirm] = useState(false);
  const [clearLocationsConfirm, setClearLocationsConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [debouncedSettings] = useDebounce(settings, 1000);
  const lastSavedSettingsRef = useRef<string | null>(null);
  const dialogRef = useDialogFocus(isSettingsModalOpen);
  useBodyScrollLock(isSettingsModalOpen);

  useEffect(() => {
    if (!isSettingsModalOpen) return;

    async function loadSettings() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");

      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reset(data as any);
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUserSettings(data as any);
      }
      setLoading(false);
      setTimeout(() => setInitialLoaded(true), 100);
    }
    loadSettings();
  }, [isSettingsModalOpen, supabase, setUserSettings, reset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsModalOpen) {
        setSettingsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsModalOpen, setSettingsModalOpen]);

  useEffect(() => {
    if (!initialLoaded) return;

    const currentSettingsStr = JSON.stringify(debouncedSettings);
    if (lastSavedSettingsRef.current === null) {
      lastSavedSettingsRef.current = currentSettingsStr;
      return;
    }
    if (lastSavedSettingsRef.current === currentSettingsStr) return;

    const save = async () => {
      setSaveStatus("saving");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const {
        user_id: _,
        created_at: __,
        ...updateData
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } = debouncedSettings as any;

      const { error } = await supabase
        .from("user_settings")
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updateData as any)
        .eq("user_id", user.id);

      if (error) {
        toast.error("Failed to save settings", { description: error.message });
        setSaveStatus("idle");
      } else {
        lastSavedSettingsRef.current = currentSettingsStr;
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUserSettings(debouncedSettings as any);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    };
    save();
  }, [debouncedSettings, supabase, initialLoaded, setUserSettings]);

  useEffect(() => {
    if (!initialLoaded) return;
    localStorage.setItem("presense_theme", normalizeThemeId(settings.theme));
    localStorage.setItem(
      "presense_color_mode",
      normalizeColorMode(settings.color_mode),
    );
    localStorage.setItem(
      "presense_reduce_motion",
      String(Boolean(settings.reduce_motion)),
    );
    applyDocumentTheme(
      settings.theme,
      settings.color_mode,
      Boolean(settings.reduce_motion),
    );
  }, [
    settings.theme,
    settings.color_mode,
    settings.reduce_motion,
    initialLoaded,
  ]);

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
    setSettingsModalOpen(false);
    router.push("/login");
  };

  const handleExportData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      toast.info("Preparing export...");

      const [items, people, threads, explores, locations, settings] =
        await Promise.all([
          supabase.from("items").select("*").eq("user_id", user.id),
          supabase.from("people").select("*").eq("user_id", user.id),
          supabase.from("threads").select("*").eq("user_id", user.id),
          supabase.from("explores").select("*").eq("user_id", user.id),
          supabase.from("locations").select("*").eq("user_id", user.id),
          supabase
            .from("user_settings")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        items: items.data ?? [],
        people: people.data ?? [],
        threads: threads.data ?? [],
        explores: explores.data ?? [],
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        // INFRA-19: clear-completed = trash with deleted_at, per lifecycle
        // vocabulary; the stale completed_at is cleared too so a later
        // restore doesn't rank as done in the archive view.
        .from("items")
        .update({ ...moveItemToTrashPatch(), completed_at: null })
        .eq("user_id", user.id)
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("user_id", user.id)
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // Delete all user data across tables
      const deletions = await Promise.all([
        safeMutate(
          () => supabase.from("items").delete().eq("user_id", user.id),
          "Failed to clear tasks",
        ),
        safeMutate(
          () => supabase.from("people").delete().eq("user_id", user.id),
          "Failed to clear people",
        ),
        safeMutate(
          () => supabase.from("threads").delete().eq("user_id", user.id),
          "Failed to clear threads",
        ),
        safeMutate(
          () => supabase.from("explores").delete().eq("user_id", user.id),
          "Failed to clear explores",
        ),
        safeMutate(
          () => supabase.from("locations").delete().eq("user_id", user.id),
          "Failed to clear locations",
        ),
        safeMutate(
          () => supabase.from("session_logs").delete().eq("user_id", user.id),
          "Failed to clear session logs",
        ),
        safeMutate(
          () =>
            supabase.from("push_subscriptions").delete().eq("user_id", user.id),
          "Failed to clear subscriptions",
        ),
        safeMutate(
          () => supabase.from("user_settings").delete().eq("user_id", user.id),
          "Failed to clear settings",
        ),
        safeMutate(
          () => supabase.from("categories").delete().eq("user_id", user.id),
          "Failed to clear categories",
        ),
        safeMutate(
          () => supabase.from("ritual_logs").delete().eq("user_id", user.id),
          "Failed to clear ritual logs",
        ),
      ]);
      if (!deletions.every((r) => r.success)) {
        throw new Error("One or more tables could not be cleared");
      }
      // Delete the auth user via server-side API
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: user.email ?? "" }),
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
      setSettingsModalOpen(false);
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete account";
      toast.error("Failed", { description: message });
    }
  };

  return (
    <ModalErrorBoundary
      modalName="Settings Modal"
      onClose={() => setSettingsModalOpen(false)}
    >
      <AnimatePresence>
        {isSettingsModalOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4"
            onClick={() => setSettingsModalOpen(false)}
          >
            <m.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="modal relative flex h-[100dvh] min-h-0 w-full max-w-4xl flex-col overflow-hidden md:h-[80vh] md:flex-row md:rounded-2xl"
              style={{
                backdropFilter: "blur(48px)",
                WebkitBackdropFilter: "blur(48px)",
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
            >
              <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
                {/* Sidebar Tabs */}
                <div className="flex w-full shrink-0 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 pb-0 md:w-64 md:flex-col md:overflow-x-visible md:border-r md:border-b-0 md:pb-4">
                  <h2 className="mb-8 hidden px-2 text-xl font-bold text-[var(--color-text-1)] md:block">
                    Settings
                  </h2>
                  <nav className="flex w-full gap-1 pb-2 md:flex-col md:pb-0">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSettingsActiveTab(tab.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          activeTab === tab.id
                            ? "bg-[var(--color-surface)] text-[var(--color-text-1)]"
                            : "text-[var(--color-text-3)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
                        }`}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    ))}
                  </nav>

                  <div className="mt-auto border-t border-[var(--color-border)] pt-4">
                    <div className="mb-2 flex h-6 items-center gap-2 px-2 text-xs font-medium">
                      <AnimatePresence mode="wait">
                        {saveStatus === "saving" && (
                          <m.div
                            key="saving"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-[var(--color-text-3)]"
                          >
                            <UiIcon
                              className="h-3.5 w-3.5 animate-spin"
                              icon={Loader2}
                            />{" "}
                            Saving...
                          </m.div>
                        )}
                        {saveStatus === "saved" && (
                          <m.div
                            key="saved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-[var(--color-think)]"
                          >
                            <UiIcon
                              className="h-3.5 w-3.5"
                              icon={CheckCircle2}
                            />{" "}
                            Saved
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--status-danger)] transition-colors hover:bg-[var(--status-danger-dim)]"
                    >
                      <UiIcon className="h-4 w-4" icon={LogOut} /> Sign Out
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div
                  className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
                  data-lenis-prevent
                >
                  <Button
                    variant="icon"
                    onClick={() => setSettingsModalOpen(false)}
                    aria-label="Close settings"
                    className="absolute top-4 right-4 z-10"
                  >
                    <UiIcon
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0"
                      icon={X}
                    />
                  </Button>

                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <UiIcon
                        className="h-6 w-6 animate-spin text-[var(--color-text-3)]"
                        icon={Loader2}
                      />
                    </div>
                  ) : (
                    <div className="max-w-2xl p-10">
                      <h3 className="mb-8 border-b border-[var(--color-border)] pb-4 text-2xl font-bold text-[var(--color-text-1)]">
                        {TABS.find((t) => t.id === activeTab)?.label}
                      </h3>

                      {activeTab === "account" && (
                        <div className="space-y-6">
                          <div>
                            <label className="text-label mb-2 block text-[var(--text-3)]">
                              Email
                            </label>
                            <input
                              value={userEmail}
                              readOnly
                              className="input cursor-not-allowed opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-label text-[var(--text-3)]">
                              Display Name
                            </label>
                            <input
                              type="text"
                              {...register("display_name")}
                              placeholder="How should we call you?"
                              className="input w-full"
                            />
                          </div>
                          <div>
                            <label className="text-label mb-3 block text-[var(--text-3)]">
                              Avatar Color
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                "#F472B6",
                                "#4ADE80",
                                "#3B82F6",
                                "#FBBF24",
                                "#A855F7",
                                "#EF4444",
                              ].map((color) => (
                                <Button
                                  variant="danger"
                                  key={color}
                                  onClick={() =>
                                    updateSetting("avatar_color", color)
                                  }
                                  className={`h-8 w-8 rounded-full transition-transform ${settings.avatar_color === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[rgba(11,9,20,1)]" : "opacity-70 hover:opacity-100"}`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-label mb-2 block text-[var(--text-3)]">
                              Timezone
                            </label>
                            <Dropdown
                              variant="select"
                              value={settings.timezone || "UTC"}
                              onChange={(val) => updateSetting("timezone", val)}
                              options={
                                typeof Intl !== "undefined" &&
                                "supportedValuesOf" in Intl
                                  ? /* @todo: Untyped usage justified per TOOL-01 */
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (Intl as any)
                                      .supportedValuesOf("timeZone")
                                      .map((tz: string) => ({
                                        value: tz,
                                        label: tz.replace(/_/g, " "),
                                      }))
                                  : [
                                      { value: "UTC", label: "UTC" },
                                      {
                                        value: "America/New_York",
                                        label: "Eastern Time (ET)",
                                      },
                                      {
                                        value: "America/Chicago",
                                        label: "Central Time (CT)",
                                      },
                                      {
                                        value: "America/Denver",
                                        label: "Mountain Time (MT)",
                                      },
                                      {
                                        value: "America/Los_Angeles",
                                        label: "Pacific Time (PT)",
                                      },
                                      {
                                        value: "Asia/Kolkata",
                                        label: "India Standard Time (IST)",
                                      },
                                      {
                                        value: "Europe/London",
                                        label: "Greenwich Mean Time (GMT)",
                                      },
                                    ]
                              }
                            />
                          </div>
                          <div className="mt-8 border-t border-[var(--status-danger-border)] pt-8">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--status-danger)]">
                              Danger Zone
                            </h4>
                            <p className="mb-4 text-xs text-[var(--color-text-3)]">
                              Permanently delete your account and all data.
                            </p>
                            <Button
                              variant="danger"
                              onClick={() => setDeleteAccountConfirm(true)}
                              className="mt-4 w-full"
                            >
                              Delete Account
                            </Button>
                          </div>
                        </div>
                      )}

                      {activeTab === "appearance" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Theme Accent
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Select your primary colour palette
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateSetting("theme", "warm")}
                                className={`h-8 w-8 rounded-full border-2 bg-[#E5B41E] transition-all ${normalizeThemeId(settings.theme) === "warm" ? "scale-110 border-[var(--color-text-1)]" : "border-transparent opacity-50 hover:opacity-100"}`}
                                title="Warm"
                              />
                              <button
                                onClick={() => updateSetting("theme", "navy")}
                                className={`h-8 w-8 rounded-full border-2 bg-[#7692FF] transition-all ${normalizeThemeId(settings.theme) === "navy" ? "scale-110 border-[var(--color-text-1)]" : "border-transparent opacity-50 hover:opacity-100"}`}
                                title="Navy"
                              />
                              <button
                                onClick={() => updateSetting("theme", "forest")}
                                className={`h-8 w-8 rounded-full border-2 bg-[#EFDD8D] transition-all ${normalizeThemeId(settings.theme) === "forest" ? "scale-110 border-[var(--color-text-1)]" : "border-transparent opacity-50 hover:opacity-100"}`}
                                title="Forest"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Color Mode
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Dark, Light, or System match
                              </div>
                            </div>
                            <div className="w-40">
                              <Dropdown
                                variant="select"
                                value={settings.color_mode || "dark"}
                                onChange={(val) =>
                                  updateSetting("color_mode", val)
                                }
                                className="w-full"
                                options={[
                                  { value: "dark", label: "Dark" },
                                  { value: "light", label: "Light" },
                                  { value: "system", label: "System Default" },
                                ]}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Density
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Adjust row height and spacing
                              </div>
                            </div>
                            <div className="w-40">
                              <Dropdown
                                variant="select"
                                value={settings.density || "compact"}
                                onChange={(val) =>
                                  updateSetting("density", val)
                                }
                                className="w-full"
                                options={[
                                  { value: "compact", label: "Compact" },
                                  {
                                    value: "comfortable",
                                    label: "Comfortable",
                                  },
                                ]}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Ambient Background
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Show moving gradients in the background
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "ambient_bg",
                                  !settings.ambient_bg,
                                )
                              }
                              className={`toggle-track ${settings.ambient_bg ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Reduce Motion
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Minimize UI animations
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "reduce_motion",
                                  !settings.reduce_motion,
                                )
                              }
                              className={`toggle-track ${settings.reduce_motion ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "notifications" && (
                        <div className="space-y-6">
                          <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Master Toggle
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Enable all notifications
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "notifications_enabled",
                                  !settings.notifications_enabled,
                                )
                              }
                              className={`toggle-track ${settings.notifications_enabled ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Daily Briefing
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Receive a summary of today&apos;s tasks
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "daily_briefing",
                                  !settings.daily_briefing,
                                )
                              }
                              className={`toggle-track ${settings.daily_briefing ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Pomodoro Finish Sound
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Play a sound when timer completes
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "pomodoro_sound",
                                  !settings.pomodoro_sound,
                                )
                              }
                              className={`toggle-track ${settings.pomodoro_sound ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Deadline Reminders
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Get notified as deadlines approach
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "notif_overdue",
                                  !settings.notif_overdue,
                                )
                              }
                              className={`toggle-track ${settings.notif_overdue ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Stale Location Alerts
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Remind to update locations older than 90 days
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "notif_stale_threads",
                                  !settings.notif_stale_threads,
                                )
                              }
                              className={`toggle-track ${settings.notif_stale_threads ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "focus" && (
                        <div className="space-y-6">
                          <div className="space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <div className="text-sm font-semibold text-[var(--color-text-1)]">
                              Timer Durations
                            </div>

                            <div>
                              <label className="text-label mb-2 block text-[var(--text-3)]">
                                Work Duration (mins)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {[15, 20, 25, 30, 45, 60].map((mins) => (
                                  <Button
                                    variant="preset"
                                    key={mins}
                                    onClick={() =>
                                      updateSetting("pomodoro_duration", mins)
                                    }
                                    className={cn(
                                      "",
                                      settings.pomodoro_duration === mins &&
                                        "active",
                                    )}
                                  >
                                    {mins}m
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-label mb-2 block text-[var(--text-3)]">
                                Short Break (mins)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {[3, 5, 10, 15].map((mins) => (
                                  <Button
                                    variant="preset"
                                    key={mins}
                                    onClick={() =>
                                      updateSetting(
                                        "short_break_duration",
                                        mins,
                                      )
                                    }
                                    className={cn(
                                      "",
                                      settings.short_break_duration === mins &&
                                        "active",
                                    )}
                                  >
                                    {mins}m
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-label mb-2 block text-[var(--text-3)]">
                                Long Break (mins)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {[15, 20, 30].map((mins) => (
                                  <Button
                                    variant="preset"
                                    key={mins}
                                    onClick={() =>
                                      updateSetting("long_break_duration", mins)
                                    }
                                    className={cn(
                                      "",
                                      settings.long_break_duration === mins &&
                                        "active",
                                    )}
                                  >
                                    {mins}m
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                              <div>
                                <div className="text-sm font-medium text-[var(--color-text-1)]">
                                  Auto-start Breaks
                                </div>
                                <div className="text-xs text-[var(--color-text-3)]">
                                  Automatically begin break timer when work
                                  finishes
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  updateSetting(
                                    "auto_start_breaks",
                                    !settings.auto_start_breaks,
                                  )
                                }
                                className={`toggle-track ${settings.auto_start_breaks ? "on" : ""}`}
                              >
                                <div className="toggle-thumb" />
                              </button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <label className="text-label mb-3 block text-[var(--text-3)]">
                              Long Break After (sessions)
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[2, 3, 4, 5].map((n) => (
                                <Button
                                  variant="preset"
                                  key={n}
                                  onClick={() =>
                                    updateSetting(
                                      "pomodoro_long_break_interval",
                                      n,
                                    )
                                  }
                                  className={cn(
                                    "",
                                    (settings.pomodoro_long_break_interval ||
                                      4) === n && "active",
                                  )}
                                >
                                  {n}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "ritual" && (
                        <div className="space-y-6">
                          <div className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-dim)]">
                                <UiIcon
                                  className="h-5 w-5 text-[var(--accent)]"
                                  icon={Sparkles}
                                />
                              </div>
                              <div>
                                <h4 className="font-semibold text-[var(--text-1)]">
                                  Daily Ritual
                                </h4>
                                <p className="text-xs text-[var(--text-muted)]">
                                  Configure your morning planning and evening
                                  review times.
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <label className="text-label mb-2 block flex items-center gap-1.5 text-[var(--text-3)]">
                                  <UiIcon
                                    className="h-3.5 w-3.5 text-orange-400"
                                    icon={Sparkles}
                                  />{" "}
                                  Morning Nudge
                                </label>
                                <Dropdown
                                  variant="select"
                                  value={settings.nudge_time || "10:00"}
                                  onChange={(val) =>
                                    updateSetting("nudge_time", val)
                                  }
                                  className="w-full"
                                  options={TIME_OPTIONS}
                                />
                                <p className="text-meta mt-2 text-[var(--text-muted)]">
                                  When should we remind you to plan your day?
                                </p>
                              </div>
                              <div>
                                <label className="text-label mb-2 block flex items-center gap-1.5 text-[var(--text-3)]">
                                  <UiIcon
                                    className="h-3.5 w-3.5 text-blue-400"
                                    icon={Moon}
                                  />{" "}
                                  Evening Shutdown
                                </label>
                                <Dropdown
                                  variant="select"
                                  value={settings.shutdown_time || "17:00"}
                                  onChange={(val) =>
                                    updateSetting("shutdown_time", val)
                                  }
                                  className="w-full"
                                  options={TIME_OPTIONS}
                                />
                                <p className="text-meta mt-2 text-[var(--text-muted)]">
                                  When do you usually finish work?
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="text-label mb-2 block text-[var(--text-3)]">
                                Daily Capacity (mins)
                              </label>
                              <div className="flex items-center gap-4">
                                <input
                                  type="range"
                                  min="60"
                                  max="720"
                                  step="30"
                                  value={settings.daily_capacity_minutes || 240}
                                  onChange={(e) =>
                                    updateSetting(
                                      "daily_capacity_minutes",
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="flex-1 accent-[var(--accent)]"
                                />
                                <span className="w-16 text-right font-medium text-[var(--text-1)]">
                                  {Math.floor(
                                    (settings.daily_capacity_minutes || 240) /
                                      60,
                                  )}
                                  h{" "}
                                  {(settings.daily_capacity_minutes || 240) %
                                    60}
                                  m
                                </span>
                              </div>
                              <p className="text-meta mt-2 text-[var(--text-muted)]">
                                Used for workload visualization during morning
                                planning.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "tasks" && (
                        <div className="space-y-8">
                          <div>
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--color-text-1)]">
                              <UiIcon
                                icon={CheckSquare}
                                size={20}
                                className="text-[var(--color-accent)]"
                              />
                              Task Management
                            </h3>
                            <div className="space-y-6">
                              <CategoryManager
                                title="Task Categories"
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

                              <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-[var(--color-text-1)]">
                                      Auto-Archive Completed
                                    </p>
                                    <p className="text-xs text-[var(--text-3)]">
                                      Move done tasks to archive automatically
                                    </p>
                                  </div>
                                  <Dropdown
                                    variant="select"
                                    value={String(
                                      settings.auto_archive_days ?? 7,
                                    )}
                                    onChange={(val) =>
                                      updateSetting(
                                        "auto_archive_days",
                                        Number(val),
                                      )
                                    }
                                    className="w-40"
                                    options={[
                                      { value: "0", label: "Immediately" },
                                      { value: "1", label: "After 1 day" },
                                      { value: "3", label: "After 3 days" },
                                      { value: "7", label: "After 1 week" },
                                      { value: "-1", label: "Never" },
                                    ]}
                                  />
                                </div>
                                <div className="h-[1px] bg-[var(--color-border)]" />
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-[var(--color-text-1)]">
                                      NLP Date Parsing
                                    </p>
                                    <p className="text-xs text-[var(--text-3)]">
                                      Extract dates from task text
                                    </p>
                                  </div>
                                  <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                      type="checkbox"
                                      className="peer sr-only"
                                      checked={
                                        settings.nlp_date_parsing !== false
                                      }
                                      onChange={(e) =>
                                        updateSetting(
                                          "nlp_date_parsing",
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-[var(--color-surface-hover)] peer-checked:bg-[var(--color-accent)] after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[var(--color-text-1)] after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "people" && (
                        <div className="space-y-8">
                          <div>
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--color-text-1)]">
                              <UiIcon
                                icon={Users}
                                size={20}
                                className="text-[var(--color-accent)]"
                              />
                              People & Relationships
                            </h3>
                            <div className="space-y-6">
                              <CategoryManager
                                title="Relationship Types"
                                categoriesKey="people_categories"
                                colorsKey="relationship_colors"
                                defaultCategories={[
                                  "family",
                                  "friend",
                                  "colleague",
                                  "client",
                                  "acquaintance",
                                ]}
                                settings={settings as SettingsState}
                                updateSetting={updateSetting}
                                setSettings={setSettings}
                                supabase={supabase}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "routing" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Smart NLP Routing
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Automatically route captures based on natural
                                language
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "smart_routing_enabled",
                                  !settings.smart_routing_enabled,
                                )
                              }
                              className={`toggle-track ${settings.smart_routing_enabled ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Enhanced routing via Ollama
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Use local LLM for advanced routing decisions
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "ollama_enabled",
                                  !settings.ollama_enabled,
                                )
                              }
                              className={`toggle-track ${settings.ollama_enabled ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          {settings.ollama_enabled && (
                            <m.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                            >
                              <label className="text-label mt-4 mb-2 block text-[var(--text-3)]">
                                Ollama URL
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  {...register("ollama_url")}
                                  placeholder="http://localhost:11434"
                                  className="input !w-[200px] bg-[var(--color-background)] !px-2 !py-1 !text-xs"
                                />
                                <button
                                  onClick={async () => {
                                    const url =
                                      settings.ollama_url ||
                                      "http://localhost:11434";
                                    try {
                                      const res = await fetch(
                                        `${url}/api/tags`,
                                      );
                                      if (res.ok) {
                                        const data = await res.json();
                                        const models = data.models || [];
                                        const modelName =
                                          models.length > 0
                                            ? models[0].name
                                            : "No models found";
                                        toast.success(
                                          `Connected — model: ${modelName}`,
                                        );
                                      } else {
                                        toast.error("Not reachable");
                                      }
                                    } catch {
                                      toast.error("Not reachable");
                                    }
                                  }}
                                  className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-dim)] px-4 py-3 text-sm font-semibold whitespace-nowrap text-[var(--accent)] transition-colors hover:bg-[var(--accent-dim-hover)]"
                                >
                                  Test connection
                                </button>
                              </div>
                            </m.div>
                          )}
                          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">
                                Location Context
                              </div>
                              <div className="text-sm text-[var(--color-text-3)]">
                                Use location to prompt relevant tasks
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateSetting(
                                  "location_detection",
                                  !settings.location_detection,
                                )
                              }
                              className={`toggle-track ${settings.location_detection ? "on" : ""}`}
                            >
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "data" && (
                        <div className="space-y-6">
                          <p className="text-sm text-[var(--color-text-3)]">
                            Manage your data and account. All data stays synced
                            across devices.
                          </p>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handleExportData}
                            className="w-full"
                          >
                            <UiIcon
                              size={14}
                              strokeWidth={1.5}
                              className="shrink-0"
                              icon={Download}
                            />{" "}
                            Export All Data
                          </Button>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <Button
                              variant="danger"
                              type="button"
                              onClick={() => setClearTasksConfirm(true)}
                              className="w-full"
                            >
                              Clear Completed Tasks
                            </Button>
                            <Button
                              variant="danger"
                              type="button"
                              onClick={() => setClearLocationsConfirm(true)}
                              className="w-full"
                            >
                              Clear Stale Locations
                            </Button>
                          </div>
                        </div>
                      )}

                      <ConfirmModal
                        isOpen={deleteAccountConfirm}
                        onClose={() => setDeleteAccountConfirm(false)}
                        onConfirm={handleDeleteAccount}
                        title="Delete Account"
                        description="This will permanently delete all your data. This cannot be undone."
                        confirmLabel="Delete Account"
                        inputRequired="DELETE"
                        confirmDestructive
                      />
                      <ConfirmModal
                        isOpen={clearTasksConfirm}
                        onClose={() => setClearTasksConfirm(false)}
                        onConfirm={handleClearCompleted}
                        title="Clear Completed Tasks"
                        description="Remove all completed tasks permanently?"
                        confirmLabel="Clear Tasks"
                        confirmDestructive
                      />
                      <ConfirmModal
                        isOpen={clearLocationsConfirm}
                        onClose={() => setClearLocationsConfirm(false)}
                        onConfirm={handleClearStaleLocations}
                        title="Clear Stale Locations"
                        description="Remove locations not updated in 30+ days?"
                        confirmLabel="Clear Locations"
                        confirmDestructive
                      />
                    </div>
                  )}
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </ModalErrorBoundary>
  );
}
