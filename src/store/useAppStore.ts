import { create } from 'zustand';

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
  [key: string]: unknown;
}

interface AppState {
  isCaptureModalOpen: boolean;
  setCaptureModalOpen: (open: boolean) => void;
  isSearchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  userSettings: UserSettings;
  setUserSettings: (settings: UserSettings) => void;
  updateUserSetting: (key: string, value: unknown) => void;
  activeTimer: { taskId?: string; taskTitle?: string } | null;
  setActiveTimer: (timer: { taskId?: string; taskTitle?: string } | null) => void;
  lastMutationAt: number;
  markMutation: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isCaptureModalOpen: false,
  setCaptureModalOpen: (open) => set({ isCaptureModalOpen: open }),
  isSearchModalOpen: false,
  setSearchModalOpen: (open) => set({ isSearchModalOpen: open }),
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  isSettingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  userSettings: {},
  setUserSettings: (settings) => set({ userSettings: settings }),
  updateUserSetting: (key, value) => set((state) => ({ userSettings: { ...state.userSettings, [key]: value } })),
  activeTimer: null,
  setActiveTimer: (timer) => set({ activeTimer: timer }),
  lastMutationAt: 0,
  markMutation: () => set({ lastMutationAt: Date.now() }),
}));
