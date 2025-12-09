import { create } from 'zustand';

type SettingsSection = 'general' | 'profile' | 'subscription' | 'integrations';

interface SettingsStore {
  isOpen: boolean;
  currentSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  currentSection: 'general',
  openSettings: (section = 'general') => set({ isOpen: true, currentSection: section }),
  closeSettings: () => set({ isOpen: false }),
  setSection: (section) => set({ currentSection: section }),
}));
