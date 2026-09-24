import { create } from "zustand";
import type { TaskRecord } from "@/lib/task-cache";
import { markMutation as markProviderMutation } from "@/components/providers/RealtimeProvider";

export interface UserSettings {
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
  pomodoro_long_break_interval?: number;
  last_ritual_date?: string;
  last_evening_ritual_date?: string;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
  density?: "comfortable" | "compact";
  [key: string]: unknown;
}

/** The focus session that is open, if any (see lib/focus-timer.ts). */
export interface ActiveTimer {
  taskId?: string;
  taskTitle?: string;
  /** The task's "smallest action to start", shown in the timer. */
  firstStep?: string | null;
  /** Length to preselect, in minutes (e.g. 2 for "ugly first version"). */
  minutes?: number;
}

interface AppState {
  isCaptureModalOpen: boolean;
  setCaptureModalOpen: (open: boolean) => void;
  captureModalPrefill: string | null;
  setCaptureModalPrefill: (text: string | null) => void;
  isSearchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean, defaultTab?: string) => void;
  settingsActiveTab?: string;
  setSettingsActiveTab: (tab: string) => void;
  userSettings: UserSettings;
  setUserSettings: (settings: UserSettings) => void;
  updateUserSetting: (key: string, value: unknown) => void;
  activeTimer: ActiveTimer | null;
  setActiveTimer: (timer: ActiveTimer | null) => void;
  /** The task the stuck-task help ("What's in the way?") is open for. */
  stuckHelpTask: TaskRecord | null;
  setStuckHelpTask: (task: TaskRecord | null) => void;

  /**
   * Records a local write so RealtimeProvider can ignore the echo it
   * produces. The timestamps live in the provider, not here — this is a
   * plain delegate so mutation sites keep one import.
   */
  markMutation: (table?: string) => void;
  activeRitual: "morning" | "evening" | null;
  setActiveRitual: (ritual: "morning" | "evening" | null) => void;
  prefetchedThreads: Record<string, unknown>;
  setPrefetchedThread: (id: string, thread: unknown) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isCaptureModalOpen: false,
  setCaptureModalOpen: (open) => set({ isCaptureModalOpen: open }),
  captureModalPrefill: null,
  setCaptureModalPrefill: (text) => set({ captureModalPrefill: text }),
  isSearchModalOpen: false,
  setSearchModalOpen: (open) => set({ isSearchModalOpen: open }),
  isMobileDrawerOpen: false,
  setIsMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),
  isSettingsModalOpen: false,
  setSettingsModalOpen: (open, defaultTab) =>
    set((state) => ({
      isSettingsModalOpen: open,
      settingsActiveTab: defaultTab || state.settingsActiveTab,
    })),
  settingsActiveTab: "account",
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  userSettings: {},
  setUserSettings: (settings) => set({ userSettings: settings }),
  updateUserSetting: (key, value) =>
    set((state) => ({ userSettings: { ...state.userSettings, [key]: value } })),
  activeTimer: null,
  setActiveTimer: (timer) => set({ activeTimer: timer }),
  stuckHelpTask: null,
  setStuckHelpTask: (task) => set({ stuckHelpTask: task }),

  markMutation: (table) => markProviderMutation(table),
  activeRitual: null,
  setActiveRitual: (ritual) => set({ activeRitual: ritual }),
  prefetchedThreads: {},
  setPrefetchedThread: (id, thread) =>
    set((state) => ({
      prefetchedThreads: { ...state.prefetchedThreads, [id]: thread },
    })),
}));
