import { create } from 'zustand';

interface AppState {
  isCaptureModalOpen: boolean;
  setCaptureModalOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isCaptureModalOpen: false,
  setCaptureModalOpen: (open) => set({ isCaptureModalOpen: open }),
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  isSettingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
}));
