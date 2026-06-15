import { create } from 'zustand';

interface AppState {
  isCaptureModalOpen: boolean;
  setCaptureModalOpen: (open: boolean) => void;
  isSearchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  userSettings: any;
  setUserSettings: (settings: any) => void;
  updateUserSetting: (key: string, value: any) => void;
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
}));
