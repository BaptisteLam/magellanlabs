import { create } from 'zustand';

type SettingsSection = 'projects' | 'general' | 'profile' | 'subscription' | 'integrations';

interface SettingsStore {
  isOpen: boolean;
  currentSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  currentSection: 'projects',
  openSettings: (section = 'projects') => set({ isOpen: true, currentSection: section }),
  closeSettings: () => set({ isOpen: false }),
  setSection: (section) => set({ currentSection: section }),
}));
