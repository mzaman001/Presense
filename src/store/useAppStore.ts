import { create } from 'zustand';
import { markMutation as markProviderMutation } from "@/components/providers/RealtimeProvider";

export interface UserSettings {
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
  pomodoro_long_break_interval?: number;
  explore_custom_types?: string[];
  last_ritual_date?: string;
  last_evening_ritual_date?: string;
  ritual_streak?: number;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
  [key: string]: unknown;
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
  activeTimer: { taskId?: string; taskTitle?: string } | null;
  setActiveTimer: (timer: { taskId?: string; taskTitle?: string } | null) => void;

  lastMutations: Record<string, number>;
  markMutation: (table?: string) => void;
  activeRitual: 'morning' | 'evening' | null;
  setActiveRitual: (ritual: 'morning' | 'evening' | null) => void;
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
  setSettingsModalOpen: (open, defaultTab) => set((state) => ({ isSettingsModalOpen: open, settingsActiveTab: defaultTab || state.settingsActiveTab })),
  settingsActiveTab: "account",
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  userSettings: {},
  setUserSettings: (settings) => set({ userSettings: settings }),
  updateUserSetting: (key, value) => set((state) => ({ userSettings: { ...state.userSettings, [key]: value } })),
  activeTimer: null,
  setActiveTimer: (timer) => set({ activeTimer: timer }),

  lastMutations: {},
  markMutation: (table) => set((state) => {
    const now = Date.now();
    markProviderMutation(table);
    return {
      lastMutations: { ...state.lastMutations, [table || '_global']: now },
    };
  }),
  activeRitual: null,
  setActiveRitual: (ritual) => set({ activeRitual: ritual }),
  prefetchedThreads: {},
  setPrefetchedThread: (id, thread) => set((state) => ({ prefetchedThreads: { ...state.prefetchedThreads, [id]: thread } })),
}));
